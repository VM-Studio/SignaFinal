import "server-only";
import type { Rol } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { inicioDelDia } from "@/lib/formato";

/** Actividad completa (Dirección): cada acción de cada usuario, lo último primero. */
export async function actividad(f: { rol?: Rol; usuarioId?: string; antesDe?: string }) {
  await exigirPermiso("actividad.ver");
  const filas = await db.auditoria.findMany({
    where: { ...(f.rol ? { rol: f.rol } : {}), ...(f.usuarioId ? { usuarioId: f.usuarioId } : {}), ...(f.antesDe ? { fecha: { lt: new Date(f.antesDe) } } : {}) },
    orderBy: { fecha: "desc" },
    take: 101,
    select: { id: true, fecha: true, rol: true, accion: true, resumen: true, usuarioId: true },
  });
  return { filas: filas.slice(0, 100), siguiente: filas.length > 100 ? filas[99].fecha.toISOString() : null };
}

export async function accionesDeHoy() {
  await exigirPermiso("actividad.ver");
  return db.auditoria.count({ where: { fecha: { gte: inicioDelDia() } } });
}

export async function personas() {
  await exigirPermiso("actividad.ver");
  return db.usuario.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } });
}
