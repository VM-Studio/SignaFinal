import "server-only";
import { Prisma, type EstadoOC, type EstadoTablero } from "@prisma/client";
import { db } from "@/lib/db";
import { auditar } from "@/lib/auditoria";
import { aFecha, diaISO } from "@/lib/formato";
import { formatoOC, subirNumerador } from "./numerar";
import { claveProveedor, filaValida, revisarTodo, type Catalogos, type Celda, type Correccion, type FilaRevisada, type Mapeo } from "./importarTablero";

/** Lo que hay en el sistema para emparejar (usuarios, solicitantes sin usuario, obras, proveedores). */
export async function catalogosImportacion(): Promise<Catalogos> {
  const [usuarios, externos, obras, proveedores] = await Promise.all([
    db.usuario.findMany({ where: { activo: true }, select: { id: true, nombre: true } }),
    db.solicitanteExterno.findMany({ where: { activo: true }, select: { id: true, nombre: true } }),
    db.obra.findMany({ select: { id: true, nombre: true, localidad: true } }),
    db.proveedor.findMany({ where: { activo: true }, select: { id: true, nombre: true } }),
  ]);
  return { usuarios, externos, obras, proveedores };
}

/** Órdenes que ya están (clave tipo + número): las importadas se actualizan; las del sistema no se pisan. */
export async function existentes() {
  const os = await db.ordenCompra.findMany({ where: { numeroTexto: { not: null } }, select: { tipo: true, numeroTexto: true, fuente: true } });
  return Object.fromEntries(os.map((o) => [`${o.tipo}-${o.numeroTexto}`, o.fuente]));
}

/** El estado real que corresponde a cada estado del tablero (las importadas nunca van a /aprobaciones). */
const ESTADO_REAL: Record<EstadoTablero, EstadoOC> = {
  PEDIR_AUTORIZACION: "ESPERANDO_AUTORIZACION", AUTORIZADA: "AUTORIZADA", SOLICITUD_PRESUPUESTO: "EN_COMPRAS",
  ENCARGADO: "ENCARGADA", HABILITADA: "HABILITADA", ENTREGADO: "ENTREGADA", ANULADA: "ANULADA",
};

export type ResumenImportacion = { creadas: number; actualizadas: number; excluidas: number; conError: number; solicitantesNuevos: string[]; proveedoresNuevos: string[]; obrasSinEmparejar: string[] };

/**
 * Importa las filas válidas (vuelve a revisarlas acá, con lo que hay en la base ahora). Clave tipo +
 * número: importar dos veces el mismo archivo no duplica (actualiza las importadas). Las nuevas quedan
 * con fuente IMPORTADA, sin PDF. Después sube los numeradores para que las
 * nuevas sigan después del mayor número importado.
 */
