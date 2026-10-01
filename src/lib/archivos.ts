import "server-only";
import type { Prisma } from "@prisma/client";
import { ErrorNegocio } from "@/lib/resultado";

const TIPOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 3 * 1024 * 1024;

/**
 * Guarda un archivo que llega como data URL (la foto ya viene comprimida desde el teléfono)
 * y devuelve la URL con la que se sirve.
 */
export async function guardarArchivo(tx: Prisma.TransactionClient, dataUrl: string, subidoPorId: string, nombre?: string) {
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new ErrorNegocio("El archivo no se pudo leer. Probá sacar la foto de nuevo.");
  const [, tipo, base64] = m;
  if (!TIPOS.includes(tipo)) throw new ErrorNegocio("Solo se aceptan fotos o PDF.");
  const datos = Buffer.from(base64, "base64");
  if (datos.length > MAX_BYTES) throw new ErrorNegocio("El archivo es muy grande (máximo 3 MB).");
  const a = await tx.archivo.create({ data: { tipo, nombre: nombre ?? null, datos, tamano: datos.length, subidoPorId }, select: { id: true } });
  return `/api/archivos/${a.id}`;
}
