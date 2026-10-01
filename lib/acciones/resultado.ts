import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { ErrorPermiso } from "@/lib/auth/usuario-actual";

export type Resultado<T = null> = { ok: true; datos: T } | { ok: false; error: string };

/** Error de negocio con mensaje claro para mostrar tal cual. */
export class ErrorNegocio extends Error {}

/** Convierte cualquier error en un mensaje entendible. */
export function aMensaje(e: unknown): string {
  if (e instanceof ErrorNegocio || e instanceof ErrorPermiso) return e.message;
  if (e instanceof ZodError) return e.issues[0]?.message ?? "Revisá los datos.";
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") {
      const campos = String((e.meta as { target?: unknown })?.target ?? "");
      if (campos.includes("en_curso")) return "Ya hay un viaje en curso con ese chofer o vehículo.";
      if (campos.includes("patente")) return "Ya existe un vehículo con esa patente.";
      if (campos.includes("usuario")) return "Ese nombre de usuario ya está en uso.";
      if (campos.includes("codigo")) return "Ya existe un ítem con ese código.";
      return "Ese dato ya existe.";
    }
    if (e.code === "P2025") return "No se encontró lo que buscabas. Puede que alguien lo haya cambiado.";
  }
  const texto = e instanceof Error ? e.message : String(e);
  if (texto.includes("en_curso")) return "Ya hay un viaje en curso con ese chofer o vehículo.";
  if (texto.includes("km_llegada")) return "Los km de llegada no pueden ser menores que los de salida.";
  console.error(e);
  return "No se pudo completar. Probá de nuevo.";
}

export async function ejecutar<T>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, datos: await fn() };
  } catch (e) {
    return { ok: false, error: aMensaje(e) };
  }
}
