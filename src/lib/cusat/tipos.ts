/**
 * Contrato con el rastreo satelital (Cusat View, de Suartec). Dos implementaciones:
 * - cusatView.ts: la web real de Cusat (docs/cusat/api-descubierta.md).
 * - mock.ts: simulador, para desarrollo y demo.
 * Se elige con CUSAT_MODO=mock|cusatview (index.ts). Ninguna lanza: devuelven { ok: false, error }.
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

/** Una unidad de Cusat con su última posición, ya normalizada. */
export type PosicionExterna = {
  /** unit_id de Cusat (en el mock, el id del vehículo). */
  idExterno: string;
  nombre: string;
  patente: string;
  latitud: number;
  longitud: number;
  velocidadKmh: number;
  rumbo: number;
  motorEncendido: boolean;
  fechaGps: Date;
  direccionTexto: string | null;
};

/** Un punto del recorrido de un día. */
export type PuntoHistorial = { latitud: number; longitud: number; velocidadKmh: number; fecha: Date };

/** Lo que devuelve "Probar conexión", para mostrar crudo y resumido. */
export type Prueba = { modo: ModoCusat; pasos: { paso: string; ok: boolean; detalle: string; ms: number }[] };

export type ModoCusat = "mock" | "cusatview";

export interface FuenteCusat {
  readonly modo: ModoCusat;
  obtenerPosicionesActuales(): Promise<Resultado<PosicionExterna[]>>;
  /** Recorrido de una unidad entre dos instantes, ordenado por fecha. */
  obtenerHistorial(idExterno: string, desde: Date, hasta: Date, patente?: string): Promise<Resultado<PuntoHistorial[]>>;
  /** Dirección en texto de una unidad (Cusat la calcula aparte). */
  obtenerDireccion?(idExterno: string): Promise<string | null>;
  probar(): Promise<Prueba>;
}

/** Posición ya enlazada a un vehículo de la base (la usan las geocercas y el motor de viajes). */
export type PosicionCusat = {
  vehiculoId: string;
  latitud: number;
  longitud: number;
  velocidad: number; // km/h
  rumbo: number; // grados, 0 = norte
  motorEncendido: boolean;
  fecha: Date;
};
