import "server-only";
import type { EstadoTablero, Prisma, TipoOrden } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { diaISO, inicioDelDia } from "@/lib/formato";
import { ESTADOS_TABLERO } from "./estadoTablero";
import { numeroCorto } from "./numerar";
import { obraDe, solicitadoPorDe } from "./celdas";

/**
 * TABLERO DE CONTROL de Compras (la hoja "TABLERO DE CONTROL ORDENES DE C" de Alejandra). Una fila por
 * orden con estado de tablero (las que están en borrador viven en Órdenes; las importadas, siempre).
 * Filtros por índice, paginado por servidor (50 por página) y orden por defecto: Fecha de caducidad
 * más cercana primero entre las no terminadas, y después las entregadas/anuladas por fecha descendente.
 */
export const POR_PAGINA = 50;
const TERMINADOS: EstadoTablero[] = ["ENTREGADO", "ANULADA"];

export type FiltrosTablero = {
  tipo: TipoOrden[]; obra: string[]; sol: string[]; prov: string[]; estado: EstadoTablero[];
  desde?: string; hasta?: string; edesde?: string; ehasta?: string; q?: string; orden: string; pagina: number;
  /** Tarjeta "Entregado este mes" (entregado=mes). */
  mes?: boolean;
  /** Tarjeta "Entraron hoy" (entraron=hoy): creadas hoy (día argentino), sin las importadas. */
  hoy?: boolean;
};

const lista = (v: string | undefined) => (v ? v.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 50) : []);
const DIA = /^\d{4}-\d{2}-\d{2}$/;

export function leerFiltros(sp: Record<string, string | string[] | undefined>): FiltrosTablero {
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const fecha = (k: string) => (s(k) && DIA.test(s(k)!) ? s(k) : undefined);
  return {
    tipo: lista(s("tipo")).filter((t): t is TipoOrden => t === "OC" || t === "PE"),
    obra: lista(s("obra")), sol: lista(s("sol")), prov: lista(s("prov")),
    estado: lista(s("estado")).filter((e): e is EstadoTablero => (ESTADOS_TABLERO as string[]).includes(e)),
    desde: fecha("desde"), hasta: fecha("hasta"), edesde: fecha("edesde"), ehasta: fecha("ehasta"),
    q: s("q")?.trim().slice(0, 100) || undefined,
    mes: s("entregado") === "mes",
    hoy: s("entraron") === "hoy",
    orden: s("orden") ?? "caducidad",
    pagina: Math.max(1, Math.min(10_000, Number(s("pagina")) || 1)),
  };
}

const inicioDia = (d: string) => new Date(`${d}T00:00:00Z`);
const inicioMes = () => inicioDia(`${diaISO().slice(0, 8)}01`);
/** "Entregado este mes": con fecha de entrega del mes (o, en las del sistema sin fecha, entregadas este mes). */
const entregadoEsteMes = (): Prisma.OrdenCompraWhereInput => ({
  AND: [{ estadoTablero: "ENTREGADO" }, { OR: [{ fechaEntrega: { gte: inicioMes() } }, { fechaEntrega: null, fuente: { not: "IMPORTADA" }, actualizadoEn: { gte: inicioMes() } }] }],
});

/** "Entraron hoy": las órdenes creadas hoy (hora argentina), sin las importadas del Excel. */
const entraronHoy = (): Prisma.OrdenCompraWhereInput => ({ creadoEn: { gte: inicioDelDia() }, fuente: { not: "IMPORTADA" } });

