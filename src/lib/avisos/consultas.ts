import "server-only";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { filtroDestinatario } from "@/lib/alertas/destinatarios";

/** Lo que cuenta la campana: avisos personales sin leer + alertas suyas sin ver. */
export async function contarAvisos() {
  const u = await exigirPermiso("avisos.ver");
  const [notificaciones, alertas] = await Promise.all([
    db.notificacion.count({ where: { usuarioId: u.id, leidaEn: null } }),
    db.alerta.count({ where: { ...filtroDestinatario(u), estado: "ABIERTA" } }),
  ]);
  return notificaciones + alertas;
}

/** /avisos: los avisos de la persona (últimos 50) y las alertas que la tienen como destinataria. */
export async function misAvisos() {
  const u = await exigirPermiso("avisos.ver");
  const [notificaciones, alertas] = await Promise.all([
    // No leídas primero, después las más nuevas.
    db.notificacion.findMany({ where: { usuarioId: u.id }, orderBy: [{ leidaEn: { sort: "desc", nulls: "first" } }, { creadaEn: "desc" }], take: 60 }),
    db.alerta.findMany({ where: { ...filtroDestinatario(u), estado: { not: "RESUELTA" } }, orderBy: [{ severidad: "desc" }, { creadaEn: "desc" }], take: 50 }),
  ]);
  return { notificaciones, alertas };
}
