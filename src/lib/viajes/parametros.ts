/**
 * Parámetros del motor de viajes (src/lib/viajes/motor.ts). Se ajustan acá, en un solo lugar.
 * Distancias en metros, tiempos en milisegundos.
 */
export const PARAMETROS_MOTOR = {
  /** Llegó al retiro (si el retiro es una obra, vale el radio de su geocerca). */
  radioLlegadaM: 150,
  /** Se fue del retiro: más lejos que esto. */
  radioSalidaM: 300,
  /** Para contar como llegada tiene que estar casi quieto. */
  velocidadParadoKmh: 5,
  /** Lecturas seguidas adentro y quieto para dar por llegado (una sola puede ser ruido del GPS). */
  lecturasParaLlegar: 2,
  /** Una lectura con más antigüedad que esto no cuenta. */
  lecturaViejaMs: 3 * 60_000,
  /** Más rápido que esto entre dos lecturas es un salto del GPS: se descarta la segunda. */
  velocidadImposibleKmh: 150,
  /** Si Cusat reportó hace menos que esto, se usa Cusat y se ignora el teléfono. */
  cusatVigenteMs: 3 * 60_000,
  /** Sin ninguna posición en este tiempo: el viaje queda "sin señal" (solo avanzan los botones). */
  sinSenalMs: 5 * 60_000,
  /** Sin señal durante esto: se le avisa al que pidió. */
  avisoSinSenalMs: 10 * 60_000,
  /** El chofer puede decir "No, todavía no" a una llegada detectada durante este tiempo. */
  confirmarLlegadaMs: 5 * 60_000,
  /** Si el punto de retiro está a menos que esto de donde arranca, el viaje no tiene retiro: va directo a la obra. */
  mismoLugarM: 150,
} as const;

/**
 * Parámetros de los viajes con varias paradas (src/lib/viajes/paradas.ts y sugerencias al aceptar).
 * Distancias en metros.
 */
export const PARAMETROS_RUTEO = {
  /** Dos orígenes a menos de esto son "el mismo lugar" (mismo corralón, mismo galpón). */
  radioMismoLugarM: 200,
  /** Un pedido cuyo origen o destino queda a menos de esto de una parada del viaje está "cerca de tu camino". */
  radioCercaM: 3000,
  /** Desvío máximo que se le propone al chofer para sumar un pedido. */
  desvioMaximoM: 5000,
  /** Paradas como máximo en un viaje. */
  maxParadasPorViaje: 8,
} as const;

/** Minutos y hora de llegada solo con un proveedor que sepa el tránsito (Google). Sin eso, solo distancia. */
export const mostrarMinutos = () => !!process.env.GOOGLE_MAPS_API_KEY;
