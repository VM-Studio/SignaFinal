import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { eliminar, subir } from "@/lib/archivos";
import { generarPDFOC, type DatosPDFOC } from "./pdfOC";
import { CONDICION_PAGO, condicionPagoTexto, FORMA_PAGO } from "./estados";
import type { DatosOCValidos } from "./esquema";

const n = (d: Prisma.Decimal | null | undefined) => (d == null ? null : d.toNumber());

export const incluirOC = {
  obra: { select: { id: true, nombre: true, direccion: true, localidad: true, razonSocialId: true } },
  pedidoMaterial: { select: { id: true, numero: true, estado: true, prioridad: true, obraSede: { select: { nombre: true, direccion: true, localidad: true } } } },
  solicitante: { select: { id: true, nombre: true } },
  solicitanteExterno: { select: { id: true, nombre: true } },
  empresaCompra: { select: { id: true, nombre: true, cuit: true } },
  empresaFacturar: { select: { id: true, nombre: true, cuit: true } },
  creadaPor: { select: { nombre: true } },
  aprobadaPor: { select: { nombre: true } },
  ordenPagoAutorizadaPor: { select: { nombre: true } },
  proveedor: { select: { id: true, nombre: true, cuit: true, telefono: true, email: true } },
  sucursal: { select: { id: true, nombre: true, direccion: true, localidad: true, telefono: true, contacto: true, horarioRetiro: true } },
  renglones: { orderBy: { orden: "asc" as const } },
} satisfies Prisma.OrdenCompraInclude;

export type OCCompleta = Prisma.OrdenCompraGetPayload<{ include: typeof incluirOC }>;

/** "Solicitado por": el usuario, el solicitante externo o el texto que vino del Excel. */
export const solicitadoPor = (oc: Pick<OCCompleta, "solicitante" | "solicitanteExterno" | "solicitadoPorTexto">) =>
  oc.solicitante?.nombre ?? oc.solicitanteExterno?.nombre ?? oc.solicitadoPorTexto ?? "—";

export const obraDe = (oc: Pick<OCCompleta, "obra" | "obraTexto" | "pedidoMaterial">) =>
  oc.obra ? `${oc.obra.nombre}${oc.pedidoMaterial?.obraSede ? ` · ${oc.pedidoMaterial.obraSede.nombre}` : ""}` : oc.obraTexto ?? "—";

const ESTADO_AUTORIZACION = { BORRADOR: "Sin enviar", ESPERANDO_APROBACION: "Esperando autorización", APROBADA: "Autorizada", RECHAZADA: "Rechazada", ANULADA: "Anulada" } as const;

