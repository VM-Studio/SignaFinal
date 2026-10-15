import "server-only";
import type { Prisma, Rol } from "@prisma/client";
import { db } from "@/lib/db";
import { ErrorNegocio } from "@/lib/resultado";
import { notificarEvento } from "@/lib/notificaciones/enviar";
import { EVENTO } from "@/lib/notificaciones/eventos";
import { cotizacionParaOC } from "@/lib/dolar";
import { cambiarEstado } from "@/lib/materiales/circuito";
import { auditar, deDocumento, describir, primeraLinea } from "@/lib/materiales/comun";
import { nombreDoc } from "./documento";
import { CELDAS, CELDAS_DE_FONDO, esCelda, puedeEditarCelda, type Celda } from "./permisosCeldas";
import { contextoCeldas, puedeVerDocumento } from "./acceso";
import { datosDeCelda, incluirDocumento, textosDe, valoresDe } from "./celdas";

/**
 * GUARDAR UNA CELDA del documento de compra (sin sesión: lo usa la acción guardarCelda y los tests).
 * Bloquea la fila, verifica el permiso de la celda (permisosCeldas.ts), compara la versión: si no es la
 * actual, devuelve el valor de ahora y quién lo cambió (conflicto, sin pisar). Si no, guarda, sube la versión
 * de la celda, deja la historia (CambioCelda) y la auditoría (que emite el tiempo real a los que la tienen
 * abierta). Con "Modificar", un cambio de fondo en una autorizada la devuelve a autorización (v2).
 */
type Tx = Prisma.TransactionClient;

async function docConAcceso(tx: Tx, id: string, u: { id: string; rol: Rol }) {
  const d = await tx.ordenCompra.findUnique({ where: { id }, include: incluirDocumento });
  if (!d || !(await puedeVerDocumento(u, d))) throw new ErrorNegocio("No existe esa orden o no la podés ver.");
  return d;
}

export type ResultadoCelda =
  | { conflicto: false; version: number; valor: string; texto: string; guardadoEn: string; estado: string; aviso?: string }
  | { conflicto: true; version: number; valor: string; texto: string; por: string; hace: string };

const versionDe = (v: Prisma.JsonValue, celda: Celda) => (v && typeof v === "object" && !Array.isArray(v) ? Number((v as Record<string, unknown>)[celda] ?? 0) : 0);
const hace = (d: Date) => {
  const s = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000));
  return s < 60 ? `hace ${s} s` : s < 3600 ? `hace ${Math.round(s / 60)} min` : `hace ${Math.round(s / 3600)} h`;
};

