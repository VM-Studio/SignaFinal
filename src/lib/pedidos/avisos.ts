import "server-only";
import { db } from "@/lib/db";
import { notificarVarios } from "@/lib/notificaciones";
import { TEXTO } from "@/lib/notificaciones/textos";

/** Solicitud urgente: push a todos los choferes activos. */
export async function avisarUrgente(pedidoId: string) {
  const p = await db.pedidoViaje.findUnique({ where: { id: pedidoId }, select: { descripcion: true, destinoNombre: true, origenNombre: true, paraCuando: true, solicitante: { select: { nombre: true } } } });
  if (!p) return;
  const choferes = await db.usuario.findMany({ where: { rol: "CHOFER", activo: true }, select: { id: true } });
  await notificarVarios(choferes.map((c) => c.id), "SOLICITUD_URGENTE", {
    ...TEXTO.urgente(p.solicitante.nombre, { descripcion: p.descripcion, destino: p.destinoNombre, origen: p.origenNombre, paraCuando: p.paraCuando }),
    enlace: `/solicitudes/${pedidoId}`, datos: { pedidoId },
  });
}