/** El where de los filtros (lo comparten la tabla, los contadores y la exportación). */
export function whereTablero(f: Omit<FiltrosTablero, "orden" | "pagina">, sinEstado = false): Prisma.OrdenCompraWhereInput {
  const y: Prisma.OrdenCompraWhereInput[] = [{ OR: [{ estadoTablero: { not: null } }, { fuente: "IMPORTADA" }] }];
  if (f.tipo.length) y.push({ tipo: { in: f.tipo } });
  if (f.obra.length) {
    const ids = f.obra.filter((o) => !o.startsWith("t:"));
    const textos = f.obra.filter((o) => o.startsWith("t:")).map((o) => o.slice(2));
    y.push({ OR: [...(ids.length ? [{ obraId: { in: ids } }] : []), ...textos.map((t) => ({ obraTexto: { equals: t, mode: "insensitive" as const } }))] });
  }
  if (f.sol.length) {
    y.push({
      OR: f.sol.map((v) =>
        v.startsWith("u:") ? { solicitanteId: v.slice(2) } : v.startsWith("e:") ? { solicitanteExternoId: v.slice(2) } : { solicitadoPorTexto: { equals: v.slice(2), mode: "insensitive" as const } },
      ),
    });
  }
  if (f.prov.length) y.push({ proveedorId: { in: f.prov } });
  if (f.estado.length && !sinEstado) y.push({ estadoTablero: { in: f.estado } });
  if (f.mes && !sinEstado) y.push(entregadoEsteMes());
  if (f.hoy && !sinEstado) y.push(entraronHoy());
  if (f.desde || f.hasta) y.push({ fecha: { ...(f.desde ? { gte: inicioDia(f.desde) } : {}), ...(f.hasta ? { lte: inicioDia(f.hasta) } : {}) } });
  if (f.edesde || f.ehasta) y.push({ fechaEntrega: { ...(f.edesde ? { gte: inicioDia(f.edesde) } : {}), ...(f.ehasta ? { lte: inicioDia(f.ehasta) } : {}) } });
  if (f.q) {
    const c = { contains: f.q, mode: "insensitive" as const };
    y.push({
      OR: [
        { numero: c }, { numeroTexto: c }, { detallePedido: c }, { proximosPasos: c }, { comentarios: c }, { observaciones: c },
        { proveedorSugerido: c }, { obraTexto: c }, { solicitadoPorTexto: c }, { presupuestoNumero: c },
        { proveedor: { nombre: c } }, { obra: { nombre: c } }, { renglones: { some: { descripcion: c } } },
      ],
    });
  }
  return { AND: y };
}

export const ORDENES_TABLERO = [
  { valor: "caducidad", etiqueta: "Caducidad más cercana" },
  { valor: "caducidad-lejana", etiqueta: "Caducidad más lejana" },
  { valor: "fecha-desc", etiqueta: "Fecha (más nuevas)" },
  { valor: "fecha-asc", etiqueta: "Fecha (más viejas)" },
  { valor: "numero-desc", etiqueta: "N° de orden (mayor)" },
  { valor: "numero-asc", etiqueta: "N° de orden (menor)" },
  { valor: "importe-desc", etiqueta: "Importe (mayor)" },
  { valor: "entrega-asc", etiqueta: "Fecha de entrega" },
  { valor: "obra", etiqueta: "Obra" },
  { valor: "proveedor", etiqueta: "Proveedor" },
  { valor: "solicitado", etiqueta: "Solicitado por" },
  { valor: "estado", etiqueta: "Estado" },
];

