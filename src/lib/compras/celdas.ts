import "server-only";
import { Prisma, type CondicionPago, type FormaPago } from "@prisma/client";
import { ErrorNegocio } from "@/lib/resultado";
import { aFecha, diaISO } from "@/lib/formato";
import { CELDAS, type Celda, type ValoresCeldas } from "./permisosCeldas";
import { CONDICION_PAGO, FORMA_PAGO, importeTexto } from "./estados";

/**
 * Las celdas de la plantilla contra la base: cómo se lee cada una (valor de la plantilla, texto) y cómo
 * se guarda (validación + campos de OrdenCompra). Los valores viajan como texto:
 *   fechas "AAAA-MM-DD" · obra "obraId" u "obraId|sedeId" · Solicitado por "u:<usuario>" / "e:<externo>" /
 *   "t:<texto del Excel>" · Proveedor Final "proveedorId|sucursalId" · Importe "?" (a confirmar),
 *   "ARS 1234.56" o "USD 100" · Condición de Pago "SALDO_30_DIAS" u "OTRA|50 % anticipo" · Factura (archivo)
 *   el id del adjunto. "" = vacía.
 */
type Tx = Prisma.TransactionClient;

export const incluirDocumento = {
  obra: { select: { id: true, nombre: true, direccion: true, localidad: true, razonSocialId: true } },
  obraSede: { select: { id: true, nombre: true, direccion: true, localidad: true } },
  solicitante: { select: { id: true, nombre: true } },
  solicitanteExterno: { select: { id: true, nombre: true } },
  empresaCompra: { select: { id: true, nombre: true, cuit: true } },
  empresaFacturar: { select: { id: true, nombre: true, cuit: true } },
  creadaPor: { select: { id: true, nombre: true, rol: true } },
  tomadoPor: { select: { id: true, nombre: true } },
  aprobadaPor: { select: { nombre: true } },
  pagoSolicitadoPor: { select: { nombre: true } },
  ordenPagoAutorizadaPor: { select: { nombre: true } },
  proveedor: { select: { id: true, nombre: true, cuit: true, telefono: true } },
  sucursal: { select: { id: true, nombre: true, direccion: true, localidad: true, telefono: true, contacto: true, horarioRetiro: true } },
} satisfies Prisma.OrdenCompraInclude;
export type DocumentoDb = Prisma.OrdenCompraGetPayload<{ include: typeof incluirDocumento }>;

