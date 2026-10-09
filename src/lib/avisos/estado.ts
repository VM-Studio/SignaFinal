import "server-only";
import { db } from "@/lib/db";
import { filtroDestinatario } from "@/lib/alertas/destinatarios";
import type { UsuarioSesion } from "@/lib/auth/sesion";
import { ETAPAS_EN_CURSO } from "@/lib/viajes/etapas";

export type EstadoAvisos = {
  /** Lo que cuenta la campana: avisos sin leer + alertas sin ver. */
  n: number;
  /** El último aviso (para el toast): id, título y enlace. */
  ultima: { id: string; titulo: string; enlace: string | null } | null;
  /** Chofer: firma de su viaje en curso (cambia cuando el GPS lo pasa de etapa). */
  viaje: string | null;
};

/** Consulta liviana (solo conteos y lo mínimo del último aviso) para el stream de la campana. */
export async function estadoAvisos(u: Pick<UsuarioSesion, "id" | "rol">): Promise<EstadoAvisos> {
  const [noLeidas, alertas, ultima, viaje] = await Promise.all([
    db.notificacion.count({ where: { usuarioId: u.id, leidaEn: null } }),
    db.alerta.count({ where: { ...filtroDestinatario(u), estado: "ABIERTA" } }),
    db.notificacion.findFirst({ where: { usuarioId: u.id }, orderBy: { creadaEn: "desc" }, select: { id: true, titulo: true, enlace: true } }),
    u.rol === "CHOFER"
      ? db.viaje.findFirst({ where: { choferId: u.id, etapa: { in: ETAPAS_EN_CURSO } }, select: { id: true, etapa: true, motor: true } })
      : null,
  ]);
  const pendiente = viaje ? (viaje.motor as { pendiente?: unknown } | null)?.pendiente : null;
  return { n: noLeidas + alertas, ultima, viaje: viaje ? `${viaje.id}:${viaje.etapa}:${pendiente ? "confirmar" : ""}` : null };
}
