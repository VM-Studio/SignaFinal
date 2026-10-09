import "server-only";
import type { FuenteCusat, ModoCusat } from "./tipos";
import { CusatMock } from "./mock";
import { CusatView } from "./cusatView";

export type * from "./tipos";

/** CUSAT_MODO=cusatview usa la web real de Cusat (con CUSAT_WEB_USER y CUSAT_WEB_PASS); si no, el simulador. */
export function modoCusat(): ModoCusat {
  return process.env.CUSAT_MODO === "cusatview" && process.env.CUSAT_WEB_USER && process.env.CUSAT_WEB_PASS ? "cusatview" : "mock";
}

let fuente: FuenteCusat | null = null;

/** Punto de entrada único al rastreo. */
export function fuenteCusat(): FuenteCusat {
  if (!fuente || fuente.modo !== modoCusat()) fuente = modoCusat() === "cusatview" ? new CusatView() : new CusatMock();
  return fuente;
}
