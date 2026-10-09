/** Color por estado del vehículo (sin Leaflet: se usa también en el servidor). */
export const COLOR_ESTADO = { EN_VIAJE: "#1F7A4D", DISPONIBLE: "#6b6b66", EN_TALLER: "#000000", FUERA_DE_SERVICIO: "#000000" } as const;

/** Viajes del sistema superpuestos al recorrido del historial (uno por color, en orden). */
export const COLORES_VIAJE = ["#1F7A4D", "#B7791F", "#2B59C3", "#7A1F6B", "#B42318"] as const;

/** Posición vieja (más de 10 minutos sin reportar): gris. */
export const COLOR_VIEJO = "#a3a39e";
