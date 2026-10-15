import type { EstadoOC, Rol } from "@prisma/client";

/**
 * PERMISOS POR CELDA del documento de compra (OC/PE): la ÚNICA fuente de qué celdas tiene la plantilla
 * (con el nombre exacto de la celda de docs/plantilla-oc/orden-de-compra.pdf), quién edita cada una y en
 * qué estados. La usan la plantilla (gris = no podés) y el servidor en CADA guardado de celda. Pura: sin
 * base, para los tests.
 *
 *   Sección 1 hasta Proveedor Sugerido (+ Importe): quien la creó, los responsables y el capataz de esa
 *     obra, Compras, Dirección y Administración, hasta que se envía a autorización. Después, solo Compras
 *     con "Modificar".
 *   Proveedor Final, Presupuesto N°, Importe, 1.1: Compras y Dirección (después de enviar: Compras con
 *     "Modificar").
 *   Forma de Pago: Administración y Dirección (la final); Compras solo marca o desmarca "Acopio".
 *   2. Autorización: solo Dirección, con Aprobar / Rechazar (no es una celda que se escribe).
 *   3. Facturación: Administración y Dirección.
 *   4. Orden de Pago: Fecha de Pago, Administración (con el pago autorizado); la autorización, Dirección
 *     con su botón.
 *   CHOFER y DEPOSITO no ven el documento.
 */
export const CELDAS = {
  // 1. Orden de Pedido
  empresa: { etiqueta: "Empresa", seccion: 1, tipo: "razonSocial" },
  fechaPedido: { etiqueta: "Fecha del pedido", seccion: 1, tipo: "fecha" },
  fechaCaducidad: { etiqueta: "Fecha de caducidad", seccion: 1, tipo: "fecha" },
  nDeOrden: { etiqueta: "N° de Orden", seccion: 1, tipo: "lectura" },
  solicitadoPor: { etiqueta: "Solicitado por", seccion: 1, tipo: "persona" },
  obra: { etiqueta: "Obra", seccion: 1, tipo: "obra" },
  detalleDelPedido: { etiqueta: "Detalle del Pedido", seccion: 1, tipo: "textoLargo" },
  proveedorSugerido: { etiqueta: "Proveedor Sugerido", seccion: 1, tipo: "texto" },
  proveedorFinal: { etiqueta: "Proveedor Final", seccion: 1, tipo: "proveedor" },
  presupuestoN: { etiqueta: "Presupuesto N°", seccion: 1, tipo: "texto" },
  importe: { etiqueta: "Importe", seccion: 1, tipo: "importe" },
  formaDePago: { etiqueta: "Forma de Pago", seccion: 1, tipo: "formaPago" },
  // 1.1
  observacionesOrdenPedido: { etiqueta: "1.1 Observaciones de la Orden de Pedido", seccion: 1.1, tipo: "textoLargo" },
  // 3. Facturación
  empresaParaFacturar: { etiqueta: "Empresa para Facturar", seccion: 3, tipo: "razonSocial" },
  cuit: { etiqueta: "Cuit", seccion: 3, tipo: "lectura" },
  facturaN: { etiqueta: "Factura N°", seccion: 3, tipo: "texto" },
  facturaImporte: { etiqueta: "Importe", seccion: 3, tipo: "dinero" },
  facturaFormaDePago: { etiqueta: "Forma de Pago", seccion: 3, tipo: "formaPago" },
  condicionDePago: { etiqueta: "Condición de Pago", seccion: 3, tipo: "condicionPago" },
  facturaAdjunto: { etiqueta: "Factura (archivo)", seccion: 3, tipo: "archivo" },
  // 4. Orden de Pago
  fechaDePago: { etiqueta: "Fecha de Pago", seccion: 4, tipo: "fecha" },
  // Del que pidió (fuera de la grilla impresa)
  observacionesSolicitante: { etiqueta: "Observaciones de quien pidió", seccion: 0, tipo: "textoLargo" },
  prioridad: { etiqueta: "Prioridad", seccion: 0, tipo: "prioridad" },
} as const;

export type Celda = keyof typeof CELDAS;
export type TipoCelda = (typeof CELDAS)[Celda]["tipo"];
export const NOMBRES_CELDAS = Object.keys(CELDAS) as Celda[];
export const esCelda = (x: string): x is Celda => x in CELDAS;

