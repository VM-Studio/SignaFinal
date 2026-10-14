import { z } from "zod";

/**
 * Lo que manda la PLANTILLA de la orden (formulario de /compras/ordenes/nueva y /compras/[id]/oc),
 * con el vocabulario de Alejandra. Lo usan la action (guardar / enviar) y la vista previa del PDF.
 * El borrador se guarda incompleto; lo que exige el envío está en validarParaEnviar.
 */
const vacio = (v: unknown) => (v === "" || v == null ? undefined : v);
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const texto = (max: number) => z.preprocess(vacio, z.string().trim().max(max).optional());
const dia = (msj: string) => z.preprocess(vacio, z.string().regex(DIA, msj).optional());
/** "723.839,42" → 723839.42 (como lo escribe Alejandra) */
export const numeroArgentino = (max: number) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : typeof v === "string" ? v.replace(/[$\s]|US/g, "").replace(/\./g, "").replace(",", ".") : v), z.coerce.number().min(0).max(max).optional());

export const FORMAS_PAGO = ["TRANSFERENCIA", "ECHEQ", "EFECTIVO", "CUENTA_CORRIENTE"] as const;
export const CONDICIONES_PAGO = ["ACOPIO", "ANTICIPO", "SALDO_30_DIAS", "CONTRA_ENTREGA", "OTRA"] as const;

export const esquemaOC = z.object({
  id: z.preprocess(vacio, z.string().optional()),
  tipo: z.enum(["OC", "PE"]).default("OC"),
  // Desde un pedido de material (/compras/[id]/oc) o directo desde Órdenes (el pedido se crea por detrás).
  pedidoMaterialId: z.preprocess(vacio, z.string().optional()),
  empresaCompraId: z.preprocess(vacio, z.string().optional()),
  fecha: z.string().regex(DIA, "Revisá la fecha del pedido."),
  fechaNecesaria: dia("Revisá la fecha de caducidad."),
  fechaEntrega: dia("Revisá la fecha de entrega programada."),
  // "u:<usuarioId>" o "e:<solicitanteExternoId>"
  solicitadoPor: z.preprocess(vacio, z.string().regex(/^[ue]:.+$/, "Elegí quién lo pidió.").optional()),
  obraId: z.preprocess(vacio, z.string().optional()),
  obraSedeId: z.preprocess(vacio, z.string().optional()),
  detallePedido: texto(5000),
  renglones: z
    .array(z.object({ descripcion: z.string().trim().max(200), cantidad: numeroArgentino(1_000_000), unidad: z.string().trim().max(20), precioUnitario: numeroArgentino(1e12) }))
    .max(200)
    .default([])
    .transform((r) => r.filter((x) => x.descripcion.length > 0)),
  proveedorSugerido: texto(200),
  proveedorId: z.preprocess(vacio, z.string().optional()),
  sucursalId: z.preprocess(vacio, z.string().optional()),
  presupuestoNumero: texto(60),
  importe: numeroArgentino(1e13),
  importeAConfirmar: z.boolean().default(false),
  moneda: z.enum(["ARS", "USD"]).default("ARS"),
  formaPago: z.preprocess(vacio, z.enum(FORMAS_PAGO).optional()),
  condicionPago: z.preprocess(vacio, z.enum(CONDICIONES_PAGO).optional()),
  condicionPagoTexto: texto(200),
  observaciones: texto(3000),
  notasInternas: texto(3000),
  semaforoPE: z.preprocess(vacio, z.enum(["NADA_TODAVIA", "EN_PROCESO", "LISTA", "ANULADA"]).optional()),
  // 3. Facturación
  empresaFacturarId: z.preprocess(vacio, z.string().optional()),
  facturaNumero: texto(60),
  facturaImporte: numeroArgentino(1e13),
  facturaFecha: dia("Revisá la fecha de la factura."),
  facturaFormaPago: z.preprocess(vacio, z.enum(FORMAS_PAGO).optional()),
  facturaCondicion: z.preprocess(vacio, z.enum(CONDICIONES_PAGO).optional()),
  facturaAdjuntoId: z.preprocess(vacio, z.string().optional()),
  // 4. Orden de pago (la autorización es un botón aparte, solo DIRECCION)
  fechaPago: dia("Revisá la fecha de pago."),
  pagoImporte: numeroArgentino(1e13),
  pagoObservaciones: texto(1000),
  adjuntos: z.array(z.string()).max(20).default([]),
});
export type DatosOC = z.input<typeof esquemaOC>;
export type DatosOCValidos = z.output<typeof esquemaOC>;

/** Lo que exige "Enviar a aprobación" (el borrador se guarda incompleto). Devuelve el error o null. */
export function faltaParaEnviar(d: DatosOCValidos): string | null {
  if (!d.empresaCompraId) return "Elegí la empresa que compra.";
  if (!d.solicitadoPor) return "Elegí quién lo pidió (Solicitado por).";
  if (!d.obraId) return "Elegí la obra.";
  if (!d.detallePedido && !d.renglones.length) return "Escribí el detalle del pedido.";
  if (d.importe == null && !d.importeAConfirmar) return "Poné el importe o marcá \"A confirmar\".";
  if (d.condicionPago === "OTRA" && !d.condicionPagoTexto) return "Contá cuál es la condición de pago.";
  if (d.sucursalId && !d.proveedorId) return "Elegí el proveedor de esa sucursal.";
  const sinCantidad = d.renglones.find((r) => !r.cantidad);
  if (sinCantidad) return `Poné la cantidad de "${sinCantidad.descripcion}".`;
  return null;
}
