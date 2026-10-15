import type { EstadoOC, EstadoTablero, Prisma, SemaforoPE } from "@prisma/client";
import type { Tono } from "@/lib/etiquetas";

/**
 * ESTADO DEL TABLERO de Compras (columna "ESTADO" de la planilla de Alejandra), derivado del estado del
 * documento. Única función que lo decide (la usan las actions, la migración lo replica en SQL y los tests
 * la prueban):
 *
 *   anulada (o rechazada, histórico) ...................... ANULADA
 *   borrador / en Compras con presupuesto pedido ........... SOLICITUD_PRESUPUESTO
 *   borrador / enviada a Compras / en Compras .............. (sin estado: todavía no está en el tablero)
 *   esperando autorización ................................ PEDIR_AUTORIZACION
 *   autorizada ............................................ AUTORIZADA
 *   encargada ............................................. ENCARGADO
 *   habilitada (lista para retirar o la trae el proveedor) . HABILITADA
 *   entregada ............................................. ENTREGADO
 *
 * Compras puede ajustarlo a mano (con auditoría): el ajuste vale hasta el próximo cambio REAL, es
 * decir, hasta que lo derivado cambie (ver resolverEstadoTablero).
 */
export type EntradaTablero = { estado: EstadoOC; presupuestoSolicitado?: boolean };

export function estadoTableroDe(e: EntradaTablero): EstadoTablero | null {
  switch (e.estado) {
    case "ANULADA":
    case "RECHAZADA":
      return "ANULADA";
    case "BORRADOR":
    case "ENVIADA_A_COMPRAS":
    case "EN_COMPRAS":
      return e.presupuestoSolicitado ? "SOLICITUD_PRESUPUESTO" : null;
    case "ESPERANDO_AUTORIZACION":
      return "PEDIR_AUTORIZACION";
    case "AUTORIZADA":
      return "AUTORIZADA";
    case "ENCARGADA":
      return "ENCARGADO";
    case "HABILITADA":
      return "HABILITADA";
    case "ENTREGADA":
      return "ENTREGADO";
  }
}

/**
 * Lo que se guarda: si lo derivado cambió, manda lo derivado (el ajuste a mano se pierde); si no,
 * queda lo que estaba (el ajuste a mano se respeta).
 */
export function resolverEstadoTablero(actual: { estadoTablero: EstadoTablero | null; estadoTableroAuto: EstadoTablero | null }, nuevoAuto: EstadoTablero | null) {
  if (nuevoAuto === actual.estadoTableroAuto) return { estadoTablero: actual.estadoTablero, estadoTableroAuto: nuevoAuto, cambio: false };
  return { estadoTablero: nuevoAuto, estadoTableroAuto: nuevoAuto, cambio: actual.estadoTablero !== nuevoAuto };
}

/** Recalcula y guarda el estado del tablero de un documento (dentro de la transacción de la acción). */
export async function sincronizarTablero(tx: Prisma.TransactionClient, ordenCompraId: string) {
  const oc = await tx.ordenCompra.findUnique({ where: { id: ordenCompraId }, select: { estado: true, presupuestoSolicitado: true, estadoTablero: true, estadoTableroAuto: true, fuente: true } });
  // Las importadas del Excel no tienen circuito: su estado es el que traían (o el que les ponga Compras).
  if (!oc || oc.fuente === "IMPORTADA") return;
  const r = resolverEstadoTablero(oc, estadoTableroDe(oc));
  if (r.estadoTablero !== oc.estadoTablero || r.estadoTableroAuto !== oc.estadoTableroAuto) {
    await tx.ordenCompra.update({ where: { id: ordenCompraId }, data: { estadoTablero: r.estadoTablero, estadoTableroAuto: r.estadoTableroAuto } });
  }
}

