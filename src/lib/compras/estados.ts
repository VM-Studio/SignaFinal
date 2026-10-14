import type { CondicionPago, EstadoOC, FormaPago, Moneda, TipoOrden } from "@prisma/client";
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

/** Vocabulario de la plantilla de Alejandra. */
export const TIPO_ORDEN: Record<TipoOrden, { corto: string; titulo: string; tituloPDF: string }> = {
  OC: { corto: "OC", titulo: "Orden de compra", tituloPDF: "ORDEN DE COMPRA" },
  PE: { corto: "PE", titulo: "Pedido especial", tituloPDF: "PEDIDO ESPECIAL" },
};

export const FORMA_PAGO: Record<FormaPago, string> = {
  TRANSFERENCIA: "Transferencia",
  ECHEQ: "Echeq",
  EFECTIVO: "Efectivo",
  CUENTA_CORRIENTE: "Cuenta corriente",
};

export const CONDICION_PAGO: Record<CondicionPago, string> = {
  ACOPIO: "Acopio",
  ANTICIPO: "Anticipo",
  SALDO_30_DIAS: "Saldo a 30 días",
  CONTRA_ENTREGA: "Contra entrega",
  OTRA: "Otra",
};

/** "Saldo a 30 días" · "Otra: 50 % anticipo" */
export const condicionPagoTexto = (c: CondicionPago | null, texto: string | null) =>
  !c ? texto || null : c === "OTRA" ? texto || "Otra" : texto ? `${CONDICION_PAGO[c]} · ${texto}` : CONDICION_PAGO[c];

/** Importe como en la planilla: "$ 723.839,42", "US$ 1.200,00" o "A confirmar". */
export function importeTexto(importe: number | null, moneda: Moneda, aConfirmar = false) {
  if (aConfirmar && importe == null) return "A confirmar";
  if (importe == null) return "—";
  const t = `${moneda === "USD" ? "US$" : "$"} ${importe.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return aConfirmar ? `${t} (a confirmar)` : t;
}

/**
 * Lo que obliga a volver a aprobación al editar una orden ya aprobada (misma numeración, v2): proveedor
 * final, importe, materiales, forma o condición de pago. Facturación, orden de pago, próximos pasos,
 * comentarios u observaciones no.
 */
export type HuellaAprobacion = {
  proveedorId: string | null; sucursalId: string | null; importe: number | null; importeAConfirmar: boolean; moneda: Moneda;
  detallePedido: string | null; renglones: { descripcion: string; cantidad: number; unidad: string; precioUnitario: number | null }[];
  formaPago: FormaPago | null; condicionPago: CondicionPago | null; condicionPagoTexto: string | null;
};
const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
export function cambioDeFondo(a: HuellaAprobacion, b: HuellaAprobacion): string[] {
  const cambios: string[] = [];
  if (a.proveedorId !== b.proveedorId || a.sucursalId !== b.sucursalId) cambios.push("proveedor final");
  if (a.importe !== b.importe || a.importeAConfirmar !== b.importeAConfirmar || a.moneda !== b.moneda) cambios.push("importe");
  const mat = (h: HuellaAprobacion) => JSON.stringify([norm(h.detallePedido), h.renglones.map((r) => [norm(r.descripcion), r.cantidad, norm(r.unidad), r.precioUnitario])]);
  if (mat(a) !== mat(b)) cambios.push("materiales");
  if (a.formaPago !== b.formaPago) cambios.push("forma de pago");
  if (a.condicionPago !== b.condicionPago || norm(a.condicionPagoTexto) !== norm(b.condicionPagoTexto)) cambios.push("condición de pago");
  return cambios;
}

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
