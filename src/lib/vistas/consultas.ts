import "server-only";
import { db } from "@/lib/db";
import { exigirSesion } from "@/lib/auth/sesion";

export type Vista = { id: string; nombre: string; parametros: Record<string, string> };

/** Las vistas guardadas del usuario en una pantalla. */
export async function vistasDe(pantalla: string): Promise<Vista[]> {
  const u = await exigirSesion();
  const vs = await db.vistaGuardada.findMany({ where: { usuarioId: u.id, pantalla }, orderBy: { nombre: "asc" } });
  return vs.map((v) => ({ id: v.id, nombre: v.nombre, parametros: (v.parametros ?? {}) as Record<string, string> }));
}
