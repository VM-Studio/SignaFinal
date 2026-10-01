import type { ClienteCusat } from "./tipos";
import { CusatMock } from "./mock";

export type * from "./tipos";

/**
 * Punto de entrada único. Cuando llegue el acceso a Cusat:
 * 1. Crear lib/cusat/api.ts que implemente ClienteCusat.
 * 2. Devolverlo acá si CUSAT_API_URL está configurada.
 */
export function clienteCusat(): ClienteCusat {
  return new CusatMock();
}