export async function guardarCeldaComo(yo: { id: string; nombre: string; rol: Rol }, ocId: string, celda: string, valor: string, version: number, opciones: { modificar?: boolean } = {}): Promise<{ resultado: ResultadoCelda; pdf: boolean }> {
  if (!esCelda(celda)) throw new ErrorNegocio("Esa celda no existe.");
  const v = (valor ?? "").slice(0, 6000);
  let pdf = false;
  const r = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "OrdenCompra" WHERE "id" = ${ocId} FOR UPDATE`;
    const d = await docConAcceso(tx, ocId, yo);
    const permiso = puedeEditarCelda(celda, await contextoCeldas(yo, d, { modificar: opciones.modificar, valor: v }));
    if (!permiso.ok) throw new ErrorNegocio(permiso.motivo);
    if ((yo.rol === "RESPONSABLE_OBRA") && celda === "obra" && v && !(await tx.responsableObra.count({ where: { obraId: v.split("|")[0], usuarioId: yo.id, activo: true } }))) {
      throw new ErrorNegocio("Elegí una de tus obras.");
    }
    const actual = versionDe(d.versionesCeldas, celda);
    const antes = valoresDe(d)[celda];
    const textosAntes = textosDe(d);
    if (version !== actual) {
      const ultimo = await tx.cambioCelda.findFirst({ where: { ordenCompraId: ocId, celda }, orderBy: { fecha: "desc" }, include: { usuario: { select: { nombre: true } } } });
      return { conflicto: true as const, version: actual, valor: antes, texto: textosAntes[celda], por: ultimo?.usuario.nombre.split(" ")[0] ?? "Otra persona", hace: ultimo ? hace(ultimo.fecha) : "recién" };
    }
    if (antes === v) return { conflicto: false as const, version: actual, valor: v, texto: textosAntes[celda], guardadoEn: new Date().toISOString(), estado: d.estado };

    const datos = await datosDeCelda(tx, d, celda, v, yo.id);
    // Estados que siguen a la sección 3 y 4.
    if (celda === "facturaN") datos.estadoFacturacion = v.trim() ? "FACTURADA" : "PENDIENTE";
    if (celda === "fechaDePago") datos.estadoPago = v ? "PAGADO" : d.ordenPagoAutorizadaEn ? "AUTORIZADO" : "PENDIENTE";
    if (celda === "importe" && v.startsWith("USD")) datos.cotizacionUsd = (await cotizacionParaOC()) ?? undefined;

    // Un cambio de fondo en una autorizada (con "Modificar") vuelve a autorización como v2.
    const reaprobar = opciones.modificar && (d.estado === "AUTORIZADA" || d.estado === "ENCARGADA") && CELDAS_DE_FONDO.includes(celda);
    if (opciones.modificar && d.estado === "HABILITADA" && CELDAS_DE_FONDO.includes(celda)) throw new ErrorNegocio(`Ya se habilitó material de esta orden: no se puede cambiar ${CELDAS[celda].etiqueta}. Anulala y armá una nueva.`);

    const nueva = actual + 1;
    await tx.ordenCompra.update({
      where: { id: ocId },
      data: { ...datos, version: { increment: 1 }, versionesCeldas: { ...((d.versionesCeldas as Record<string, number>) ?? {}), [celda]: nueva } },
    });
    const despues = await tx.ordenCompra.findUniqueOrThrow({ where: { id: ocId }, include: incluirDocumento });
    const texto = textosDe(despues)[celda];
    await tx.cambioCelda.create({ data: { ordenCompraId: ocId, celda, version: nueva, anterior: textosAntes[celda] || null, nuevo: texto || null, usuarioId: yo.id } });
    await auditar(tx, {
      usuarioId: yo.id, accion: `oc.celda.${celda}`, entidadId: ocId,
      resumen: `${yo.nombre} completó ${CELDAS[celda].etiqueta} de ${describir(d)}: ${texto ? texto.slice(0, 120) : "(vacío)"}`,
      antes: { [celda]: textosAntes[celda] || null }, despues: { [celda]: texto || null },
    });

    let aviso: string | undefined;
    if (reaprobar && antes !== v) {
      await cambiarEstado(tx, d, "ESPERANDO_AUTORIZACION", yo.id, `${CELDAS[celda].etiqueta} cambió: vuelve a autorización`, { versionAprobacion: { increment: 1 }, aprobadaPorId: null, aprobadaEn: null, pdfAprobadaUrl: null, enviadaEn: new Date(), encargadaEn: null });
      const n = `${d.numero ?? `#${d.numeroInterno}`} v${d.versionAprobacion + 1}`;
      await notificarEvento(EVENTO.ocParaAprobar({ ...deDocumento(d), numero: `${n} (cambió ${CELDAS[celda].etiqueta.toLowerCase()})`, proveedor: textosDe(despues).proveedorFinal || "proveedor a definir", renglones: primeraLinea(despues.detallePedido), total: textosDe(despues).importe || null, quien: textosDe(despues).solicitadoPor || "—" }), { tx, actor: yo.id });
      aviso = `Cambió ${CELDAS[celda].etiqueta}: vuelve a autorización como ${n}.`;
      pdf = true;
    }
    if (celda === "formaDePago" && v === "ACOPIO" && yo.rol === "COMPRAS") {
      await notificarEvento(EVENTO.ocAcopio({ ...deDocumento(d), numero: nombreDoc(d), quien: yo.nombre }), { tx, actor: yo.id });
    }
    return { conflicto: false as const, version: nueva, valor: valoresDe(despues)[celda], texto, guardadoEn: new Date().toISOString(), estado: reaprobar ? "ESPERANDO_AUTORIZACION" : despues.estado, aviso };
  }, { timeout: 20_000 });
  return { resultado: r, pdf };
}

