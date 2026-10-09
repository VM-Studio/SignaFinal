import type { EstadoViaje, EtapaViaje } from "@prisma/client";

/** Orden del ciclo: el chofer avanza de a una etapa. */
export const ETAPAS: EtapaViaje[] = ["PROGRAMADO", "HACIA_RETIRO", "EN_RETIRO", "HACIA_DESTINO", "EN_DESTINO", "FINALIZADO"];

/** El estado (compatibilidad) se deriva de la etapa. CANCELADO no es una etapa: se pone aparte. */
export const ESTADO_DE_ETAPA: Record<EtapaViaje, EstadoViaje> = {
  PROGRAMADO: "PROGRAMADO",
  HACIA_RETIRO: "EN_CURSO",
  EN_RETIRO: "EN_CURSO",
  HACIA_DESTINO: "EN_CURSO",
  EN_DESTINO: "EN_CURSO",
  FINALIZADO: "FINALIZADO",
};

/** Para escribir un viaje: etapa y estado siempre juntos. */
export const conEtapa = (etapa: EtapaViaje) => ({ etapa, estado: ESTADO_DE_ETAPA[etapa] });

export const ETAPAS_EN_CURSO: EtapaViaje[] = ["HACIA_RETIRO", "EN_RETIRO", "HACIA_DESTINO", "EN_DESTINO"];
/** Etapas en las que el motor mira el GPS. */
export const ETAPAS_CON_MOTOR: EtapaViaje[] = ["HACIA_RETIRO", "EN_RETIRO", "HACIA_DESTINO"];