function orderBy(orden: string): Prisma.OrdenCompraOrderByWithRelationInput[] {
  const nulos = (dir: "asc" | "desc") => ({ sort: dir, nulls: "last" as const });
  switch (orden) {
    case "caducidad-lejana": return [{ fechaNecesaria: nulos("desc") }, { fecha: "desc" }];
    case "fecha-desc": return [{ fecha: "desc" }, { secuencia: nulos("desc") }];
    case "fecha-asc": return [{ fecha: "asc" }, { secuencia: nulos("asc") }];
    case "numero-desc": return [{ tipo: "asc" }, { secuencia: nulos("desc") }, { numeroTexto: "desc" }];
    case "numero-asc": return [{ tipo: "asc" }, { secuencia: nulos("asc") }, { numeroTexto: "asc" }];
    case "importe-desc": return [{ importe: nulos("desc") }];
    case "entrega-asc": return [{ fechaEntrega: nulos("asc") }, { fecha: "desc" }];
    case "obra": return [{ obra: { nombre: "asc" } }, { obraTexto: "asc" }, { fecha: "desc" }];
    case "proveedor": return [{ proveedor: { nombre: "asc" } }, { proveedorSugerido: "asc" }, { fecha: "desc" }];
    case "solicitado": return [{ solicitante: { nombre: "asc" } }, { solicitanteExterno: { nombre: "asc" } }, { solicitadoPorTexto: "asc" }, { fecha: "desc" }];
    case "estado": return [{ estadoTablero: "asc" }, { fechaNecesaria: nulos("asc") }];
    default: return [{ fechaNecesaria: nulos("asc") }, { fecha: "asc" }, { secuencia: nulos("asc") }];
  }
}

export const seleccionTablero = {
  id: true, tipo: true, numero: true, numeroTexto: true, secuencia: true, fecha: true, fechaNecesaria: true, fechaEntrega: true, estadoTablero: true, estado: true, fuente: true, semaforoPE: true,
  detallePedido: true, proveedorSugerido: true, importe: true, importeAConfirmar: true, moneda: true, proximosPasos: true, comentarios: true, obraTexto: true, solicitadoPorTexto: true,
  versionAprobacion: true, numeroInterno: true, prioridad: true, estadoFacturacion: true, estadoPago: true,
  obra: { select: { id: true, nombre: true, direccion: true, localidad: true, razonSocialId: true } },
  obraSede: { select: { nombre: true } },
  solicitante: { select: { id: true, nombre: true } }, solicitanteExterno: { select: { id: true, nombre: true } },
  proveedor: { select: { nombre: true } },
  renglones: { orderBy: { orden: "asc" as const }, select: { descripcion: true, cantidad: true, unidad: true } },
} satisfies Prisma.OrdenCompraSelect;
type FilaDb = Prisma.OrdenCompraGetPayload<{ select: typeof seleccionTablero }>;

/** La fila tal cual la columna de la planilla. */
export function filaTablero(o: FilaDb) {
  const materiales = o.detallePedido?.trim() || o.renglones.map((r) => `${r.cantidad.toNumber().toLocaleString("es-AR")} ${r.unidad} ${r.descripcion}`).join("\n");
  return {
    id: o.id, tipo: o.tipo, numero: numeroCorto(o), numeroCompleto: o.numero, version: o.versionAprobacion, fuente: o.fuente, estadoReal: o.estado,
    fecha: diaISO(o.fecha), caducidad: o.fechaNecesaria ? diaISO(o.fechaNecesaria) : null, fechaEntrega: o.fechaEntrega ? diaISO(o.fechaEntrega) : null,
    solicitadoPor: solicitadoPorDe(o), obra: obraDe(o),
    proveedor: o.proveedor?.nombre ?? null, proveedorSugerido: o.proveedorSugerido,
    importe: o.importe?.toNumber() ?? null, importeAConfirmar: o.importeAConfirmar, moneda: o.moneda,
    materiales, estado: o.estadoTablero, semaforoPE: o.semaforoPE, proximosPasos: o.proximosPasos, comentarios: o.comentarios,
    urgente: o.prioridad === "URGENTE" && !["ENTREGADA", "ANULADA"].includes(o.estado),
    // Columna "Facturación": Pendiente / Facturada · Pago pendiente / Pagado (no aplica a anuladas).
    facturacion: o.estado === "ANULADA" ? null : { factura: o.estadoFacturacion, pago: o.estadoPago },
  };
}
export type FilaTablero = ReturnType<typeof filaTablero>;

async function exigirTablero() {
  const u = await exigirSesion();
  if (!puede(u.rol, "materiales.gestionar") && !puede(u.rol, "materiales.aprobar") && u.rol !== "ADMINISTRACION") throw new Error("Sin permiso");
  return u;
}

