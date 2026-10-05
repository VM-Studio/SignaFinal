import "server-only";
import { headers } from "next/headers";

/** Tamaño de página: 20 en el celular, 50 en la compu. */
export async function tamanoPagina() {
  const ua = (await headers()).get("user-agent") ?? "";
  return /Mobile|Android|iPhone|iPod/i.test(ua) ? 20 : 50;
}

/** Cuántas filas traer según "?n=" (cuántas veces tocó "Cargar más"). Se pide una de más para saber si hay más. */
export async function limiteDe(n?: string) {
  const tam = await tamanoPagina();
  const veces = Math.min(20, Math.max(1, Number(n) || 1));
  return { limite: tam * veces, siguiente: veces + 1 };
}