/** Los datos del PDF salen de la orden guardada (nunca al revés). */
export function aDatosPDF(oc: OCCompleta, conSello: boolean): DatosPDFOC {
  const sede = oc.pedidoMaterial?.obraSede;
  const hayFacturacion = !!(oc.empresaFacturar || oc.facturaNumero || oc.facturaImporte || oc.facturaFecha || oc.facturaFormaPago || oc.facturaCondicion);
  const hayPago = !!(oc.ordenPagoAutorizadaEn || oc.fechaPago || oc.pagoImporte || oc.pagoObservaciones);
  return {
    tipo: oc.tipo,
    numero: oc.numero,
    version: oc.versionAprobacion,
    empresa: oc.empresaCompra ? { nombre: oc.empresaCompra.nombre, cuit: oc.empresaCompra.cuit } : null,
    fechaPedido: oc.fecha,
    fechaCaducidad: oc.fechaNecesaria,
    solicitadoPor: solicitadoPor(oc),
    obra: obraDe(oc),
    direccionObra: sede ? `${sede.direccion}, ${sede.localidad}` : oc.obra ? `${oc.obra.direccion}, ${oc.obra.localidad}` : null,
    detallePedido: oc.detallePedido,
    renglones: oc.renglones.map((r) => ({ descripcion: r.descripcion, cantidad: r.cantidad.toNumber(), unidad: r.unidad, precioUnitario: n(r.precioUnitario), subtotal: n(r.subtotal) })),
    proveedorSugerido: oc.proveedorSugerido,
    proveedorFinal: oc.proveedor
      ? {
          nombre: oc.proveedor.nombre, cuit: oc.proveedor.cuit,
          sucursal: oc.sucursal ? `${oc.sucursal.nombre} · ${oc.sucursal.direccion}, ${oc.sucursal.localidad}${oc.sucursal.horarioRetiro ? ` · ${oc.sucursal.horarioRetiro}` : ""}` : null,
          telefono: oc.sucursal?.telefono ?? oc.proveedor.telefono, contacto: oc.sucursal?.contacto ?? null,
        }
      : null,
    presupuestoNumero: oc.presupuestoNumero,
    importe: n(oc.importe),
    importeAConfirmar: oc.importeAConfirmar,
    moneda: oc.moneda,
    cotizacionUsd: n(oc.cotizacionUsd),
    formaPago: oc.formaPago ? FORMA_PAGO[oc.formaPago] : null,
    condicionPago: condicionPagoTexto(oc.condicionPago, oc.condicionPagoTexto),
    fechaEntrega: oc.fechaEntrega,
    observaciones: oc.observaciones,
    semaforo: oc.semaforoPE,
    autorizacion: {
      estado: ESTADO_AUTORIZACION[oc.estado], aprobada: conSello && oc.estado === "APROBADA",
      por: oc.aprobadaPor?.nombre ?? null, en: oc.aprobadaEn, motivo: oc.motivoRechazo ?? oc.motivoAnulacion,
    },
    facturacion: hayFacturacion
      ? {
          empresa: oc.empresaFacturar?.nombre ?? null, cuit: oc.empresaFacturar?.cuit ?? null, numero: oc.facturaNumero, importe: n(oc.facturaImporte), fecha: oc.facturaFecha,
          formaPago: oc.facturaFormaPago ? FORMA_PAGO[oc.facturaFormaPago] : null, condicion: oc.facturaCondicion ? CONDICION_PAGO[oc.facturaCondicion] : null,
        }
      : null,
    ordenPago: hayPago ? { autorizadaPor: oc.ordenPagoAutorizadaPor?.nombre ?? null, autorizadaEn: oc.ordenPagoAutorizadaEn, fechaPago: oc.fechaPago, importe: n(oc.pagoImporte), observaciones: oc.pagoObservaciones } : null,
    creadaPor: oc.creadaPor.nombre,
  };
}

/** El PDF de la orden, recién generado desde sus datos (original o con el sello de autorizada). */
export async function pdfDeOC(id: string, aprobada: boolean) {
  const oc = await db.ordenCompra.findUniqueOrThrow({ where: { id }, include: incluirOC });
  return { oc, pdf: await generarPDFOC(aDatosPDF(oc, aprobada), { borrador: oc.estado === "BORRADOR" }) };
}

/**
 * Genera el PDF y lo guarda (Blob): al enviar a aprobación queda en pdfUrl; al aprobarse, el que lleva
 * el sello queda en pdfAprobadaUrl (el original no se toca). Si el almacenamiento falla, la orden sigue
 * igual: /api/oc/[id]/pdf lo genera en el momento desde los datos.
 */