/** Una página del tablero con el orden pedido (el de por defecto pone las terminadas al final). */
export async function tablero(f: FiltrosTablero) {
  const u = await exigirTablero();
  const base = whereTablero(f);
  const salto = (f.pagina - 1) * POR_PAGINA;
  let filas: FilaDb[];
  let total: number;
  // "Entraron hoy" sin un orden elegido: la más nueva arriba.
  if (f.hoy && f.orden === "caducidad") {
    [total, filas] = await Promise.all([db.ordenCompra.count({ where: base }), db.ordenCompra.findMany({ where: base, orderBy: [{ creadoEn: "desc" }], skip: salto, take: POR_PAGINA, select: seleccionTablero })]);
  } else if (f.orden === "caducidad") {
    const abiertas: Prisma.OrdenCompraWhereInput = { AND: [base, { OR: [{ estadoTablero: null }, { estadoTablero: { notIn: TERMINADOS } }] }] };
    const cerradas: Prisma.OrdenCompraWhereInput = { AND: [base, { estadoTablero: { in: TERMINADOS } }] };
    const [nA, nC] = await Promise.all([db.ordenCompra.count({ where: abiertas }), db.ordenCompra.count({ where: cerradas })]);
    total = nA + nC;
    const deA = salto < nA ? await db.ordenCompra.findMany({ where: abiertas, orderBy: orderBy("caducidad"), skip: salto, take: POR_PAGINA, select: seleccionTablero }) : [];
    const faltan = POR_PAGINA - deA.length;
    const deC = faltan > 0 ? await db.ordenCompra.findMany({ where: cerradas, orderBy: [{ fecha: "desc" }, { secuencia: { sort: "desc", nulls: "last" } }], skip: Math.max(0, salto - nA), take: faltan, select: seleccionTablero }) : [];
    filas = [...deA, ...deC];
  } else {
    [total, filas] = await Promise.all([db.ordenCompra.count({ where: base }), db.ordenCompra.findMany({ where: base, orderBy: orderBy(f.orden), skip: salto, take: POR_PAGINA, select: seleccionTablero })]);
  }
  return { filas: filas.map(filaTablero), total, paginas: Math.max(1, Math.ceil(total / POR_PAGINA)), editable: puede(u.rol, "materiales.gestionar"), autorizaPago: puede(u.rol, "materiales.aprobar") };
}

/** Tarjetas de arriba: Todas · Entraron hoy · Pedir autorización · Encargado · Listas para retirar · Entregado este mes (con los filtros de tipo/obra/etc., sin el de estado). */
export async function contadoresTablero(f: FiltrosTablero) {
  await exigirTablero();
  const base = whereTablero(f, true);
  const [todas, hoy, pedir, encargado, habilitadas, entregadoMes] = await Promise.all([
    db.ordenCompra.count({ where: base }),
    db.ordenCompra.count({ where: { AND: [base, entraronHoy()] } }),
    db.ordenCompra.count({ where: { AND: [base, { estadoTablero: "PEDIR_AUTORIZACION" }] } }),
    db.ordenCompra.count({ where: { AND: [base, { estadoTablero: "ENCARGADO" }] } }),
    db.ordenCompra.count({ where: { AND: [base, { estadoTablero: "HABILITADA" }] } }),
    db.ordenCompra.count({ where: { AND: [base, entregadoEsteMes()] } }),
  ]);
  return { todas, hoy, pedir, encargado, habilitadas, entregadoMes };
}

