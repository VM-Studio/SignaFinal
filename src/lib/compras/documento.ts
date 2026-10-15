import type { EstadoFacturacion, EstadoMaterialListo, EstadoOC, EstadoPago, FuenteOC, ModoEntrega, Rol } from "@prisma/client";
import type { Tono } from "@/lib/etiquetas";

/**
 * DOCUMENTO DE COMPRA (OC/PE): el recorrido de estados (CLAUDE.md, "Documento de compra"). Puro: lo
 * usan las actions, las pantallas y los tests.
 *
 *   BORRADOR ─Enviar a Compras─▶ ENVIADA_A_COMPRAS ─Compras la abre─▶ EN_COMPRAS ─Enviar a autorización─▶
 *   ESPERANDO_AUTORIZACION ─Aprobar─▶ AUTORIZADA ─Encargada─▶ ENCARGADA ─Habilitar─▶ HABILITADA ─▶ ENTREGADA
 *            │ Rechazar: vuelve a EN_COMPRAS con el motivo      (Habilitar también desde AUTORIZADA)
 *   Compras puede "Devolver a quien pidió" (vuelve a BORRADOR con una nota) y Anular. Compras o el dueño
 *   que la crean la empiezan en EN_COMPRAS. Solo Compras envía a autorización; el número se asigna ahí.
 */
export const TRANSICIONES: Record<EstadoOC, EstadoOC[]> = {
  BORRADOR: ["ENVIADA_A_COMPRAS", "EN_COMPRAS", "ANULADA"],
  ENVIADA_A_COMPRAS: ["EN_COMPRAS", "BORRADOR", "ANULADA"],
  EN_COMPRAS: ["ESPERANDO_AUTORIZACION", "BORRADOR", "ANULADA"],
  ESPERANDO_AUTORIZACION: ["AUTORIZADA", "EN_COMPRAS", "ANULADA"],
  AUTORIZADA: ["ENCARGADA", "HABILITADA", "ESPERANDO_AUTORIZACION", "ANULADA"],
  ENCARGADA: ["AUTORIZADA", "HABILITADA", "ESPERANDO_AUTORIZACION", "ANULADA"],
  HABILITADA: ["ENTREGADA", "ENCARGADA", "AUTORIZADA"],
  ENTREGADA: ["HABILITADA"],
  RECHAZADA: [],
  ANULADA: [],
};
export const puedePasar = (de: EstadoOC, a: EstadoOC) => TRANSICIONES[de].includes(a);

/** Nombre del estado (insignias, filtros, tablero) con su tono. */
export const ESTADO_DOC: Record<EstadoOC, { titulo: string; tono: Tono }> = {
  BORRADOR: { titulo: "Borrador", tono: "neutro" },
  ENVIADA_A_COMPRAS: { titulo: "Nuevo", tono: "aviso" },
  EN_COMPRAS: { titulo: "En Compras", tono: "activo" },
  ESPERANDO_AUTORIZACION: { titulo: "Esperando autorización", tono: "aviso" },
  AUTORIZADA: { titulo: "Autorizada", tono: "ok" },
  RECHAZADA: { titulo: "Rechazada", tono: "critico" },
  ENCARGADA: { titulo: "Encargada", tono: "activo" },
  HABILITADA: { titulo: "Lista para retirar", tono: "ok" },
  ENTREGADA: { titulo: "Entregada", tono: "ok" },
  ANULADA: { titulo: "Anulada", tono: "neutro" },
};

/** La línea de tiempo del documento (lo que ve quien pidió y Compras). */
export const PASOS_DOC: { estado: EstadoOC; titulo: string }[] = [
  { estado: "BORRADOR", titulo: "Armado" },
  { estado: "ENVIADA_A_COMPRAS", titulo: "Enviado a Compras" },
  { estado: "EN_COMPRAS", titulo: "En Compras" },
  { estado: "ESPERANDO_AUTORIZACION", titulo: "Esperando autorización" },
  { estado: "AUTORIZADA", titulo: "Autorizada" },
  { estado: "ENCARGADA", titulo: "Encargada" },
  { estado: "HABILITADA", titulo: "Lista para retirar" },
  { estado: "ENTREGADA", titulo: "Entregada" },
];
export const ordenPaso = (e: EstadoOC) => PASOS_DOC.findIndex((p) => p.estado === e);

/** Lo que lee quien pidió: el estado en una frase (con lo habilitado, si hay). */
export function fraseDocumento(e: EstadoOC, extra: { proveedor?: string | null; retiro?: EstadoMaterialListo | null; entregaProveedor?: string | null } = {}) {
  switch (e) {
    case "BORRADOR": return "Borrador: falta enviarlo a Compras";
    case "ENVIADA_A_COMPRAS": return "Enviado, lo ve Compras";
    case "EN_COMPRAS": return "Compras lo está comprando";
    case "ESPERANDO_AUTORIZACION": return "Esperando la autorización del dueño";
    case "AUTORIZADA": return "Autorizada, falta encargarla al proveedor";
    case "ENCARGADA": return "Encargada al proveedor";
    case "HABILITADA":
      if (extra.entregaProveedor) return `Lo entrega el proveedor ${extra.entregaProveedor}`;
      if (extra.retiro === "EN_CAMINO") return "En camino";
      if (extra.retiro === "RETIRO_PEDIDO") return "Retiro pedido, espera chofer";
      return extra.proveedor ? `Listo para retirar en ${extra.proveedor}` : "Listo para retirar";
    case "ENTREGADA": return "Entregada";
    case "RECHAZADA": return "Rechazada";
    case "ANULADA": return "Anulada";
  }
}

