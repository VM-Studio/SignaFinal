import "server-only";
import type { EstadoOC, Prisma } from "@prisma/client";
import { ErrorNegocio } from "@/lib/resultado";
import { auditar as auditarBase } from "@/lib/auditoria";
import { queLleva } from "@/lib/notificaciones/textos";
import { nombreDoc } from "@/lib/compras/documento";

/** Lo común de las acciones del documento de compra (OC/PE) y de sus habilitaciones. */
type Tx = Prisma.TransactionClient;

/** Toda acción sobre el documento audita sobre la OrdenCompra (y con eso emite el tiempo real). */
export const auditar = (tx: Tx, d: { usuarioId: string; accion: string; entidadId: string; resumen: string; antes?: Prisma.InputJsonValue; despues?: Prisma.InputJsonValue }) =>
  auditarBase(tx, { entidad: "OrdenCompra", ...d });

type DocBase = { id: string; solicitanteId: string | null; creadaPorId: string; obraId: string | null; detallePedido: string | null; obra: { nombre: string } | null };

/** Lo común de los avisos de un documento (el que pidió: el solicitante, o quien lo creó). */
export const deDocumento = (d: DocBase) => ({
  ordenCompraId: d.id, solicitanteId: d.solicitanteId ?? d.creadaPorId, obraId: d.obraId ?? "", que: primeraLinea(d.detallePedido), obra: d.obra?.nombre ?? "sin obra",
});

/** La primera línea del detalle ("40 bolsas de cemento"), o "materiales". */
export const primeraLinea = (t: string | null | undefined) => (t ?? "").split("\n").map((l) => l.trim()).filter(Boolean)[0] ?? "materiales";

/** "OC-0012 (40 bolsas de cemento) para Obra Darwin" */
export const describir = (d: { tipo: "OC" | "PE"; numero: string | null; numeroInterno: number; versionAprobacion?: number; detallePedido: string | null; obra: { nombre: string } | null }) =>
  `la ${nombreDoc(d)} (${queLleva(primeraLinea(d.detallePedido))})${d.obra ? ` para Obra ${d.obra.nombre}` : ""}`;

export async function documentoOError(tx: Tx, id: string) {
  const d = await tx.ordenCompra.findUnique({ where: { id }, include: { obra: { select: { nombre: true } }, tomadoPor: { select: { nombre: true } }, proveedor: { select: { nombre: true } } } });
  if (!d) throw new ErrorNegocio("No existe esa orden.");
  return d;
}

export function exigirEstado(d: { estado: EstadoOC; tomadoPor?: { nombre: string } | null }, ...estados: EstadoOC[]) {
  if (estados.includes(d.estado)) return;
  const ahora: Partial<Record<EstadoOC, string>> = {
    BORRADOR: "Todavía es un borrador: falta enviarlo a Compras.",
    EN_COMPRAS: `Ya lo está comprando ${d.tomadoPor?.nombre ?? "Compras"}.`,
    ESPERANDO_AUTORIZACION: "Ya está esperando la autorización del dueño.",
    AUTORIZADA: "Ya está autorizada.",
    ANULADA: "Esta orden fue anulada.",
    ENTREGADA: "Esta orden ya se entregó.",
  };
  throw new ErrorNegocio(ahora[d.estado] ?? "La orden cambió. Actualizá la pantalla.");
}
