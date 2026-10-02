import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso, type UsuarioSesion } from "@/lib/auth/sesion";

/**
 * Cada rol ve las suyas:
 * - Dirección y Administración: todas.
 * - Capataz: pedidos, viajes y herramientas de todas las obras.
 * - Responsable de obra: las de sus obras.
 * - Chofer: las que lo nombran a él (licencia, sus viajes, su camioneta).
 * - Depósito: herramientas y flota (services, documentación).
 */
async function alcance(u: UsuarioSesion): Promise<Prisma.AlertaWhereInput> {
  switch (u.rol) {
    case "DIRECCION":
    case "ADMINISTRACION":
      return {};
    case "CAPATAZ":
      return { entidadTipo: { in: ["PedidoViaje", "Viaje", "Herramienta"] } };
    case "RESPONSABLE_OBRA": {
      const obras = (await db.obra.findMany({ where: { responsableId: u.id }, select: { id: true } })).map((o) => o.id);
      return { OR: [{ obraId: { in: obras } }, { usuarioId: u.id }] };
    }
    case "CHOFER":
      return { usuarioId: u.id };
    case "DEPOSITO":
      return { entidadTipo: { in: ["Herramienta", "Vehiculo", "CargaCombustible"] } };
  }
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