export async function guardarPDF(id: string, aprobada: boolean) {
  try {
    const { oc, pdf } = await pdfDeOC(id, aprobada);
    const nombre = `${oc.numero ?? `borrador-${oc.id}`}${oc.versionAprobacion > 1 ? `-v${oc.versionAprobacion}` : ""}${aprobada ? "-aprobada" : ""}.pdf`;
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

/** Vista previa (sin guardar ni numerar): el PDF con marca BORRADOR a partir de lo que hay en la plantilla. */
export async function pdfVistaPrevia(d: DatosOCValidos, creadaPor: string) {
  const [empresa, obra, sede, suc, prov, solicitante, facturar] = await Promise.all([
    d.empresaCompraId ? db.razonSocial.findUnique({ where: { id: d.empresaCompraId } }) : null,
    d.obraId ? db.obra.findUnique({ where: { id: d.obraId }, select: { nombre: true, direccion: true, localidad: true } }) : null,
    d.obraSedeId ? db.obraSede.findUnique({ where: { id: d.obraSedeId }, select: { nombre: true, direccion: true, localidad: true } }) : null,
    d.sucursalId ? db.sucursalProveedor.findUnique({ where: { id: d.sucursalId } }) : null,
    d.proveedorId ? db.proveedor.findUnique({ where: { id: d.proveedorId } }) : null,
    d.solicitadoPor?.startsWith("u:")
      ? db.usuario.findUnique({ where: { id: d.solicitadoPor.slice(2) }, select: { nombre: true } })
      : d.solicitadoPor?.startsWith("e:")
        ? db.solicitanteExterno.findUnique({ where: { id: d.solicitadoPor.slice(2) }, select: { nombre: true } })
        : null,
    d.empresaFacturarId ? db.razonSocial.findUnique({ where: { id: d.empresaFacturarId } }) : null,
  ]);
  const dia = (s: string | undefined) => (s ? new Date(`${s}T12:00:00-03:00`) : null);
  const hayFacturacion = !!(d.empresaFacturarId || d.facturaNumero || d.facturaImporte != null || d.facturaFecha || d.facturaFormaPago || d.facturaCondicion);
  const hayPago = !!(d.fechaPago || d.pagoImporte != null || d.pagoObservaciones);
  return generarPDFOC({
    tipo: d.tipo, numero: null, version: 1,
    empresa: empresa ? { nombre: empresa.nombre, cuit: empresa.cuit } : null,
    fechaPedido: dia(d.fecha)!, fechaCaducidad: dia(d.fechaNecesaria), fechaEntrega: dia(d.fechaEntrega),
    solicitadoPor: solicitante?.nombre ?? "—",
    obra: obra ? `${obra.nombre}${sede ? ` · ${sede.nombre}` : ""}` : "—",
    direccionObra: sede ? `${sede.direccion}, ${sede.localidad}` : obra ? `${obra.direccion}, ${obra.localidad}` : null,
    detallePedido: d.detallePedido ?? null,
    renglones: d.renglones.map((r) => ({ descripcion: r.descripcion, cantidad: r.cantidad ?? 0, unidad: r.unidad || "u", precioUnitario: r.precioUnitario ?? null, subtotal: null })),
    proveedorSugerido: d.proveedorSugerido ?? null,
    proveedorFinal: prov ? { nombre: prov.nombre, cuit: prov.cuit, sucursal: suc ? `${suc.nombre} · ${suc.direccion}, ${suc.localidad}` : null, telefono: suc?.telefono ?? prov.telefono, contacto: suc?.contacto ?? null } : null,
    presupuestoNumero: d.presupuestoNumero ?? null, importe: d.importe ?? null, importeAConfirmar: d.importeAConfirmar, moneda: d.moneda, cotizacionUsd: null,
    formaPago: d.formaPago ? FORMA_PAGO[d.formaPago] : null, condicionPago: condicionPagoTexto(d.condicionPago ?? null, d.condicionPagoTexto ?? null),
    observaciones: d.observaciones ?? null, semaforo: d.tipo === "PE" ? d.semaforoPE ?? "NADA_TODAVIA" : null,
    autorizacion: { estado: "Sin enviar", por: null, en: null, motivo: null, aprobada: false },
    facturacion: hayFacturacion ? { empresa: facturar?.nombre ?? null, cuit: facturar?.cuit ?? null, numero: d.facturaNumero ?? null, importe: d.facturaImporte ?? null, fecha: dia(d.facturaFecha), formaPago: d.facturaFormaPago ? FORMA_PAGO[d.facturaFormaPago] : null, condicion: d.facturaCondicion ? CONDICION_PAGO[d.facturaCondicion] : null } : null,
    ordenPago: hayPago ? { autorizadaPor: null, autorizadaEn: null, fechaPago: dia(d.fechaPago), importe: d.pagoImporte ?? null, observaciones: d.pagoObservaciones ?? null } : null,
    creadaPor,
  }, { borrador: true });
}