export const ESTADO_FACTURACION: Record<EstadoFacturacion, { titulo: string; fondo: string; texto: string }> = {
  PENDIENTE: { titulo: "Pendiente", fondo: "#FDF3E1", texto: "#92600F" },
  FACTURADA: { titulo: "Facturada", fondo: "#E8F3EC", texto: "#1F7A4D" },
};
export const ESTADO_PAGO: Record<EstadoPago, { titulo: string; fondo: string; texto: string }> = {
  PENDIENTE: { titulo: "Pago pendiente", fondo: "#FDF3E1", texto: "#92600F" },
  AUTORIZADO: { titulo: "Pago autorizado", fondo: "#EEF2FF", texto: "#3730A3" },
  PAGADO: { titulo: "Pagado", fondo: "#E8F3EC", texto: "#1F7A4D" },
};

export const ESTADO_RETIRO: Record<EstadoMaterialListo, { titulo: string; tono: Tono }> = {
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

/** Quién empezó el documento según su rol. */
export const fuenteDe = (rol: Rol): FuenteOC =>
  rol === "COMPRAS" ? "COMPRAS" : rol === "DIRECCION" ? "DIRECCION" : rol === "ADMINISTRACION" ? "ADMINISTRACION" : "ARQUITECTA";

/** Estado con el que nace: Compras y el dueño la empiezan en Compras; los demás, en borrador (o enviada, con "Pedir materiales"). */
export const estadoInicial = (rol: Rol, enviar: boolean): EstadoOC => (rol === "COMPRAS" || rol === "DIRECCION" ? "EN_COMPRAS" : enviar ? "ENVIADA_A_COMPRAS" : "BORRADOR");

/**
 * Estado del documento según sus habilitaciones (retiros parciales), a partir de AUTORIZADA:
 * alguna activa → HABILITADA; todas entregadas y "no falta nada" → ENTREGADA; ninguna → la base
 * (ENCARGADA si estaba encargada, si no AUTORIZADA).
 */
export function estadoSegunHabilitaciones(base: "AUTORIZADA" | "ENCARGADA", completo: boolean, habilitaciones: { estado: EstadoMaterialListo }[]): EstadoOC {
  const activas = habilitaciones.filter((h) => h.estado !== "CANCELADO");
  if (!activas.length) return base;
  if (activas.every((h) => h.estado === "ENTREGADO")) return completo ? "ENTREGADA" : "HABILITADA";
  return "HABILITADA";
}

/** Bandeja de Compras: "Con OC cargada" (ya trae proveedor sugerido o importe, o más de 3 celdas de la sección 1) o "Solo indicaciones". */
export function conOCCargada(d: { proveedorSugerido: string | null; importe: unknown; importeAConfirmar: boolean; celdasSeccion1: number }) {
  return !!d.proveedorSugerido?.trim() || d.importe != null || d.importeAConfirmar || d.celdasSeccion1 > 3;
}

/** Límites del circuito: más que esto, la fila va en rojo y salta la alerta. */
export const LIMITES = {
  /** ENVIADA_A_COMPRAS o EN_COMPRAS: días hábiles. */
  compraDiasHabiles: 2,
  /** ESPERANDO_AUTORIZACION: días corridos. */
  aprobacionDias: 1,
  /** Habilitado (LISTO) sin retiro pedido: días corridos. */
  sinRetirarDias: 3,
};
const DIA = 86_400_000;

/** Días hábiles (lunes a viernes) completos entre dos momentos. */
export function diasHabiles(desde: Date, hasta: Date = new Date()) {
  if (hasta <= desde) return 0;
  let dias = 0;
  for (let t = desde.getTime() + DIA; t <= hasta.getTime(); t += DIA) {
    const d = new Date(t).getUTCDay();
    if (d !== 0 && d !== 6) dias++;
  }
  return dias;
}

/** ¿Está demorado en su estado actual? */
export function demorado(estado: EstadoOC, desde: Date, ahora = new Date()) {
  if (estado === "ENVIADA_A_COMPRAS" || estado === "EN_COMPRAS") return diasHabiles(desde, ahora) > LIMITES.compraDiasHabiles;
  if (estado === "ESPERANDO_AUTORIZACION") return ahora.getTime() - desde.getTime() > LIMITES.aprobacionDias * DIA;
  return false;
}
export const diasDesde = (d: Date, ahora = new Date()) => Math.floor((ahora.getTime() - d.getTime()) / DIA);
/** "hoy", "hace 1 día", "hace 4 días". */
export function haceDias(d: Date) {
  const n = diasDesde(d);
  return n <= 0 ? "hoy" : n === 1 ? "hace 1 día" : `hace ${n} días`;
}

/** Pesos aproximados para un retiro (botones de la hoja de habilitación). */
export const PESOS_MATERIAL = [
  { kg: 200, titulo: "Poco (hasta 200 kg)" },
  { kg: 1000, titulo: "Hasta 1 tn" },
  { kg: 3000, titulo: "Hasta 3 tn" },
  { kg: 5000, titulo: "Más de 3 tn" },
] as const;

/** "#123" o "OC-0012 v2". */
export const nombreDoc = (d: { tipo: "OC" | "PE"; numero: string | null; numeroInterno: number; versionAprobacion?: number }) =>
  d.numero ? `${d.numero}${d.versionAprobacion && d.versionAprobacion > 1 ? ` v${d.versionAprobacion}` : ""}` : `${d.tipo === "PE" ? "PE" : "OC"} #${d.numeroInterno}`;
