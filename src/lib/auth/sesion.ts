import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Rol } from "@prisma/client";
import { db } from "@/lib/db";
import { puede, type Permiso } from "@/lib/permisos";
import { COOKIE_SESION, DIAS_SESION, firmar, verificar } from "./jwt";

export type UsuarioSesion = { id: string; nombre: string; email: string; rol: Rol };

/**
 * Sesión actual, confirmada contra la base (si lo desactivan, pierde el acceso en el acto).
 * Se resuelve una sola vez por request.
 */
export const obtenerSesion = cache(async (): Promise<UsuarioSesion | null> => {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  const s = await verificar(token);
  if (!s) return null;
  const u = await db.usuario.findUnique({
    where: { id: s.usuarioId },
    select: { id: true, nombre: true, email: true, rol: true, activo: true },
  });
  if (!u?.activo) return null;
  return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol };
});

/**
 * Para páginas, queries y acciones: sin sesión, al login.
 * "?salir=1" hace que el middleware borre la cookie: si el token es válido pero el
 * usuario fue desactivado, sin esto quedaría rebotando entre /login e /inicio.
 */
export async function exigirSesion(): Promise<UsuarioSesion> {
  const u = await obtenerSesion();
  if (!u) redirect("/login?salir=1");
  return u;
}

/** Sin el permiso, vuelve a su inicio. Usar al principio de cada query y Server Action. */
export async function exigirPermiso(permiso: Permiso): Promise<UsuarioSesion> {
  const u = await exigirSesion();
  if (!puede(u.rol, permiso)) redirect("/inicio?sin-permiso=1");
  return u;
}

export async function abrirSesion(u: { id: string; rol: Rol; nombre: string }) {
  (await cookies()).set(COOKIE_SESION, await firmar({ usuarioId: u.id, rol: u.rol, nombre: u.nombre }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DIAS_SESION * 86_400,
  });
}

export async function cerrarSesionCookie() {
  (await cookies()).delete(COOKIE_SESION);
}