const n = (d: Prisma.Decimal | null | undefined) => (d == null ? null : d.toNumber());
const f = (d: Date | null | undefined) => (d ? diaISO(d) : "");
/** d/M/yyyy, como en la planilla. */
export const fechaCorta = (iso: string) => (iso ? iso.split("-").map(Number).reverse().join("/") : "");
const plata = (x: number) => `$ ${x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "Solicitado por": el usuario, el solicitante externo o el texto que vino del Excel. */
type Nombre = { nombre: string } | null;
export const solicitadoPorDe = (d: { solicitante: Nombre; solicitanteExterno: Nombre; solicitadoPorTexto: string | null }) =>
  d.solicitante?.nombre ?? d.solicitanteExterno?.nombre ?? d.solicitadoPorTexto ?? "";
export const obraDe = (d: { obra: Nombre; obraSede: Nombre; obraTexto: string | null }) =>
  d.obra ? `${d.obra.nombre}${d.obraSede ? ` · ${d.obraSede.nombre}` : ""}` : d.obraTexto ?? "";
export const proveedorFinalDe = (d: { proveedor: Nombre; sucursal: Nombre }) =>
  d.proveedor ? `${d.proveedor.nombre}${d.sucursal && d.sucursal.nombre !== "Casa central" ? ` (${d.sucursal.nombre})` : ""}` : "";

/** Lo que se guarda en cada celda, como lo maneja la plantilla. */
export function valoresDe(d: DocumentoDb): Required<ValoresCeldas> {
  return {
    empresa: d.empresaCompraId ?? "",
    fechaPedido: f(d.fecha),
    fechaCaducidad: f(d.fechaNecesaria),
    nDeOrden: d.numero ? `${d.numero}${d.versionAprobacion > 1 ? ` v${d.versionAprobacion}` : ""}` : "",
    solicitadoPor: d.solicitanteId ? `u:${d.solicitanteId}` : d.solicitanteExternoId ? `e:${d.solicitanteExternoId}` : d.solicitadoPorTexto ? `t:${d.solicitadoPorTexto}` : "",
    obra: d.obraId ? (d.obraSedeId ? `${d.obraId}|${d.obraSedeId}` : d.obraId) : "",
    detalleDelPedido: d.detallePedido ?? "",
    proveedorSugerido: d.proveedorSugerido ?? "",
    proveedorFinal: d.proveedorId ? `${d.proveedorId}|${d.sucursalId ?? ""}` : "",
    presupuestoN: d.presupuestoNumero ?? "",
    importe: d.importe != null ? `${d.moneda} ${n(d.importe)}` : d.importeAConfirmar ? "?" : "",
    formaDePago: d.formaPago ?? "",
    observacionesOrdenPedido: d.observaciones ?? "",
    empresaParaFacturar: d.empresaFacturarId ?? "",
    cuit: d.empresaFacturar?.cuit ?? "",
    facturaN: d.facturaNumero ?? "",
    facturaImporte: d.facturaImporte != null ? String(n(d.facturaImporte)) : "",
    facturaFormaDePago: d.facturaFormaPago ?? "",
    condicionDePago: d.facturaCondicion ? (d.facturaCondicion === "OTRA" ? `OTRA|${d.condicionPagoTexto ?? ""}` : d.facturaCondicion) : "",
    facturaAdjunto: d.facturaAdjuntoId ?? "",
    fechaDePago: f(d.fechaPago),
    observacionesSolicitante: d.observacionesSolicitante ?? "",
    prioridad: d.prioridad,
  };
}

/** Texto de cada celda tal cual se imprime (PDF, vista de lectura, historial). */
export function textosDe(d: DocumentoDb): Required<ValoresCeldas> {
  const v = valoresDe(d);
  const condicion = d.facturaCondicion ? (d.facturaCondicion === "OTRA" ? d.condicionPagoTexto || "Otra" : `${CONDICION_PAGO[d.facturaCondicion]}${d.condicionPagoTexto ? ` · ${d.condicionPagoTexto}` : ""}`) : "";
  return {
    ...v,
    empresa: d.empresaCompra?.nombre ?? "",
    fechaPedido: fechaCorta(v.fechaPedido),
    fechaCaducidad: fechaCorta(v.fechaCaducidad),
    solicitadoPor: solicitadoPorDe(d),
    obra: obraDe(d),
    proveedorFinal: proveedorFinalDe(d),
    importe: d.importe != null || d.importeAConfirmar ? importeTexto(n(d.importe), d.moneda, d.importeAConfirmar) : "",
    formaDePago: d.formaPago ? FORMA_PAGO[d.formaPago] : "",
    empresaParaFacturar: d.empresaFacturar?.nombre ?? "",
    facturaImporte: d.facturaImporte != null ? plata(n(d.facturaImporte)!) : "",
    facturaFormaDePago: d.facturaFormaPago ? FORMA_PAGO[d.facturaFormaPago] : "",
    condicionDePago: condicion,
    fechaDePago: fechaCorta(v.fechaDePago),
    prioridad: d.prioridad === "URGENTE" ? "Urgente" : "Normal",
  };
}

/** Cuántas celdas de la sección 1 tiene completas (bandeja de Compras: "Con OC cargada"). */
/** Celdas de la sección 1 que cargó una persona (Empresa y Solicitado por las completa el sistema solo: no cuentan). */
export const celdasSeccion1 = (v: ValoresCeldas) =>
  (["fechaCaducidad", "obra", "detalleDelPedido", "proveedorSugerido", "proveedorFinal", "presupuestoN", "importe", "formaDePago"] as Celda[]).filter((c) => (v[c] ?? "").trim()).length;

// ─────────────────────────── Guardar una celda ───────────────────────────

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const texto = (v: string, max: number, etiqueta: string) => {
  const t = v.trim();
  if (t.length > max) throw new ErrorNegocio(`${etiqueta}: hasta ${max} caracteres.`);
  return t || null;
};
const fecha = (v: string, etiqueta: string) => {
  if (!v) return null;
  if (!DIA.test(v)) throw new ErrorNegocio(`Revisá la ${etiqueta.toLowerCase()}.`);
  return aFecha(v, "12:00");
};
const numero = (v: string, etiqueta: string) => {
  if (!v.trim()) return null;
  const x = Number(v);
  if (!Number.isFinite(x) || x < 0 || x > 1e13) throw new ErrorNegocio(`Revisá el ${etiqueta.toLowerCase()}.`);
  return new Prisma.Decimal(Math.round(x * 100) / 100);
};
const FORMAS = Object.keys(FORMA_PAGO) as FormaPago[];
const CONDICIONES = Object.keys(CONDICION_PAGO) as CondicionPago[];

async function razonSocial(tx: Tx, id: string) {
  if (!id) return null;
  const r = await tx.razonSocial.findUnique({ where: { id }, select: { id: true, activa: true } });
  if (!r?.activa) throw new ErrorNegocio("Esa razón social no está activa.");
  return r.id;
}

/**
 * Valida el valor de la celda y devuelve los campos a guardar. `obra` puede traer la razón social por
 * defecto (si la Empresa estaba vacía). No decide permisos: eso es permisosCeldas.ts.
 */
export async function datosDeCelda(tx: Tx, d: { id: string; empresaCompraId: string | null }, celda: Celda, valor: string, usuarioId: string): Promise<Prisma.OrdenCompraUncheckedUpdateInput> {
  const v = valor ?? "";
  const etiqueta = CELDAS[celda].etiqueta;
  switch (celda) {
    case "empresa": return { empresaCompraId: await razonSocial(tx, v) };
    case "empresaParaFacturar": return { empresaFacturarId: await razonSocial(tx, v) };
    case "fechaPedido": {
      if (!v) throw new ErrorNegocio("La fecha del pedido no puede quedar vacía.");
      return { fecha: fecha(v, etiqueta)! };
    }
    case "fechaCaducidad": return { fechaNecesaria: fecha(v, etiqueta) };
    case "fechaDePago": return { fechaPago: fecha(v, etiqueta) };
    case "solicitadoPor": {
      if (!v) return { solicitanteId: null, solicitanteExternoId: null, solicitadoPorTexto: null };
      const id = v.slice(2);
      if (v.startsWith("u:")) {
        const u = await tx.usuario.findUnique({ where: { id }, select: { activo: true } });
        if (!u?.activo) throw new ErrorNegocio("Esa persona ya no está en el sistema. Elegí otra.");
        return { solicitanteId: id, solicitanteExternoId: null, solicitadoPorTexto: null };
      }
      if (v.startsWith("e:")) {
        const e = await tx.solicitanteExterno.findUnique({ where: { id }, select: { activo: true } });
        if (!e?.activo) throw new ErrorNegocio("Ese nombre ya no está en la lista. Elegí otro.");
        return { solicitanteId: null, solicitanteExternoId: id, solicitadoPorTexto: null };
      }
      throw new ErrorNegocio("Elegí quién lo pidió de la lista.");
    }
    case "obra": {
      if (!v) return { obraId: null, obraSedeId: null };
      const [obraId, sedeId] = v.split("|");
      const obra = await tx.obra.findUnique({ where: { id: obraId }, select: { id: true, estado: true, razonSocialId: true, sedes: { where: { activa: true }, select: { id: true } } } });
      if (!obra || obra.estado === "FINALIZADA") throw new ErrorNegocio("Esa obra no está activa.");
      if (sedeId && !obra.sedes.some((s) => s.id === sedeId)) throw new ErrorNegocio("Esa sede no es de la obra.");
      const empresa = d.empresaCompraId ? {} : { empresaCompraId: obra.razonSocialId ?? (await tx.razonSocial.findFirst({ where: { activa: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }], select: { id: true } }))?.id ?? null };
      return { obraId: obra.id, obraSedeId: sedeId || null, obraTexto: null, ...empresa };
    }
    case "detalleDelPedido": return { detallePedido: texto(v, 5000, etiqueta) };
    case "proveedorSugerido": return { proveedorSugerido: texto(v, 200, etiqueta) };
    case "presupuestoN": return { presupuestoNumero: texto(v, 60, etiqueta) };
    case "facturaN": return { facturaNumero: texto(v, 60, etiqueta) };
    case "observacionesOrdenPedido": return { observaciones: texto(v, 3000, etiqueta) };
    case "observacionesSolicitante": return { observacionesSolicitante: texto(v, 3000, etiqueta) };
    case "proveedorFinal": {
      if (!v) return { proveedorId: null, sucursalId: null };
      const [proveedorId, sucursalId] = v.split("|");
      if (!sucursalId) throw new ErrorNegocio("Elegí la sucursal del proveedor (adonde va el chofer).");
      const s = await tx.sucursalProveedor.findUnique({ where: { id: sucursalId }, select: { proveedorId: true, activa: true } });
      if (!s?.activa || s.proveedorId !== proveedorId) throw new ErrorNegocio("Esa sucursal no es del proveedor elegido.");
      return { proveedorId, sucursalId };
    }
    case "importe": {
      if (!v) return { importe: null, importeAConfirmar: false };
      if (v === "?") return { importe: null, importeAConfirmar: true };
      const m = v.match(/^(ARS|USD) (.+)$/);
      if (!m) throw new ErrorNegocio("Revisá el importe.");
      return { importe: numero(m[2], etiqueta), importeAConfirmar: false, moneda: m[1] as "ARS" | "USD" };
    }
    case "facturaImporte": return { facturaImporte: numero(v, "importe de la factura") };
    case "formaDePago":
    case "facturaFormaDePago": {
      if (v && !FORMAS.includes(v as FormaPago)) throw new ErrorNegocio("Elegí la forma de pago de la lista.");
      return celda === "formaDePago" ? { formaPago: (v || null) as FormaPago | null } : { facturaFormaPago: (v || null) as FormaPago | null };
    }
    case "condicionDePago": {
      if (!v) return { facturaCondicion: null, condicionPagoTexto: null };
      const [c, otra] = v.split("|");
      if (!CONDICIONES.includes(c as CondicionPago)) throw new ErrorNegocio("Elegí la condición de pago de la lista.");
      if (c === "OTRA" && !otra?.trim()) throw new ErrorNegocio("Contá cuál es la condición de pago.");
      return { facturaCondicion: c as CondicionPago, condicionPagoTexto: c === "OTRA" ? otra.trim().slice(0, 200) : null };
    }
    case "facturaAdjunto": {
      if (!v) return { facturaAdjuntoId: null };
      const a = await tx.adjunto.findUnique({ where: { id: v }, select: { id: true, entidadTipo: true, entidadId: true, subidoPorId: true } });
      if (!a || a.entidadTipo !== "ORDEN_COMPRA" || (a.entidadId && a.entidadId !== d.id) || (!a.entidadId && a.subidoPorId !== usuarioId)) throw new ErrorNegocio("El archivo de la factura no se terminó de subir. Adjuntalo de nuevo.");
      if (!a.entidadId) await tx.adjunto.update({ where: { id: a.id }, data: { entidadId: d.id, interno: false } });
      return { facturaAdjuntoId: a.id };
    }
    case "prioridad": {
      if (v !== "NORMAL" && v !== "URGENTE") throw new ErrorNegocio("Elegí la prioridad.");
      return { prioridad: v };
    }
    case "nDeOrden":
    case "cuit":
      throw new ErrorNegocio(`${etiqueta} lo completa el sistema.`);
  }
}
