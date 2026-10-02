import "server-only";
import type { ClienteCusat } from "./tipos";
import { CusatMock } from "./mock";
import { CusatApi } from "./api";

export type * from "./tipos";

/** Punto de entrada único: la API real si está configurada; si no, el simulador. */
export function clienteCusat(): ClienteCusat {
  return process.env.CUSAT_API_URL ? new CusatApi(process.env.CUSAT_API_URL, process.env.CUSAT_API_KEY) : new CusatMock();
}
