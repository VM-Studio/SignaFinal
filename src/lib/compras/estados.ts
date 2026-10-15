import type { CondicionPago, FormaPago, Moneda, TipoOrden } from "@prisma/client";

/** Vocabulario de la plantilla (docs/plantilla-oc/orden-de-compra.pdf): el título y el color de la franja. */
export const TIPO_ORDEN: Record<TipoOrden, { corto: string; titulo: string; tituloPDF: string; color: string }> = {
  OC: { corto: "OC", titulo: "Orden de compra", tituloPDF: "ORDEN DE COMPRA", color: "#BDD7EE" },
  PE: { corto: "PE", titulo: "Pedido especial", tituloPDF: "PEDIDO ESPECIAL", color: "#C6E0B4" },
};

export const FORMA_PAGO: Record<FormaPago, string> = {
  TRANSFERENCIA: "Transferencia",
  ECHEQ: "Echeq",
  EFECTIVO: "Efectivo",
  CUENTA_CORRIENTE: "Cuenta corriente",
  ACOPIO: "Acopio",
};

export const CONDICION_PAGO: Record<CondicionPago, string> = {
  ACOPIO: "Acopio",
  ANTICIPO: "Anticipo",
  SALDO_30_DIAS: "Saldo a 30 días",
  CONTRA_ENTREGA: "Contra entrega",
  OTRA: "Otra",
};

/** Importe como en la planilla: "$ 723.839,42", "US$ 1.200,00" o "A confirmar". */
export function importeTexto(importe: number | null, moneda: Moneda, aConfirmar = false) {
  if (aConfirmar && importe == null) return "A confirmar";
  if (importe == null) return "—";
  const t = `${moneda === "USD" ? "US$" : "$"} ${importe.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return aConfirmar ? `${t} (a confirmar)` : t;
}
