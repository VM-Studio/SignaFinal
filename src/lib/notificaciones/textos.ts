import { dia, hora } from "@/lib/formato";
import { metros } from "@/lib/rutas";

/** "Hierro del 10, 40 barras" → "hierro del 10": lo que se lleva, corto y en minúscula, para frases. */
export function queLleva(descripcion: string) {
  const corta = descripcion.split(/[,(·]/)[0].trim();
  const t = corta.length > 40 ? `${corta.slice(0, 40).trim()}…` : corta;
  return t.charAt(0).toLowerCase() + t.slice(1);
}

/** "el Camión Kia", "la Oroch". */
const conArticulo = (vehiculo: string) => `${/^(camioneta|oroch|kangoo|zanella)/i.test(vehiculo) ? "la" : "el"} ${vehiculo}`;

type P = { descripcion: string; destino: string };

export const TEXTO = {
  aceptado: (chofer: string, p: P & { salida: Date; vehiculo: string }) => ({
    titulo: `${chofer} aceptó tu pedido`,
    cuerpo: `${chofer} aceptó tu pedido de ${queLleva(p.descripcion)} para ${p.destino}. Sale ${hora(p.salida)} aprox con ${conArticulo(p.vehiculo)}.`,
  }),
  iniciado: (chofer: string, p: P & { origen: string; distanciaM: number; etaRetiro: Date; etaDestino: Date }) => ({
    titulo: `${chofer} salió a buscar tu pedido`,
    cuerpo: `${chofer} salió a buscar tu pedido. Está a ${metros(p.distanciaM)} de ${p.origen}, llega al retiro ${hora(p.etaRetiro)} y a ${p.destino} ${hora(p.etaDestino)} aprox.`,
  }),
  enRetiro: (chofer: string, p: P & { origen: string; distanciaM: number; etaDestino: Date }) => ({
    titulo: `${chofer} está cargando tu pedido`,
    cuerpo: `${chofer} llegó a ${p.origen} y está cargando tu pedido. Llega a ${p.destino} ${hora(p.etaDestino)} aprox (${metros(p.distanciaM)}).`,
  }),
  entregado: (p: P & { llego: Date }) => ({
    titulo: `Llegó tu pedido a ${p.destino}`,
    cuerpo: `Tu pedido de ${queLleva(p.descripcion)} llegó a ${p.destino} a las ${hora(p.llego)}.`,
  }),
  soltado: (chofer: string) => ({
    titulo: `${chofer} soltó tu pedido`,
    cuerpo: `${chofer} soltó tu pedido, vuelve a estar pendiente.`,
  }),
  cancelado: (quien: string, p: P & { motivo: string }) => ({
    titulo: `${quien} canceló un pedido que ibas a llevar`,
    cuerpo: `${quien} canceló el pedido de ${queLleva(p.descripcion)} para ${p.destino}. Motivo: ${p.motivo}.`,
  }),
  urgente: (quien: string, p: P & { origen: string; paraCuando: Date }) => ({
    titulo: "Solicitud urgente",
    cuerpo: `${quien} necesita ${queLleva(p.descripcion)} en ${p.destino} para ${dia(p.paraCuando)} ${hora(p.paraCuando)}. Retirar en ${p.origen}.`,
  }),
  demora: (chofer: string, eta: Date) => ({
    titulo: `${chofer} viene con demora`,
    cuerpo: `${chofer} viene con demora, ahora llega ${hora(eta)} aprox.`,
  }),
  resumenDia: (viajes: { salida: Date | null; descripcion: string; destino: string }[]) => ({
    titulo: viajes.length === 1 ? "Hoy tenés 1 viaje" : `Hoy tenés ${viajes.length} viajes`,
    cuerpo: viajes.map((v) => `${v.salida ? hora(v.salida) : "Sin hora"} ${queLleva(v.descripcion)} → ${v.destino}`).join(" · "),
  }),
};
