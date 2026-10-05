import "server-only";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { idsObrasDelUsuario } from "@/lib/alcance";
import { filtroDestinatario } from "@/lib/alertas/destinatarios";

/** Lo que cuenta la campana: avisos personales sin leer + alertas suyas sin ver. */
export async function contarAvisos() {
  const u = await exigirPermiso("avisos.ver");
  const misObras = u.rol === "RESPONSABLE_OBRA" ? await idsObrasDelUsuario(u, true) : [];
  const [notificaciones, alertas] = await Promise.all([
    db.notificacion.count({ where: { usuarioId: u.id, leidaEn: null } }),
    db.alerta.count({ where: { ...filtroDestinatario(u, misObras), estado: "ABIERTA" } }),
  ]);
  return notificaciones + alertas;
}

/** /avisos: los avisos de la persona (últimos 50) y las alertas que la tienen como destinataria. */
export async function misAvisos() {
  const u = await exigirPermiso("avisos.ver");
  const misObras = u.rol === "RESPONSABLE_OBRA" ? await idsObrasDelUsuario(u, true) : [];
  const [notificaciones, alertas] = await Promise.all([
    db.notificacion.findMany({ where: { usuarioId: u.id }, orderBy: { creadaEn: "desc" }, take: 50 }),
    db.alerta.findMany({ where: { ...filtroDestinatario(u, misObras), estado: { not: "RESUELTA" } }, orderBy: [{ severidad: "desc" }, { creadaEn: "desc" }], take: 50 }),
  ]);
  return { notificaciones, alertas };
}
