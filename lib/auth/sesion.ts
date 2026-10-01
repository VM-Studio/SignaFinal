import { SignJWT, jwtVerify } from "jose";
import type { Rol } from "@prisma/client";

/** Este módulo no usa Prisma ni APIs de Node: se usa también en el middleware. */

export const COOKIE_SESION = "signa_sesion";
export const DURACION_SESION_DIAS = 30;

export type DatosSesion = {
  sub: string; // id de usuario
  rol: Rol;
  nombre: string;
};

function clave() {
  const secreto = process.env.AUTH_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new Error("AUTH_SECRET no está configurado (mínimo 32 caracteres).");
  }
  return new TextEncoder().encode(secreto);
}

export async function firmarSesion(datos: DatosSesion): Promise<string> {
  return new SignJWT({ rol: datos.rol, nombre: datos.nombre })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(datos.sub)
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SESION_DIAS}d`)
    .sign(clave());
}

export async function verificarSesion(token: string | undefined): Promise<DatosSesion | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.rol !== "string") return null;
    return { sub: payload.sub, rol: payload.rol as Rol, nombre: String(payload.nombre ?? "") };
  } catch {
    return null;
  }
}
