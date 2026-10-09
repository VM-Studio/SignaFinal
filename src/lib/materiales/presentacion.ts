import type { EstadoMaterial, EstadoMaterialListo, ModoEntrega } from "@prisma/client";
import type { Tono } from "@/lib/etiquetas";

/** Los 8 pasos del circuito, en orden (la línea de tiempo del detalle). */
export const PASOS_MATERIAL: { estado: EstadoMaterial; titulo: string }[] = [
  { estado: "SOLICITADO", titulo: "Pedido" },
  { estado: "EN_COMPRA", titulo: "En compra" },
  { estado: "ESPERANDO_APROBACION", titulo: "Esperando aprobación" },
  { estado: "APROBADO", titulo: "Aprobado" },
  { estado: "LISTO_PARA_RETIRAR", titulo: "Listo para retirar" },
  { estado: "RETIRO_PEDIDO", titulo: "Retiro pedido" },
  { estado: "EN_CAMINO", titulo: "En camino" },
  { estado: "ENTREGADO", titulo: "Entregado" },
];

/** "3150", "OC 3150", "#3150" → "OC 3150". */
export const nroOC = (n: string | null | undefined) => (n ? `OC ${n.replace(/^\s*(OC)?\s*#?\s*/i, "")}` : null);

export const ordenEstado = (e: EstadoMaterial) => PASOS_MATERIAL.findIndex((p) => p.estado === e);

/** Estado corto para Compras (insignias y pestañas). */
export const ESTADO_MATERIAL: Record<EstadoMaterial, { titulo: string; tono: Tono }> = {
  SOLICITADO: { titulo: "Nuevo", tono: "aviso" },
  EN_COMPRA: { titulo: "En compra", tono: "activo" },
  ESPERANDO_APROBACION: { titulo: "Esperando aprobación", tono: "aviso" },
  APROBADO: { titulo: "Aprobado", tono: "neutro" },
  LISTO_PARA_RETIRAR: { titulo: "Listo para retirar", tono: "ok" },
  RETIRO_PEDIDO: { titulo: "Retiro pedido", tono: "activo" },
  EN_CAMINO: { titulo: "En camino", tono: "activo" },
  ENTREGADO: { titulo: "Entregado", tono: "ok" },
  CANCELADO: { titulo: "Cancelado", tono: "neutro" },
};

/** Lo que lee el que pidió: el estado en una frase. */
export function fraseMaterial(e: EstadoMaterial, extra: { proveedor?: string | null; llega?: string | null } = {}) {
  switch (e) {
    case "SOLICITADO": return "Pedido, lo ve Compras";
    case "EN_COMPRA": return "Compras lo está comprando";
    case "ESPERANDO_APROBACION": return "Esperando aprobación del dueño";
    case "APROBADO": return "Aprobado, falta que el proveedor lo tenga";
    case "LISTO_PARA_RETIRAR": return extra.proveedor ? `Listo para retirar en ${extra.proveedor}` : "Listo para retirar";
    case "RETIRO_PEDIDO": return "Retiro pedido";
    case "EN_CAMINO": return extra.llega ? `En camino · llega ${extra.llega}` : "En camino";
    case "ENTREGADO": return "Entregado";
    case "CANCELADO": return "Cancelado";
  }
}

export const ESTADO_LISTO: Record<EstadoMaterialListo, { titulo: string; tono: Tono }> = {
  LISTO: { titulo: "Listo, sin retiro pedido", tono: "ok" },
  RETIRO_PEDIDO: { titulo: "Retiro pedido", tono: "activo" },
  EN_CAMINO: { titulo: "En camino", tono: "activo" },
  ENTREGADO: { titulo: "Entregado", tono: "ok" },
  CANCELADO: { titulo: "Cancelado", tono: "neutro" },
};

export const MODO_ENTREGA: Record<ModoEntrega, string> = {
  RETIRA_CHOFER: "Lo retira un chofer",
  ENTREGA_PROVEEDOR: "Lo entrega el proveedor",
};

/** Pestañas de la cola de Compras. */
export const PESTANAS_COMPRAS = {
  nuevos: { titulo: "Nuevos", estados: ["SOLICITADO"] },
  "en-compra": { titulo: "En compra", estados: ["EN_COMPRA"] },
  esperando: { titulo: "Esperando aprobación", estados: ["ESPERANDO_APROBACION"] },
  aprobados: { titulo: "Aprobados", estados: ["APROBADO"] },
  listos: { titulo: "Listos", estados: ["LISTO_PARA_RETIRAR", "RETIRO_PEDIDO", "EN_CAMINO"] },
} as const satisfies Record<string, { titulo: string; estados: EstadoMaterial[] }>;
export type PestanaCompras = keyof typeof PESTANAS_COMPRAS;

const DIA = 86_400_000;

/** Días hábiles (lunes a viernes) completos entre dos momentos. */
export function diasHabiles(desde: Date, hasta: Date = new Date()) {
  if (hasta <= desde) return 0;
  let dias = 0;
  for (let t = desde.getTime() + DIA; t <= hasta.getTime(); t += DIA) {
    const d = new Date(t).getUTCDay(); // el corte de día no cambia el resultado por 3 h
    if (d !== 0 && d !== 6) dias++;
  }
  return dias;
}

/** Límites del circuito: más que esto, la fila va en rojo y salta la alerta. */
export const LIMITES = {
  /** SOLICITADO o EN_COMPRA: días hábiles. */
  compraDiasHabiles: 2,
  /** ESPERANDO_APROBACION: días corridos. */
  aprobacionDias: 1,
  /** MaterialListo en LISTO sin retiro pedido: días corridos. */
  sinRetirarDias: 3,
};

/** ¿Está demorado en su estado actual? */
export function demorado(estado: EstadoMaterial, desde: Date, ahora = new Date()) {
  if (estado === "SOLICITADO" || estado === "EN_COMPRA") return diasHabiles(desde, ahora) > LIMITES.compraDiasHabiles;
  if (estado === "ESPERANDO_APROBACION") return ahora.getTime() - desde.getTime() > LIMITES.aprobacionDias * DIA;
  return false;
}

export const diasDesde = (d: Date, ahora = new Date()) => Math.floor((ahora.getTime() - d.getTime()) / DIA);

/** "hoy", "hace 1 día", "hace 4 días". */
export function haceDias(d: Date) {
  const n = diasDesde(d);
  return n <= 0 ? "hoy" : n === 1 ? "hace 1 día" : `hace ${n} días`;
}

/** Pesos aproximados para un retiro (botones). */
export const PESOS_MATERIAL = [
  { kg: 200, titulo: "Poco (hasta 200 kg)" },
  { kg: 1000, titulo: "Hasta 1 tn" },
  { kg: 3000, titulo: "Hasta 3 tn" },
  { kg: 5000, titulo: "Más de 3 tn" },
] as const;
