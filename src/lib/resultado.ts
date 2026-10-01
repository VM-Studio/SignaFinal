import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export type Resultado<T = null> = { ok: true; datos: T } | { ok: false; error: string };

/** Error de negocio: el mensaje se muestra tal cual. */
export class ErrorNegocio extends Error {}

export function aMensaje(e: unknown): string {
  if (e instanceof ErrorNegocio) return e.message;
  if (e instanceof ZodError) return e.issues[0]?.message ?? "Revisá los datos.";
  const texto = e instanceof Error ? e.message : String(e);
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    if (texto.includes("en_curso")) return "Ya hay un viaje en curso con ese chofer o vehículo.";
    return "Ese dato ya existe.";
  }
  if (texto.includes("en_curso")) return "Ya hay un viaje en curso con ese chofer o vehículo.";
  console.error(e);
  return "No se pudo completar. Probá de nuevo.";
}

/**
 * Corre una Server Action y devuelve {ok, datos} o {ok:false, error}.
 * Los redirect de Next (sesión vencida, sin permiso) se dejan pasar.
 */
export async function ejecutar<T>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, datos: await fn() };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
    return { ok: false, error: aMensaje(e) };
  }
}
