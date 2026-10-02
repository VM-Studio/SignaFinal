/**
 * Contrato con Cusat (rastreo satelital). Cada vehículo con GPS tiene idCusat.
 * Hoy lo cumple un simulador (mock.ts). Cuando llegue la documentación de la API,
 * se completa api.ts y no cambia nada más de la app.
 */

export type PosicionCusat = {
  vehiculoId: string;
  latitud: number;
  longitud: number;
  velocidad: number; // km/h
  rumbo: number; // grados, 0 = norte
  motorEncendido: boolean;
  fecha: Date;
};

export interface ClienteCusat {
  readonly origen: "mock" | "api";
  /** Última posición de cada vehículo con equipo Cusat. */
  obtenerPosicionesActuales(): Promise<PosicionCusat[]>;
  /** Recorrido de un vehículo entre dos instantes. */
  obtenerHistorial(vehiculoId: string, desde: Date, hasta: Date): Promise<PosicionCusat[]>;
}
