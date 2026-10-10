import type { EstadoOC, MetodoPago } from "@prisma/client";
import type { Tono } from "@/lib/etiquetas";

/**
 * Ciclo de la ORDEN DE COMPRA (puro: lo usan las actions y los tests).
 *
 *   BORRADOR ──enviar──▶ ESPERANDO_APROBACION ──aprobar──▶ APROBADA
 *      │                        │   ▲ (deshacer, 2 min)      │
 *      └──anular──▶ ANULADA ◀───┘   └────────────────────────┤
 *                               └──rechazar──▶ RECHAZADA     └──anular (sin habilitar)──▶ ANULADA
 *
 * RECHAZADA y ANULADA no vuelven: "Corregir y reenviar" crea una OC nueva (número nuevo).
 */
export const TRANSICIONES_OC: Record<EstadoOC, EstadoOC[]> = {
  BORRADOR: ["ESPERANDO_APROBACION", "ANULADA"],
  ESPERANDO_APROBACION: ["APROBADA", "RECHAZADA", "ANULADA"],
  APROBADA: ["ESPERANDO_APROBACION", "ANULADA"],
  RECHAZADA: [],
  ANULADA: [],
};

export const puedePasar = (de: EstadoOC, a: EstadoOC) => TRANSICIONES_OC[de].includes(a);

/** Mientras está en uno de estos estados, la OC es la vigente del pedido. */
export const OC_VIGENTE: EstadoOC[] = ["BORRADOR", "ESPERANDO_APROBACION", "APROBADA"];

export const ESTADO_OC: Record<EstadoOC, { titulo: string; tono: Tono }> = {
  BORRADOR: { titulo: "Borrador", tono: "neutro" },
  ESPERANDO_APROBACION: { titulo: "Esperando aprobación", tono: "aviso" },
  APROBADA: { titulo: "Aprobada", tono: "ok" },
  RECHAZADA: { titulo: "Rechazada", tono: "critico" },
  ANULADA: { titulo: "Anulada", tono: "neutro" },
};

export const METODO_PAGO: Record<MetodoPago, string> = {
  ACOPIO: "Acopio",
  CUENTA_CORRIENTE: "Cuenta corriente",
  TRANSFERENCIA: "Transferencia",
  EFECTIVO: "Efectivo",
  ECHEQ: "eCheq",
};

export type RenglonCalculo = { cantidad: number; precioUnitario: number | null };

/**
 * Totales: subtotal de los renglones con precio, IVA (21 % por defecto, editable, o null = sin IVA)
 * y total. Sin ningún precio cargado, no hay totales: el PDF dice "Según presupuesto adjunto".
 */
export function calcularTotales(renglones: RenglonCalculo[], ivaPorcentaje: number | null) {
  const conPrecio = renglones.filter((r) => r.precioUnitario != null && Number.isFinite(r.precioUnitario));
  if (!conPrecio.length) return { conPrecios: false as const, subtotal: null, iva: null, total: null };
  const redondear = (n: number) => Math.round(n * 100) / 100;
  const subtotal = redondear(conPrecio.reduce((s, r) => s + r.cantidad * (r.precioUnitario as number), 0));
  const iva = ivaPorcentaje == null ? 0 : redondear((subtotal * ivaPorcentaje) / 100);
  return { conPrecios: true as const, subtotal, iva, total: redondear(subtotal + iva) };
}

/** "40 bolsas cemento + 3 ítems": lo que entra en el aviso al dueño. */
export function resumenRenglones(renglones: { descripcion: string; cantidad: number; unidad: string }[]) {
  if (!renglones.length) return "según presupuesto adjunto";
  const [r] = renglones;
  const primero = `${r.cantidad.toLocaleString("es-AR")} ${r.unidad} ${r.descripcion}`.replace(/\s+/g, " ").trim();
  return renglones.length > 1 ? `${primero} + ${renglones.length - 1} ${renglones.length === 2 ? "ítem" : "ítems"}` : primero;
}
