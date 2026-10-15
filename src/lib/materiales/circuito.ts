import "server-only";
import type { EstadoMaterialListo, EstadoOC, Prisma } from "@prisma/client";
import { notificarEvento } from "@/lib/notificaciones/enviar";
import { EVENTO } from "@/lib/notificaciones/eventos";
import { sincronizarTablero } from "@/lib/compras/estadoTablero";
import { estadoSegunHabilitaciones } from "@/lib/compras/documento";
import { deDocumento } from "./comun";

type Tx = Prisma.TransactionClient;

/** Cambia el estado del documento y deja la historia (CambioEstadoOC). Cerrojo: si otro lo cambió en el medio, no se pisa. */
export async function cambiarEstado(tx: Tx, d: { id: string; estado: EstadoOC }, a: EstadoOC, usuarioId: string | null, nota?: string, datos: Prisma.OrdenCompraUncheckedUpdateInput = {}) {
  const r = await tx.ordenCompra.updateMany({ where: { id: d.id, estado: d.estado }, data: { ...datos, estado: a, version: { increment: 1 } } });
  if (!r.count) return false;
  if (d.estado !== a || nota) await tx.cambioEstadoOC.create({ data: { ordenCompraId: d.id, de: d.estado, a, usuarioId, nota: nota?.slice(0, 300) } });
  // El tablero de Compras sigue al estado real.
  await sincronizarTablero(tx, d.id);
  return true;
}

const CON_HABILITACIONES: EstadoOC[] = ["AUTORIZADA", "ENCARGADA", "HABILITADA", "ENTREGADA"];

/** Recalcula el estado de un documento autorizado a partir de sus habilitaciones. Devuelve el cambio, si hubo. */
export async function recalcular(tx: Tx, ordenCompraId: string, usuarioId: string | null, nota?: string) {
  const d = await tx.ordenCompra.findUniqueOrThrow({ where: { id: ordenCompraId }, select: { id: true, estado: true, completo: true, encargadaEn: true, materialesListos: { select: { estado: true } } } });
  if (!CON_HABILITACIONES.includes(d.estado)) return null;
  const a = estadoSegunHabilitaciones(d.encargadaEn ? "ENCARGADA" : "AUTORIZADA", d.completo, d.materialesListos);
  if (a === d.estado) {
    if (nota) await tx.cambioEstadoOC.create({ data: { ordenCompraId: d.id, de: d.estado, a, usuarioId, nota: nota.slice(0, 300) } });
    return null;
  }
  await cambiarEstado(tx, d, a, usuarioId, nota);
  return { de: d.estado, a };
}

/** Lo que le pasa al viaje de retiro y cómo se mueve el material. */
export type EventoViaje = "TOMADO" | "EN_VIAJE" | "ENTREGADO" | "LIBERADO" | "CANCELADO";

const DESDE: Record<EventoViaje, EstadoMaterialListo[]> = {
  TOMADO: ["LISTO"],
  EN_VIAJE: ["LISTO", "RETIRO_PEDIDO"],
  ENTREGADO: ["LISTO", "RETIRO_PEDIDO", "EN_CAMINO"],
  LIBERADO: ["RETIRO_PEDIDO", "EN_CAMINO"],
  CANCELADO: ["RETIRO_PEDIDO", "EN_CAMINO"],
};
const HACIA: Record<EventoViaje, EstadoMaterialListo> = {
  TOMADO: "RETIRO_PEDIDO", EN_VIAJE: "EN_CAMINO", ENTREGADO: "ENTREGADO", LIBERADO: "LISTO", CANCELADO: "LISTO",
};

/**
 * Enganche con el viaje: en viaje → la habilitación EN_CAMINO; entregado → ENTREGADO (y el documento
 * ENTREGADA si está todo y "no falta nada"); el chofer lo suelta o se cancela → vuelve a LISTO. No hace nada
 * si el viaje no es un retiro de material.
 */
export async function alCambiarElViaje(tx: Tx, pedidoViajeId: string, evento: EventoViaje, usuarioId: string | null) {
  const listos = await tx.materialListo.findMany({
    where: { pedidoViajeId, estado: { in: DESDE[evento] } },
    include: { proveedor: { select: { nombre: true } }, ordenCompra: { select: { id: true, detallePedido: true, solicitanteId: true, creadaPorId: true, obraId: true, obra: { select: { nombre: true } } } } },
  });
  if (!listos.length) return;
  const ahora = new Date();
  await tx.materialListo.updateMany({
    where: { id: { in: listos.map((m) => m.id) } },
    data: { estado: HACIA[evento], ...(evento === "ENTREGADO" ? { entregadoEn: ahora } : {}) },
  });

  const viaje = await tx.pedidoViaje.findUnique({ where: { id: pedidoViajeId }, select: { numero: true, tomadoPor: { select: { nombre: true } } } });
  const nota = { TOMADO: `Viaje #${viaje?.numero} aceptado`, EN_VIAJE: `Viaje #${viaje?.numero} en camino`, ENTREGADO: `Viaje #${viaje?.numero} entregado`, LIBERADO: `El chofer soltó el viaje #${viaje?.numero}`, CANCELADO: `Se canceló el viaje #${viaje?.numero}` }[evento];

  for (const m of new Map(listos.map((x) => [x.ordenCompra.id, x])).values()) {
    const cambio = await recalcular(tx, m.ordenCompra.id, usuarioId, nota);
    const base = { ...deDocumento(m.ordenCompra), que: m.descripcion };
    // En viaje: los avisos de las etapas del viaje ya le llegan al que pidió y a Compras (eventos.ts).
    if (evento === "ENTREGADO") await notificarEvento(EVENTO.materialEntregado({ ...base, completo: cambio?.a === "ENTREGADA" }), { tx, actor: usuarioId });
    if (evento === "LIBERADO" || evento === "CANCELADO") {
      await notificarEvento(EVENTO.materialVuelveAListo({ ...base, proveedor: m.proveedor.nombre, motivo: evento === "LIBERADO" ? `${viaje?.tomadoPor?.nombre ?? "El chofer"} soltó el viaje` : "Se canceló el viaje" }), { tx, actor: usuarioId });
    }
  }
}
