import { dia, hora } from "@/lib/formato";
import { metros } from "@/lib/rutas";

/** "Hierro del 10, 40 barras" → "hierro del 10": lo que se lleva, corto y en minúscula, para frases. */
export function queLleva(descripcion: string) {
  const corta = descripcion.split(/[,(·]/)[0].trim();
  const t = corta.length > 40 ? `${corta.slice(0, 40).trim()}…` : corta;
  return t.charAt(0).toLowerCase() + t.slice(1);
}

/** "el Camión Kia", "la Oroch". */
/** "del Camión Mercedes 710", "de la Oroch". */
const delVehiculo = (vehiculo: string) => conArticulo(vehiculo).replace(/^el /, "del ").replace(/^la /, "de la ");
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
  salioDelRetiro: (chofer: string, p: P & { distanciaM: number; etaDestino: Date | null }) => ({
    titulo: `${chofer} va camino a ${p.destino}`,
    cuerpo: `${chofer} salió hacia ${p.destino} con tu pedido${p.etaDestino ? `, llega ${hora(p.etaDestino)} aprox` : ""} (${metros(p.distanciaM)}).`,
  }),
  llegoAlDestino: (chofer: string, p: P & { llego: Date }) => ({
    titulo: `Tu pedido llegó a ${p.destino}`,
    cuerpo: `${chofer} llegó a ${p.destino} con tu pedido de ${queLleva(p.descripcion)} a las ${hora(p.llego)}.`,
  }),
  sinSenal: (vehiculo: string, desde: Date) => ({
    titulo: `Sin señal ${delVehiculo(vehiculo)}`,
    cuerpo: `No tenemos señal ${delVehiculo(vehiculo)} desde las ${hora(desde)}. Cuando vuelva, el seguimiento sigue solo.`,
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

/** "OC 3141", "#3141" o "3141" → "OC #3141". */
export const oc = (n: string | null | undefined) => (n ? `OC #${n.replace(/^\s*(OC)?\s*#?\s*/i, "")}` : "la OC");

type M = { que: string; obra: string };

/** Avisos del circuito de Compras (pedidos de material). */
/** Las primeras palabras de una nota, para que entre en el aviso: "Descargar por Darwin, el portón de…". */
export function primerasPalabras(t: string, n = 10) {
  const p = t.trim().replace(/\s+/g, " ").split(" ");
  return p.length <= n ? p.join(" ") : `${p.slice(0, n).join(" ")}…`;
}

export const TEXTO_MATERIAL = {
  nuevo: (quien: string, p: M & { para: string; urgente: boolean; observaciones?: string | null; adjuntos?: number }) => ({
    titulo: p.urgente ? "Pedido de material urgente" : "Pedido de material nuevo",
    cuerpo: `${quien} pidió ${queLleva(p.que)} para Obra ${p.obra}, ${p.para}${p.adjuntos ? `, con ${p.adjuntos === 1 ? "1 archivo adjunto" : `${p.adjuntos} archivos adjuntos`}` : ""}.${p.urgente ? " La obra se para sin esto." : ""}${p.observaciones ? ` Nota: "${primerasPalabras(p.observaciones)}"` : ""}`,
  }),
  tomado: (comprador: string, p: M) => ({
    titulo: "Compras tomó tu pedido",
    cuerpo: `${comprador} está comprando tu ${queLleva(p.que)} para Obra ${p.obra}.`,
  }),
  paraAprobar: (p: M & { oc: string | null; monto: string | null }) => ({
    titulo: `${oc(p.oc)} para aprobar`,
    cuerpo: `${oc(p.oc)}${p.monto ? ` de ${p.monto}` : ""} para Obra ${p.obra} espera tu aprobación (${queLleva(p.que)}).`,
  }),
  esperando: (p: M) => ({
    titulo: "Tu pedido espera la aprobación del dueño",
    cuerpo: `Compras armó la orden de compra de tu ${queLleva(p.que)} para Obra ${p.obra}. Falta que la apruebe el dueño.`,
  }),
  aprobado: (p: M & { oc: string | null; enPapel?: boolean }) => ({
    titulo: `Aprobado: ${queLleva(p.que)}`,
    cuerpo: `${p.enPapel ? "El dueño aprobó en papel" : "El dueño aprobó"} ${oc(p.oc)} de ${queLleva(p.que)} para Obra ${p.obra}. Falta que el proveedor lo tenga.`,
  }),
  rechazado: (p: M & { oc: string | null; motivo: string }) => ({
    titulo: `${oc(p.oc)} rechazada`,
    cuerpo: `El dueño rechazó ${oc(p.oc)} de ${queLleva(p.que)} para Obra ${p.obra}. Motivo: ${p.motivo}. Vuelve a "En compra".`,
  }),
  listo: (p: M & { proveedor: string; horario: string | null }) => ({
    titulo: `Listo para retirar: ${queLleva(p.que)}`,
    cuerpo: `Tu ${queLleva(p.que)} para Obra ${p.obra} está listo para retirar en ${p.proveedor}${p.horario ? ` (${p.horario})` : ""}. Pedí el viaje cuando lo necesites.`,
  }),
  loLlevaElProveedor: (p: M & { proveedor: string; cuando: string | null }) => ({
    titulo: `${p.proveedor} lleva tu ${queLleva(p.que)}`,
    cuerpo: `${p.proveedor} entrega tu ${queLleva(p.que)} en Obra ${p.obra}${p.cuando ? ` ${p.cuando}` : ""}. No hace falta pedir viaje.`,
  }),
  enCamino: (p: M & { chofer: string; proveedor: string }) => ({
    titulo: `En camino: ${queLleva(p.que)}`,
    cuerpo: `${p.chofer} salió a retirar tu ${queLleva(p.que)} en ${p.proveedor} para Obra ${p.obra}.`,
  }),
  entregado: (p: M & { completo: boolean }) => ({
    titulo: `Entregado: ${queLleva(p.que)}`,
    cuerpo: `Llegó a Obra ${p.obra}: ${queLleva(p.que)}.${p.completo ? " El pedido está completo." : " Falta habilitar el resto del pedido."}`,
  }),
  vuelveAListo: (p: M & { proveedor: string; motivo: string }) => ({
    titulo: `Sin retirar: ${queLleva(p.que)}`,
    cuerpo: `${p.motivo}: ${queLleva(p.que)} para Obra ${p.obra} vuelve a estar listo para retirar en ${p.proveedor}.`,
  }),
  cancelado: (quien: string, p: M & { motivo: string }) => ({
    titulo: `Pedido de material cancelado`,
    cuerpo: `${quien} canceló el pedido de ${queLleva(p.que)} para Obra ${p.obra}. Motivo: ${p.motivo}.`,
  }),
};
