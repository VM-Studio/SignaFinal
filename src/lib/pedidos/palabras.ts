import type { EstadoPedido, EtapaViaje } from "@prisma/client";
import { hora } from "@/lib/formato";

type Viaje = {
  etapa: EtapaViaje;
  salidaEstimada: Date | null;
  etaRetiro: Date | null;
  etaDestino: Date | null;
  llegadaReal: Date | null;
  llegadaDestinoEn: Date | null;
} | null;

/**
 * El estado de un pedido como lo dice una persona:
 * "Pendiente, lo ven los choferes" · "Aceptado por Claudio · sale 8:30" ·
 * "En viaje · llega 10:40 aprox" · "Entregado 10:15".
 */
export function estadoEnPalabras(p: { estado: EstadoPedido; tomadoPor?: { nombre: string } | null; viaje?: Viaje }) {
  const v = p.viaje;
  switch (p.estado) {
    case "PENDIENTE":
      return "Pendiente, lo ven los choferes";
    case "TOMADO":
      return `Aceptado por ${p.tomadoPor?.nombre ?? "un chofer"}${v?.salidaEstimada ? ` · sale ${hora(v.salidaEstimada)}` : ""}`;
    case "EN_VIAJE":
      return v?.etaDestino ? `En viaje · llega ${hora(v.etaDestino)} aprox` : `En viaje con ${p.tomadoPor?.nombre ?? "el chofer"}`;
    case "ENTREGADO": {
      const llego = v?.llegadaDestinoEn ?? v?.llegadaReal;
      return llego ? `Entregado ${hora(llego)}` : "Entregado";
    }
    case "CANCELADO":
      return "Cancelado";
  }
}

/** La etapa del viaje en palabras: "Yendo a retirar a Corralón Munro", "En camino a la obra". */
export function etapaEnPalabras(etapa: EtapaViaje, origen: string, salidaEstimada?: Date | null) {
  switch (etapa) {
    case "PROGRAMADO":
      return salidaEstimada ? "Aceptado" : "Aceptado, todavía no salió";
    case "HACIA_RETIRO":
      return `Yendo a retirar a ${origen}`;
    case "EN_RETIRO":
      return `Cargando en ${origen}`;
    case "HACIA_DESTINO":
      return "En camino a la obra";
    case "FINALIZADO":
      return "Entregado";
  }
}

/** La hora que importa según la etapa: salida, llegada al retiro o a la obra. */
export function horaEstimada(v: NonNullable<Viaje>) {
  if (v.etapa === "PROGRAMADO") return v.salidaEstimada ? `sale ${hora(v.salidaEstimada)}` : null;
  if (v.etapa === "HACIA_RETIRO") return v.etaRetiro ? `llega al retiro ${hora(v.etaRetiro)}` : null;
  if (v.etapa === "FINALIZADO") return v.llegadaDestinoEn ?? v.llegadaReal ? `llegó ${hora((v.llegadaDestinoEn ?? v.llegadaReal)!)}` : null;
  return v.etaDestino ? `llega ${hora(v.etaDestino)} aprox` : null;
}
