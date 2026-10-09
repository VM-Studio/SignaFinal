import type { EstadoPedido, Franja, TipoPedido } from "@prisma/client";
import type { Tono } from "@/lib/etiquetas";
import { cuando, dia, hora } from "@/lib/formato";

/** Textos de pedidos para la gente. Puro: sirve en servidor y cliente. */

export const TIPOS_PARA_PEDIR: TipoPedido[] = [
  "RETIRO_PROVEEDOR",
  "TRASLADO_MAQUINARIA",
  "TRASLADO_HERRAMIENTAS",
  "LLEVAR_A_OBRA",
  "RETIRO_ESCOMBROS",
  "TRASLADO_PERSONAS",
];

export const TIPO: Record<TipoPedido, { titulo: string; corto: string; detalle: string }> = {
  RETIRO_PROVEEDOR: { titulo: "Retirar en un proveedor", corto: "Retiro", detalle: "Lo que Compras dejó listo para retirar" },
  TRASLADO_MAQUINARIA: { titulo: "Trasladar maquinaria", corto: "Maquinaria", detalle: "Hormigonera, andamio, generador…" },
  TRASLADO_HERRAMIENTAS: { titulo: "Trasladar herramientas", corto: "Herramientas", detalle: "Del depósito o de otra obra" },
  LLEVAR_A_OBRA: { titulo: "Llevar algo a la obra", corto: "Llevar", detalle: "Desde el depósito, la base u otra obra" },
  RETIRO_ESCOMBROS: { titulo: "Retirar escombros", corto: "Escombros", detalle: "Sacar escombros de la obra" },
  TRASLADO_PERSONAS: { titulo: "Llevar personas", corto: "Personas", detalle: "Gente de una obra a otra" },
  OTRO: { titulo: "Otro", corto: "Otro", detalle: "" },
};

export const FRANJA: Record<Franja, { titulo: string; hora: string }> = {
  MANANA: { titulo: "a la mañana", hora: "08:00" },
  TARDE: { titulo: "a la tarde", hora: "14:00" },
  HORA_EXACTA: { titulo: "", hora: "" },
};

/** "hoy a la mañana", "mañana 10:30". */
export function textoParaCuando(paraCuando: Date | string, franja: Franja) {
  return franja === "HORA_EXACTA" ? cuando(paraCuando) : `${dia(paraCuando)} ${FRANJA[franja].titulo}`;
}

export type EstadoMostrable = {
  estado: EstadoPedido;
  chofer?: string | null;
  salidaEstimada?: Date | string | null;
  llegadaReal?: Date | string | null;
};

/** Estado con palabras: "Aceptado por Claudio · sale 8:30", "En viaje · Cristian", "Entregado 10:15". */
export function textoEstado(p: EstadoMostrable): { texto: string; tono: Tono } {
  switch (p.estado) {
    case "PENDIENTE":
      return { texto: "Pendiente", tono: "aviso" };
    case "TOMADO": {
      const sale = p.salidaEstimada ? ` · sale ${diasDistintos(p.salidaEstimada) ? cuando(p.salidaEstimada) : hora(p.salidaEstimada)}` : "";
      return { texto: `Aceptado por ${p.chofer ?? "un chofer"}${sale}`, tono: "activo" };
    }
    case "EN_VIAJE":
      return { texto: `En viaje · ${p.chofer ?? ""}`.trim(), tono: "activo" };
    case "ENTREGADO":
      return { texto: p.llegadaReal ? `Entregado ${diasDistintos(p.llegadaReal) ? cuando(p.llegadaReal) : hora(p.llegadaReal)}` : "Entregado", tono: "ok" };
    case "CANCELADO":
      return { texto: "Cancelado", tono: "neutro" };
  }
}

function diasDistintos(d: Date | string) {
  return dia(d) !== "hoy";
}

export const MOTIVOS_CANCELACION = [
  "Ya no hace falta",
  "Lo trae el proveedor",
  "Lo resolvimos de otra forma",
  "Estaba duplicado",
];

/** Opciones de volumen para escombros, con el peso estimado que implican. */
export const VOLUMEN_ESCOMBROS = [
  { valor: "bolsas", titulo: "Unas bolsas", kg: 300 },
  { valor: "1m3", titulo: "Hasta 1 m³", kg: 1500 },
  { valor: "3m3", titulo: "Hasta 3 m³", kg: 4500 },
  { valor: "mas", titulo: "Más de 3 m³", kg: 5000 },
] as const;

export const PESOS = [
  { kg: 500, titulo: "Hasta 500 kg" },
  { kg: 1000, titulo: "Hasta 1 tn" },
  { kg: 3000, titulo: "Hasta 3 tn" },
  { kg: 5000, titulo: "Hasta 5 tn" },
] as const;

/** Por encima de esto, o si es maquinaria, hace falta camión. */
export const UMBRAL_CAMION_KG = 500;
