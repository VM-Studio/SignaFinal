import "server-only";
import type { EstadoMaterial, Prisma } from "@prisma/client";
import { ErrorNegocio } from "@/lib/resultado";
import { auditar as auditarBase } from "@/lib/auditoria";
import { queLleva } from "@/lib/notificaciones/textos";

/** Lo común de las acciones de pedidos de material y de órdenes de compra. */
type Tx = Prisma.TransactionClient;

export const auditar = (tx: Tx, d: { usuarioId: string; accion: string; entidadId: string; resumen: string; antes?: Prisma.InputJsonValue; despues?: Prisma.InputJsonValue }) =>
  auditarBase(tx, { entidad: "PedidoMaterial", ...d });

/** Lo común de los avisos de un pedido de material. */
export const deMaterial = (p: { id: string; solicitanteId: string; obraId: string; descripcion: string; obra: { nombre: string } }) => ({
  pedidoMaterialId: p.id, solicitanteId: p.solicitanteId, obraId: p.obraId, que: p.descripcion, obra: p.obra.nombre,
});

/** "#12 (cemento portland) para Obra Darwin" */
export const describir = (p: { numero: number; descripcion: string; obra: { nombre: string } }) => `el pedido de material #${p.numero} (${queLleva(p.descripcion)}) para Obra ${p.obra.nombre}`;

export async function pedidoOError(tx: Tx, id: string) {
  const p = await tx.pedidoMaterial.findUnique({ where: { id }, include: { obra: { select: { nombre: true } }, tomadoPor: { select: { nombre: true } } } });
  if (!p) throw new ErrorNegocio("No existe ese pedido de material.");
  return p;
}

export function exigirEstado(p: { estado: EstadoMaterial; tomadoPor?: { nombre: string } | null }, ...estados: EstadoMaterial[]) {
  if (estados.includes(p.estado)) return;
  const ahora: Partial<Record<EstadoMaterial, string>> = {
    EN_COMPRA: `Ya lo está comprando ${p.tomadoPor?.nombre ?? "Compras"}.`,
    ESPERANDO_APROBACION: "Ya está esperando la aprobación del dueño.",
    APROBADO: "Ya está aprobado.",
    CANCELADO: "Este pedido fue cancelado.",
    ENTREGADO: "Este pedido ya se entregó.",
  };
  throw new ErrorNegocio(ahora[p.estado] ?? "El pedido cambió. Actualizá la pantalla.");
}
