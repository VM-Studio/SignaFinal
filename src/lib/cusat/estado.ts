import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/** Claves de EstadoSistema que usa el rastreo. */
export const CLAVE = {
  ultimaSync: "cusat.ultimaSync",
  ultimoError: "cusat.ultimoError",
  sinEnlazar: "cusat.sinEnlazar",
  historial: (vehiculoId: string, dia: string) => `cusat.historial.${vehiculoId}.${dia}`,
} as const;

export type UltimaSync = { fecha: string; modo: string; recibidas: number; enlazadas: number; nuevas: number; ms: number };
export type UltimoError = { fecha: string; error: string };
export type SinEnlazar = { idExterno: string; nombre: string; patente: string; lat: number; lng: number; fechaGps: string }[];

export async function leerEstado<T>(clave: string): Promise<{ valor: T; actualizadoEn: Date } | null> {
  const e = await db.estadoSistema.findUnique({ where: { clave } });
  return e ? { valor: e.valor as T, actualizadoEn: e.actualizadoEn } : null;
}

export async function guardarEstado(clave: string, valor: unknown) {
  const v = valor as Prisma.InputJsonValue;
  await db.estadoSistema.upsert({ where: { clave }, create: { clave, valor: v }, update: { valor: v } });
}
