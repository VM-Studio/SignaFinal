import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso, type UsuarioSesion } from "@/lib/auth/sesion";
import { idsObrasDelUsuario } from "@/lib/alcance";
import { filtroDestinatario } from "./destinatarios";

/** Cada uno ve solo las alertas que lo tienen como destinatario (matriz en ./destinatarios). */
async function alcance(u: UsuarioSesion): Promise<Prisma.AlertaWhereInput> {
  return filtroDestinatario(u, u.rol === "RESPONSABLE_OBRA" ? await idsObrasDelUsuario(u, true) : []);
}

export async function alertasAbiertas() {
  const u = await exigirPermiso("alertas.ver");
  return db.alerta.findMany({ where: { ...(await alcance(u)), estado: { not: "RESUELTA" } }, orderBy: [{ severidad: "desc" }, { creadaEn: "desc" }] });
}

export async function alertasResueltasRecientes() {
  const u = await exigirPermiso("alertas.ver");
  return db.alerta.findMany({ where: { ...(await alcance(u)), estado: "RESUELTA", resueltaEn: { gte: new Date(Date.now() - 7 * 86_400_000) } }, orderBy: { resueltaEn: "desc" }, take: 20 });
}

/** Para la campana: las abiertas que todavía no vio. */
export async function contarParaCampana() {
  const u = await exigirPermiso("alertas.ver");
  return db.alerta.count({ where: { ...(await alcance(u)), estado: "ABIERTA" } });
}

export async function contarCriticas() {
  const u = await exigirPermiso("alertas.ver");
  return db.alerta.count({ where: { ...(await alcance(u)), estado: { not: "RESUELTA" }, severidad: "CRITICA" } });
}
