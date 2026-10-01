import { SignJWT, jwtVerify } from "jose";
import type { Rol } from "@prisma/client";

/** Sin Prisma ni APIs de Node: también lo usa el middleware. */

export const COOKIE_SESION = "signa_sesion";
/** 30 días: es gente que no quiere loguearse todos los días. */
export const DIAS_SESION = 30;

export type Sesion = { usuarioId: string; rol: Rol; nombre: string };

function clave() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("Falta AUTH_SECRET (mínimo 32 caracteres).");
  return new TextEncoder().encode(s);
}

export function firmar(s: Sesion) {
  return new SignJWT({ rol: s.rol, nombre: s.nombre })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.usuarioId)
    .setIssuedAt()
    .setExpirationTime(`${DIAS_SESION}d`)
    .sign(clave());
}

export async function verificar(token?: string): Promise<Sesion | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.rol !== "string") return null;
    return { usuarioId: payload.sub, rol: payload.rol as Rol, nombre: String(payload.nombre ?? "") };
  } catch {
    return null;
  }
}
