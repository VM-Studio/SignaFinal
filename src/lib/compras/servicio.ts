import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { eliminar, subir } from "@/lib/archivos";
import { generarPDFOC, type DatosPDFOC } from "./pdfOC";

const n = (d: Prisma.Decimal | null | undefined) => (d == null ? null : d.toNumber());

export const incluirOC = {
  obra: { select: { nombre: true, direccion: true, localidad: true } },
  pedidoMaterial: { select: { obraSede: { select: { nombre: true, direccion: true, localidad: true } } } },
  solicitante: { select: { nombre: true } },
  creadaPor: { select: { nombre: true } },
  aprobadaPor: { select: { nombre: true } },
  proveedor: { select: { nombre: true, cuit: true, telefono: true, email: true } },
  sucursal: { select: { nombre: true, direccion: true, localidad: true, telefono: true, contacto: true, horarioRetiro: true } },
  renglones: { orderBy: { orden: "asc" as const } },
} satisfies Prisma.OrdenCompraInclude;

export type OCCompleta = Prisma.OrdenCompraGetPayload<{ include: typeof incluirOC }>;

/** Los datos del PDF salen de la OC guardada (nunca al revés). */
export function aDatosPDF(oc: OCCompleta, conSello: boolean): DatosPDFOC {
  const sede = oc.pedidoMaterial.obraSede;
  return {
    numero: oc.numero,
    fecha: oc.fecha,
    fechaNecesaria: oc.fechaNecesaria,
    obra: { nombre: oc.obra.nombre, direccion: sede ? `${sede.direccion}, ${sede.localidad}` : `${oc.obra.direccion}, ${oc.obra.localidad}` },
    sede: sede?.nombre ?? null,
    solicitante: oc.solicitante.nombre,
    creadaPor: oc.creadaPor.nombre,
    proveedor: oc.proveedor,
    sucursal: oc.sucursal ? { nombre: oc.sucursal.nombre, direccion: `${oc.sucursal.direccion}, ${oc.sucursal.localidad}`, telefono: oc.sucursal.telefono, contacto: oc.sucursal.contacto, horario: oc.sucursal.horarioRetiro } : null,
    renglones: oc.renglones.map((r) => ({ descripcion: r.descripcion, cantidad: r.cantidad.toNumber(), unidad: r.unidad, precioUnitario: n(r.precioUnitario), subtotal: n(r.subtotal) })),
    metodoPago: oc.metodoPago,
    moneda: oc.moneda,
    condiciones: oc.condiciones,
    subtotal: n(oc.subtotal),
    ivaPorcentaje: n(oc.ivaPorcentaje),
    iva: n(oc.iva),
    total: n(oc.total),
    observaciones: oc.observaciones,
    aprobada: conSello && oc.aprobadaEn && oc.aprobadaPor ? { por: oc.aprobadaPor.nombre, en: oc.aprobadaEn } : null,
  };
}

/** El PDF de la OC, recién generado desde sus datos (original o con el sello de aprobada). */
export async function pdfDeOC(id: string, aprobada: boolean) {
  const oc = await db.ordenCompra.findUniqueOrThrow({ where: { id }, include: incluirOC });
  return { oc, pdf: await generarPDFOC(aDatosPDF(oc, aprobada), { borrador: oc.estado === "BORRADOR" }) };
}

/**
 * Genera el PDF y lo guarda (Blob): al enviar a aprobación queda en pdfUrl; al aprobarse, el que lleva
 * el sello queda en pdfAprobadaUrl (el original no se toca). Si el almacenamiento falla, la OC sigue
 * igual: /api/oc/[id]/pdf lo genera en el momento desde los datos.
 */
export async function guardarPDF(id: string, aprobada: boolean) {
  try {
    const { oc, pdf } = await pdfDeOC(id, aprobada);
    const nombre = `${oc.numero ?? `borrador-${oc.id}`}${aprobada ? "-aprobada" : ""}.pdf`;
    const r = await subir({ nombre, tipo: "application/pdf", datos: Buffer.from(pdf) }, "ordenes-compra", oc.creadaPorId);
    const anterior = aprobada ? oc.pdfAprobadaUrl : oc.pdfUrl;
    await db.ordenCompra.update({ where: { id }, data: aprobada ? { pdfAprobadaUrl: r.url } : { pdfUrl: r.url } });
    if (anterior && anterior !== r.url) await eliminar(anterior);
    return r.url;
  } catch (e) {
    console.error("No se pudo guardar el PDF de la OC", id, e);
    return null;
  }
}

/** Vista previa (sin guardar ni numerar): el PDF con marca BORRADOR a partir de lo que hay en el formulario. */
export async function pdfVistaPrevia(f: {
  pedidoMaterialId: string; fecha: string; fechaNecesaria?: string | null; sucursalId?: string | null; metodoPago?: DatosPDFOC["metodoPago"]; moneda?: DatosPDFOC["moneda"];
  condiciones?: string | null; observaciones?: string | null; ivaPorcentaje?: number | null; creadaPor: string;
  renglones: { descripcion: string; cantidad: number; unidad: string; precioUnitario: number | null }[];
}) {
  const p = await db.pedidoMaterial.findUniqueOrThrow({
    where: { id: f.pedidoMaterialId },
    include: { obra: { select: { nombre: true, direccion: true, localidad: true } }, obraSede: { select: { nombre: true, direccion: true, localidad: true } }, solicitante: { select: { nombre: true } } },
  });
  const suc = f.sucursalId ? await db.sucursalProveedor.findUnique({ where: { id: f.sucursalId }, include: { proveedor: true } }) : null;
  const { calcularTotales } = await import("./estados");
  const renglones = f.renglones.filter((r) => r.descripcion.trim()).map((r) => ({ ...r, subtotal: r.precioUnitario != null ? Math.round(r.cantidad * r.precioUnitario * 100) / 100 : null }));
  const iva = f.ivaPorcentaje === undefined ? 21 : f.ivaPorcentaje;
  const tot = calcularTotales(renglones, iva);
  const dia = (s: string) => new Date(`${s}T12:00:00-03:00`);
  return generarPDFOC({
    numero: null, fecha: dia(f.fecha), fechaNecesaria: f.fechaNecesaria ? dia(f.fechaNecesaria) : null,
    obra: { nombre: p.obra.nombre, direccion: p.obraSede ? `${p.obraSede.direccion}, ${p.obraSede.localidad}` : `${p.obra.direccion}, ${p.obra.localidad}` },
    sede: p.obraSede?.nombre ?? null, solicitante: p.solicitante.nombre, creadaPor: f.creadaPor,
    proveedor: suc ? { nombre: suc.proveedor.nombre, cuit: suc.proveedor.cuit, telefono: suc.proveedor.telefono, email: suc.proveedor.email } : null,
    sucursal: suc ? { nombre: suc.nombre, direccion: `${suc.direccion}, ${suc.localidad}`, telefono: suc.telefono, contacto: suc.contacto, horario: suc.horarioRetiro } : null,
    renglones, metodoPago: f.metodoPago ?? null, moneda: f.moneda ?? "ARS", condiciones: f.condiciones ?? null, observaciones: f.observaciones ?? null,
    subtotal: tot.subtotal, ivaPorcentaje: iva, iva: tot.iva, total: tot.total, aprobada: null,
  }, { borrador: true });
}