/** Los nombres de Alejandra, con un tono por estado (escala del sistema: su planilla no los distingue). */
export const ESTADO_TABLERO: Record<EstadoTablero, { titulo: string; tono: Tono; excel: string }> = {
  PEDIR_AUTORIZACION: { titulo: "Pedir autorización", tono: "aviso", excel: "PEDIR AUTORIZACION" },
  AUTORIZADA: { titulo: "Autorizada", tono: "activo", excel: "AUTORIZADA" },
  SOLICITUD_PRESUPUESTO: { titulo: "Solicitud de presupuesto", tono: "neutro", excel: "SOLICITUD PRESUPUESTO" },
  ENCARGADO: { titulo: "Encargado", tono: "activo", excel: "ENCARGADO" },
  HABILITADA: { titulo: "Lista para retirar", tono: "ok", excel: "HABILITADA" },
  ENTREGADO: { titulo: "Entregado", tono: "ok", excel: "ENTREGADO" },
  ANULADA: { titulo: "Anulada", tono: "critico", excel: "ANULADA" },
};

/**
 * Cómo se ve cada estado en la planilla de Alejandra (columna ESTADO y la de su número, la "Nº"): fondo,
 * texto, la palabra en mayúsculas y el código de su leyenda (0 pedir autorización / autorizada, 1 solicitud
 * de presupuesto, 2 encargado y habilitada, 3 entregado). Lo usan el tablero y la exportación a Excel.
 */
export const PLANILLA_TABLERO: Record<EstadoTablero, { fondo: string; texto: string; palabra: string; codigo: number }> = {
  PEDIR_AUTORIZACION: { fondo: "#FFF2CC", texto: "#7A5A00", palabra: "PEDIR AUTORIZACIÓN", codigo: 0 },
  AUTORIZADA: { fondo: "#FFF2CC", texto: "#7A5A00", palabra: "AUTORIZADA", codigo: 0 },
  SOLICITUD_PRESUPUESTO: { fondo: "#DDEBF7", texto: "#1F4E79", palabra: "SOLICITUD PRESUPUESTO", codigo: 1 },
  ENCARGADO: { fondo: "#FCE4D6", texto: "#843C0C", palabra: "ENCARGADO", codigo: 2 },
  // Lista para retirar: verde claro distinto del Entregado (su leyenda la cuenta dentro de "encargado").
  HABILITADA: { fondo: "#D9F2E6", texto: "#1B5E3B", palabra: "HABILITADA", codigo: 2 },
  ENTREGADO: { fondo: "#E2EFDA", texto: "#375623", palabra: "ENTREGADO", codigo: 3 },
  ANULADA: { fondo: "#EDEDED", texto: "#595959", palabra: "ANULADA", codigo: 0 },
};

/** La leyenda de arriba a la derecha de su planilla (un cuadradito por código). */
export const LEYENDA_TABLERO: { codigo: number; palabra: string; estado: EstadoTablero }[] = [
  { codigo: 0, palabra: "Pedir autorización / Autorizada", estado: "PEDIR_AUTORIZACION" },
  { codigo: 1, palabra: "Solicitud presupuesto", estado: "SOLICITUD_PRESUPUESTO" },
  { codigo: 2, palabra: "Encargado", estado: "ENCARGADO" },
  { codigo: 2, palabra: "Habilitada (lista para retirar)", estado: "HABILITADA" },
  { codigo: 3, palabra: "Entregado", estado: "ENTREGADO" },
];

/** Orden de los estados en filtros y contadores. */
export const ESTADOS_TABLERO: EstadoTablero[] = ["PEDIR_AUTORIZACION", "AUTORIZADA", "SOLICITUD_PRESUPUESTO", "ENCARGADO", "HABILITADA", "ENTREGADO", "ANULADA"];

/** "ESTADO DE LA ORDEN" de los pedidos especiales (arriba de cada PE en la planilla). */
export const SEMAFORO_PE: Record<SemaforoPE, { titulo: string; detalle: string; tono: Tono }> = {
  NADA_TODAVIA: { titulo: "No se hizo nada todavía", detalle: "", tono: "critico" },
  EN_PROCESO: { titulo: "En proceso", detalle: "falta entregar o pagar", tono: "aviso" },
  LISTA: { titulo: "Lista", detalle: "paga y entregada", tono: "ok" },
  ANULADA: { titulo: "Anulada", detalle: "", tono: "neutro" },
};