/** Opciones de los chips (con cuántas órdenes tiene cada una en el tablero). */
export async function opcionesTablero() {
  await exigirTablero();
  const enTablero: Prisma.OrdenCompraWhereInput = { OR: [{ estadoTablero: { not: null } }, { fuente: "IMPORTADA" }] };
  const [porObra, porObraTexto, porUsuario, porExterno, porTexto, porProv, porEstado, obras, usuarios, externos, proveedores] = await Promise.all([
    db.ordenCompra.groupBy({ by: ["obraId"], where: { ...enTablero, obraId: { not: null } }, _count: true }),
    db.ordenCompra.groupBy({ by: ["obraTexto"], where: { ...enTablero, obraId: null, obraTexto: { not: null } }, _count: true }),
    db.ordenCompra.groupBy({ by: ["solicitanteId"], where: { ...enTablero, solicitanteId: { not: null } }, _count: true }),
    db.ordenCompra.groupBy({ by: ["solicitanteExternoId"], where: { ...enTablero, solicitanteExternoId: { not: null } }, _count: true }),
    db.ordenCompra.groupBy({ by: ["solicitadoPorTexto"], where: { ...enTablero, solicitanteId: null, solicitanteExternoId: null, solicitadoPorTexto: { not: null } }, _count: true }),
    db.ordenCompra.groupBy({ by: ["proveedorId"], where: { ...enTablero, proveedorId: { not: null } }, _count: true }),
    db.ordenCompra.groupBy({ by: ["estadoTablero"], where: { estadoTablero: { not: null } }, _count: true }),
    db.obra.findMany({ select: { id: true, nombre: true } }),
    db.usuario.findMany({ select: { id: true, nombre: true } }),
    db.solicitanteExterno.findMany({ select: { id: true, nombre: true } }),
    db.proveedor.findMany({ select: { id: true, nombre: true } }),
  ]);
  const nombre = <T extends { id: string; nombre: string }>(xs: T[], id: string | null) => xs.find((x) => x.id === id)?.nombre ?? "—";
  const ordenar = (xs: { valor: string; etiqueta: string; cantidad: number }[]) => xs.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
  return {
    obras: ordenar([
      ...porObra.map((x) => ({ valor: x.obraId!, etiqueta: nombre(obras, x.obraId), cantidad: x._count })),
      ...porObraTexto.map((x) => ({ valor: `t:${x.obraTexto}`, etiqueta: `${x.obraTexto} (sin emparejar)`, cantidad: x._count })),
    ]),
    solicitantes: ordenar([
      ...porUsuario.map((x) => ({ valor: `u:${x.solicitanteId}`, etiqueta: nombre(usuarios, x.solicitanteId), cantidad: x._count })),
      ...porExterno.map((x) => ({ valor: `e:${x.solicitanteExternoId}`, etiqueta: nombre(externos, x.solicitanteExternoId), cantidad: x._count })),
      ...porTexto.map((x) => ({ valor: `t:${x.solicitadoPorTexto}`, etiqueta: x.solicitadoPorTexto!, cantidad: x._count })),
    ]),
    proveedores: ordenar(porProv.map((x) => ({ valor: x.proveedorId!, etiqueta: nombre(proveedores, x.proveedorId), cantidad: x._count }))),
    estados: ESTADOS_TABLERO.map((e) => ({ valor: e, cantidad: porEstado.find((x) => x.estadoTablero === e)?._count ?? 0 })),
  };
}

/** Exportar: todas las filas que matchean (en tandas de 500, para no cargar todo en memoria). */
export async function* filasParaExportar(f: FiltrosTablero) {
  await exigirTablero();
  const where = whereTablero(f);
  const orden = f.orden === "caducidad" ? [{ estadoTablero: "asc" as const }, ...orderBy("caducidad")] : orderBy(f.orden);
  let cursor: string | undefined;
  for (;;) {
    const lote = await db.ordenCompra.findMany({ where, orderBy: [...orden, { id: "asc" }], take: 500, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), select: seleccionTablero });
    if (!lote.length) return;
    for (const o of lote) yield filaTablero(o);
    if (lote.length < 500) return;
    cursor = lote[lote.length - 1].id;
  }
}