/** Hasta acá se edita libremente; desde que se envía a autorización la sección 1 se bloquea. */
export const ANTES_DE_AUTORIZACION: EstadoOC[] = ["BORRADOR", "ENVIADA_A_COMPRAS", "EN_COMPRAS"];
/** Con "Modificar", Compras puede tocar la sección 1 de una enviada o autorizada (un cambio de fondo vuelve a autorización como v2). */
const MODIFICABLE_POR_COMPRAS: EstadoOC[] = ["ESPERANDO_AUTORIZACION", "AUTORIZADA", "ENCARGADA", "HABILITADA"];
const CERRADOS: EstadoOC[] = ["ANULADA", "RECHAZADA"];

const GRUPO_A: Celda[] = ["empresa", "fechaPedido", "fechaCaducidad", "solicitadoPor", "obra", "detalleDelPedido", "proveedorSugerido", "importe", "observacionesSolicitante", "prioridad"];
const GRUPO_B: Celda[] = ["proveedorFinal", "presupuestoN", "importe", "observacionesOrdenPedido"];
const SECCION_3: Celda[] = ["empresaParaFacturar", "facturaN", "facturaImporte", "facturaFormaDePago", "condicionDePago", "facturaAdjunto"];
/** Celdas que, cambiadas en una orden ya autorizada, la devuelven a autorización (v2). */
export const CELDAS_DE_FONDO: Celda[] = ["proveedorFinal", "importe", "detalleDelPedido", "formaDePago"];

export type Contexto = {
  rol: Rol;
  estado: EstadoOC;
  /** Quien lo creó. */
  esCreador: boolean;
  /** RESPONSABLE_OBRA o CAPATAZ de la obra del documento (el capataz, de todas). */
  esDeSuObra: boolean;
  /** Compras tocó "Modificar" (sección 1 de una enviada o autorizada). */
  modificar?: boolean;
  /** Para Forma de Pago: el valor que se quiere poner (Compras solo "ACOPIO" o vacío). */
  valor?: string;
  /** Fecha de Pago: el pago ya está autorizado por el dueño. */
  pagoAutorizado?: boolean;
  /** Importadas del Excel: solo el tablero (Compras) y facturación. */
  importada?: boolean;
};

export type Permiso = { ok: true } | { ok: false; motivo: string };
const si: Permiso = { ok: true };
const no = (motivo: string): Permiso => ({ ok: false, motivo });

/** ¿Este rol ve el documento? (la consulta además filtra por obra para la gente de obra). */
export const veDocumentos = (rol: Rol) => rol !== "CHOFER" && rol !== "DEPOSITO";