export async function importarFilas(yo: { id: string; nombre: string }, filas: { n: number; celdas: Celda[] }[], mapeo: Mapeo, correcciones: Record<number, Correccion>): Promise<ResumenImportacion> {
  const catalogos = await catalogosImportacion();
  const ya = await existentes();
  const revisadas = revisarTodo(filas, mapeo, catalogos, correcciones);
  for (const r of revisadas) if (r.tipo && r.numeroTexto && ya[`${r.tipo}-${r.numeroTexto}`] && ya[`${r.tipo}-${r.numeroTexto}`] !== "IMPORTADA") r.errores.push("Ese número ya es de una orden armada en el sistema.");
  const validas = revisadas.filter(filaValida);
  const resumen: ResumenImportacion = { creadas: 0, actualizadas: 0, excluidas: revisadas.filter((r) => r.excluida).length, conError: revisadas.filter((r) => !r.excluida && r.errores.length).length, solicitantesNuevos: [], proveedoresNuevos: [], obrasSinEmparejar: [] };
  if (!validas.length) return resumen;

  // Solicitantes sin usuario y proveedores nuevos: uno por nombre.
  const externos = new Map<string, string>();
  const provs = new Map<string, string>();
  await db.$transaction(async (tx) => {
    for (const nombre of new Set(validas.flatMap((r) => (r.solicitado?.tipo === "nuevo" ? [r.solicitado.nombre] : [])))) {
      const e = await tx.solicitanteExterno.upsert({ where: { nombre }, create: { nombre }, update: { activo: true } });
      externos.set(nombre, e.id);
      resumen.solicitantesNuevos.push(nombre);
    }
    for (const r of validas) {
      if (!r.proveedor.nuevo || !r.proveedor.nombre) continue;
      const k = claveProveedor(r.proveedor.nombre);
      if (provs.has(k)) continue;
      const p = await tx.proveedor.create({ data: { nombre: r.proveedor.nombre, notas: "Importado del tablero de Compras: completar dirección (sin sucursal)." } });
      provs.set(k, p.id);
      resumen.proveedoresNuevos.push(r.proveedor.nombre);
    }
  }, { timeout: 60_000 });

  const empresa = (await db.razonSocial.findFirst({ where: { activa: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }], select: { id: true } }))?.id ?? null;
  const razonDeObra = new Map((await db.obra.findMany({ select: { id: true, razonSocialId: true } })).map((o) => [o.id, o.razonSocialId]));
  const hoy = aFecha(diaISO(), "12:00");
  const datos = (r: FilaRevisada) => {
    const estado = r.estado;
    const solicitado = r.solicitado;
    return {
      tipo: r.tipo!, numero: formatoOC(r.tipo!, r.numero ?? r.numeroTexto!), numeroTexto: r.numeroTexto!, secuencia: r.numero,
      fuente: "IMPORTADA" as const, estado: estado ? ESTADO_REAL[estado] : ("EN_COMPRAS" as const), estadoTablero: estado, estadoTableroAuto: estado,
      fecha: r.fecha ? aFecha(r.fecha, "12:00") : hoy, fechaEntrega: r.fechaEntrega ? aFecha(r.fechaEntrega, "12:00") : null,
      solicitanteId: solicitado?.tipo === "u" ? solicitado.id : null,
      solicitanteExternoId: solicitado?.tipo === "e" ? solicitado.id : solicitado?.tipo === "nuevo" ? externos.get(solicitado.nombre) ?? null : null,
      solicitadoPorTexto: null,
      obraId: r.obra.id, obraTexto: r.obra.id ? null : r.obra.texto,
      empresaCompraId: (r.obra.id && razonDeObra.get(r.obra.id)) || empresa,
      proveedorId: r.proveedor.id ?? (r.proveedor.nombre ? provs.get(claveProveedor(r.proveedor.nombre)) ?? null : null),
      importe: r.importe != null ? new Prisma.Decimal(r.importe) : null, importeAConfirmar: r.importeAConfirmar,
      detallePedido: r.materiales, proximosPasos: r.proximosPasos, comentarios: r.comentarios,
      semaforoPE: r.tipo === "PE" ? (estado === "ENTREGADO" ? ("LISTA" as const) : estado === "ANULADA" ? ("ANULADA" as const) : estado ? ("EN_PROCESO" as const) : ("NADA_TODAVIA" as const)) : null,
    } satisfies Prisma.OrdenCompraUncheckedCreateInput | Prisma.OrdenCompraUncheckedUpdateInput;
  };

  // En tandas: miles de filas no traban la base.
  for (let i = 0; i < validas.length; i += 100) {
    const tanda = validas.slice(i, i + 100);
    await db.$transaction(async (tx) => {
      for (const r of tanda) {
        const d = datos(r);
        const previa = await tx.ordenCompra.findFirst({ where: { tipo: r.tipo!, numeroTexto: r.numeroTexto! }, select: { id: true, fuente: true } });
        if (previa && previa.fuente !== "IMPORTADA") continue;
        if (previa) {
          await tx.ordenCompra.update({ where: { id: previa.id }, data: d });
          resumen.actualizadas++;
        } else {
          await tx.ordenCompra.create({ data: { ...d, creadaPorId: yo.id } });
          resumen.creadas++;
        }
      }
    }, { timeout: 60_000 });
  }

  // Las nuevas siguen después del mayor número importado (por tipo).
  await db.$transaction(async (tx) => {
    for (const tipo of ["OC", "PE"] as const) {
      const max = Math.max(0, ...validas.filter((r) => r.tipo === tipo && r.numero != null).map((r) => r.numero!));
      if (max) await subirNumerador(tx, tipo, max);
    }
    await auditar(tx, {
      usuarioId: yo.id, accion: "oc.importarExcel", entidad: "OrdenCompra", entidadId: "excel",
      resumen: `${yo.nombre} importó el tablero desde Excel: ${resumen.creadas} órdenes nuevas, ${resumen.actualizadas} actualizadas`,
      despues: { creadas: resumen.creadas, actualizadas: resumen.actualizadas, proveedoresNuevos: resumen.proveedoresNuevos.length, solicitantesNuevos: resumen.solicitantesNuevos },
    });
  });
  resumen.obrasSinEmparejar = [...new Set(validas.filter((r) => r.obra.texto && !r.obra.id).map((r) => r.obra.texto!))];
  return resumen;
}
