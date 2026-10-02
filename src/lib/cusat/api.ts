import "server-only";
import type { ClienteCusat, PosicionCusat } from "./tipos";

/**
 * ════════════════════════════════════════════════════════════════════════
 *  ACÁ VA LA LLAMADA REAL A LA API DE CUSAT (cuando llegue la documentación).
 * ════════════════════════════════════════════════════════════════════════
 * Variables: CUSAT_API_URL, CUSAT_API_KEY (Vercel → Settings → Environment Variables).
 * Con CUSAT_API_URL configurada, lib/cusat/index.ts usa esta clase en lugar del simulador.
 *
 * Qué tiene que hacer cada método:
 *  - obtenerPosicionesActuales(): pedir la última posición de todos los equipos y
 *    traducir cada una a PosicionCusat buscando el vehículo por su idCusat.
 *  - obtenerHistorial(): pedir las posiciones de un equipo entre dos fechas.
 */
export class CusatApi implements ClienteCusat {
  readonly origen = "api" as const;

  constructor(private readonly url: string, private readonly clave?: string) {}

  async obtenerPosicionesActuales(): Promise<PosicionCusat[]> {
    // TODO Cusat: GET {url}/... con la clave y mapear la respuesta (idCusat → vehiculoId).
    throw new Error(`Cusat todavía no está conectado (${this.url}). Completar lib/cusat/api.ts.`);
  }

  async obtenerHistorial(vehiculoId: string, desde: Date, hasta: Date): Promise<PosicionCusat[]> {
    // TODO Cusat: GET {url}/... del equipo del vehículo entre desde y hasta.
    void vehiculoId; void desde; void hasta; void this.clave;
    throw new Error("Cusat todavía no está conectado. Completar lib/cusat/api.ts.");
  }
}
