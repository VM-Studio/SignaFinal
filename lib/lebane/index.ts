import type { ClienteLebane } from "./tipos";
import { LebaneMock } from "./mock";

export type * from "./tipos";

/**
 * Punto de entrada único. Cuando llegue el acceso a la API:
 * 1. Crear lib/lebane/api.ts que implemente ClienteLebane.
 * 2. Devolverlo acá si LEBANE_API_URL está configurada.
 */
export function clienteLebane(): ClienteLebane {
  return new LebaneMock();
}
