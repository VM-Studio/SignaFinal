import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { puede, type Permiso } from "@/lib/permisos";
import { COOKIE_SESION, DURACION_SESION_DIAS, firmarSesion, verificarSesion } from "./sesion";

export type UsuarioActual = {
  id: string;
  nombre: string;
  usuario: string;
  rol: import("@prisma/client").Rol;
};

/** Lee la sesión y confirma contra la base que el usuario sigue activo. Una vez por request. */
export const obtenerUsuarioActual = cache(async (): Promise<UsuarioActual | null> => {
  const almacen = await cookies();
  const sesion = await verificarSesion(almacen.get(COOKIE_SESION)?.value);
  if (!sesion) return null;
  const usuario = await db.usuario.findUnique({
    where: { id: sesion.sub },
    select: { id: true, nombre: true, usuario: true, rol: true, activo: true },
  });
  if (!usuario || !usuario.activo) return null;
  return { id: usuario.id, nombre: usuario.nombre, usuario: usuario.usuario, rol: usuario.rol };
});

/** Para páginas: si no hay sesión, al login. Si no tiene permiso, a su inicio. */
export async function requerirUsuario(permiso?: Permiso): Promise<UsuarioActual> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");
  if (permiso && !puede(usuario.rol, permiso)) redirect("/inicio");
  return usuario;
}

export class ErrorPermiso extends Error {
  constructor(mensaje = "No tenés permiso para hacer esto.") {
    super(mensaje);
  }
}

/** Para server actions: nunca redirige, lanza un error que la acción convierte en mensaje. */
export async function autorizar(permiso?: Permiso): Promise<UsuarioActual> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new ErrorPermiso("Tu sesión terminó. Volvé a entrar.");
  if (permiso && !puede(usuario.rol, permiso)) throw new ErrorPermiso();
  return usuario;
}

export async function iniciarSesion(usuario: { id: string; rol: UsuarioActual["rol"]; nombre: string }) {
  const token = await firmarSesion({ sub: usuario.id, rol: usuario.rol, nombre: usuario.nombre });
  const almacen = await cookies();
  almacen.set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_SESION_DIAS * 24 * 60 * 60,
  });
}

export async function cerrarSesion() {
  const almacen = await cookies();
  almacen.delete(COOKIE_SESION);
}