/** ¿Puede editar esta celda en este momento? Devuelve el motivo si no. */
export function puedeEditarCelda(celda: Celda, c: Contexto): Permiso {
  if (!veDocumentos(c.rol)) return no("No tenés acceso a las órdenes de compra.");
  const def = CELDAS[celda];
  if (def.tipo === "lectura") return no(`${def.etiqueta} lo completa el sistema.`);
  if (CERRADOS.includes(c.estado)) return no("La orden está anulada.");
  const obra = c.rol === "RESPONSABLE_OBRA" || c.rol === "CAPATAZ";
  const gestiona = c.rol === "COMPRAS" || c.rol === "DIRECCION";
  const antes = ANTES_DE_AUTORIZACION.includes(c.estado);
  // Lo del arquitecto en borrador es suyo: Compras lo ve recién cuando se lo mandan.
  const borradorAjeno = c.estado === "BORRADOR" && !c.esCreador && c.rol !== "DIRECCION" && !(obra && c.esDeSuObra);

  // Forma de Pago (sección 1): la final es de Administración y Dirección; Compras marca "Acopio".
  if (celda === "formaDePago" || celda === "facturaFormaDePago") {
    if (c.rol === "ADMINISTRACION" || c.rol === "DIRECCION") return c.estado === "BORRADOR" && !c.esCreador && c.rol === "ADMINISTRACION" ? no("Todavía es un borrador de quien lo pide.") : si;
    if (celda === "formaDePago" && c.rol === "COMPRAS") {
      if (c.estado === "ENTREGADA") return no("La orden ya se entregó.");
      return c.valor === undefined || c.valor === "" || c.valor === "ACOPIO" ? si : no("Compras solo marca Acopio; la forma de pago la define Administración.");
    }
    return no(`${def.etiqueta} la completa Administración.`);
  }

  if (SECCION_3.includes(celda)) {
    if (c.rol !== "ADMINISTRACION" && c.rol !== "DIRECCION") return no("La facturación la completa Administración.");
    if (c.estado === "BORRADOR") return no("Todavía es un borrador de quien lo pide.");
    return si;
  }

  if (celda === "fechaDePago") {
    if (c.rol !== "ADMINISTRACION") return no("La fecha de pago la pone Administración.");
    if (!c.pagoAutorizado) return no("Falta que el dueño autorice el pago.");
    return si;
  }

  if (c.importada) return no("Las órdenes importadas del Excel se editan desde el tablero.");

  const enA = GRUPO_A.includes(celda);
  const enB = GRUPO_B.includes(celda);
  if (!enA && !enB) return no("Esa celda no se edita.");

  if (antes) {
    if (borradorAjeno) return no("Todavía es un borrador de quien lo pide.");
    const editorA = c.esCreador || (obra && c.esDeSuObra) || gestiona || c.rol === "ADMINISTRACION";
    if (enA && editorA) return si;
    if (enB && gestiona) return si;
    return enB ? no(`${def.etiqueta} lo completa Compras.`) : no("No podés editar esta orden.");
  }

  // Enviada a autorización o después: solo Compras con "Modificar" (y nunca una entregada).
  if (c.rol === "COMPRAS" && MODIFICABLE_POR_COMPRAS.includes(c.estado)) {
    return c.modificar ? si : no("Tocá \"Modificar\" para cambiarla.");
  }
  if (c.estado === "ENTREGADA") return no("La orden ya se entregó.");
  return no("La orden ya se envió a autorización.");
}

/** Las celdas que este usuario puede editar ahora (la plantilla pinta de gris el resto). */
export const celdasEditables = (c: Omit<Contexto, "valor">) => NOMBRES_CELDAS.filter((x) => puedeEditarCelda(x, c).ok);

// ─────────────────────────── Lo que falta para el paso siguiente ───────────────────────────

/** Valores tal cual los maneja la plantilla (texto; "" = vacía). */
export type ValoresCeldas = Partial<Record<Celda, string>>;

export const OBLIGATORIAS = {
  /** "Enviar a Compras": la validación mínima es obra + detalle (se puede mandar con lo demás vacío). */
  enviarACompras: ["obra", "detalleDelPedido"],
  /** "Enviar a autorización" (Compras). */
  enviarAAutorizacion: ["empresa", "solicitadoPor", "obra", "detalleDelPedido", "proveedorFinal", "importe"],
  /** Facturación (Administración). */
  facturar: ["empresaParaFacturar", "facturaN", "facturaImporte", "condicionDePago"],
} as const satisfies Record<string, readonly Celda[]>;
export type Paso = keyof typeof OBLIGATORIAS;

export const faltan = (paso: Paso, v: ValoresCeldas): Celda[] => OBLIGATORIAS[paso].filter((c) => !(v[c] ?? "").trim());

/** "Faltan: Proveedor Final, Importe" */
export const textoFaltan = (celdas: Celda[]) => (celdas.length ? `Faltan: ${celdas.map((c) => CELDAS[c].etiqueta.replace(/^1\.1 /, "")).join(", ")}` : null);

/** El paso siguiente según el estado y quién mira (para pintar en rojo lo que falta). */
export function pasoSiguiente(rol: Rol, estado: EstadoOC): Paso | null {
  if (estado === "BORRADOR") return "enviarACompras";
  if ((estado === "ENVIADA_A_COMPRAS" || estado === "EN_COMPRAS") && (rol === "COMPRAS" || rol === "DIRECCION")) return "enviarAAutorizacion";
  if ((estado === "ENVIADA_A_COMPRAS" || estado === "EN_COMPRAS")) return null;
  if (["AUTORIZADA", "ENCARGADA", "HABILITADA", "ENTREGADA"].includes(estado) && (rol === "ADMINISTRACION" || rol === "DIRECCION")) return "facturar";
  return null;
}
