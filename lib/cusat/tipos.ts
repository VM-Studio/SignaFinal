/**
 * Contrato con Cusat (rastreo satelital). Cada vehículo con GPS tiene idCusat.
 * Cuando llegue el acceso se implementa ClienteCusat contra la API real.
 */

export type PosicionCusat = {
  idCusat: string;
  lat: number;
  lng: number;
  velocidadKmh: number;
  rumbo: number; // grados, 0 = norte
  motorEncendido: boolean;
  registradaEn: string; // ISO
};

export interface ClienteCusat {
  readonly origen: "mock" | "api";
  posicionesActuales(idsCusat: string[]): Promise<PosicionCusat[]>;
  historial(idCusat: string, desde: Date, hasta: Date): Promise<PosicionCusat[]>;
}
