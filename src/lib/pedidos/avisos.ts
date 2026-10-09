import "server-only";
import { db } from "@/lib/db";
import { notificarEvento } from "@/lib/notificaciones/enviar";
import { EVENTO } from "@/lib/notificaciones/eventos";

/** Solicitud nueva: a todos los choferes (push si es urgente; si no, solo bandeja) y a Dirección. */
export async function avisarSolicitudNueva(pedidoId: string, actor?: string) {
  const p = await db.pedidoViaje.findUnique({
    where: { id: pedidoId },
    select: { obraId: true, descripcion: true, destinoNombre: true, origenNombre: true, paraCuando: true, prioridad: true, solicitante: { select: { nombre: true } } },
  });
  if (!p) return;
  await notificarEvento(EVENTO.solicitudNueva({
    pedidoId, obraId: p.obraId, quien: p.solicitante.nombre, descripcion: p.descripcion, destino: p.destinoNombre, origen: p.origenNombre, paraCuando: p.paraCuando, urgente: p.prioridad === "URGENTE",
  }), { actor });
}
