import type { Condicion, EstadoHerramienta, TipoMovimiento } from "@prisma/client";
import type { Tono } from "@/lib/etiquetas";

/** Textos del depósito. Puro: sirve en servidor y cliente. */

export const ESTADO: Record<EstadoHerramienta, { texto: string; tono: Tono }> = {
  DISPONIBLE: { texto: "En depósito", tono: "ok" },
  EN_OBRA: { texto: "En obra", tono: "activo" },
  EN_REPARACION: { texto: "En reparación", tono: "aviso" },
  EXTRAVIADA: { texto: "Extraviada", tono: "critico" },
  BAJA: { texto: "Dada de baja", tono: "neutro" },
};

export const CONDICION: Record<Condicion, { texto: string; tono: Tono }> = {
  BUENA: { texto: "Buena", tono: "ok" },
  REGULAR: { texto: "Regular", tono: "aviso" },
  MALA: { texto: "Mala", tono: "critico" },
};

export const MOVIMIENTO: Record<TipoMovimiento, string> = {
  ENTREGA: "Entregada",
  DEVOLUCION: "Devuelta al depósito",
  TRANSFERENCIA: "Transferida",
  A_REPARACION: "Enviada a reparación",
  DE_REPARACION: "Volvió de reparación",
  EXTRAVIO: "Marcada extraviada",
  BAJA: "Dada de baja",
};

export type Accion = "entregar" | "devolver" | "transferir" | "reparar" | "volvio" | "extraviada" | "baja" | "pedir";

/** Lo más probable al escanear: si está en el depósito, entregar; si está en obra, devolver. */
export function accionSugerida(estado: EstadoHerramienta): Accion | null {
  if (estado === "DISPONIBLE") return "entregar";
  if (estado === "EN_OBRA") return "devolver";
  if (estado === "EN_REPARACION") return "volvio";
  return null;
}

export const MOTIVOS_BAJA = ["Rota sin arreglo", "Reparación más cara que una nueva", "Vendida", "Obsoleta"];
export const MOTIVOS_EXTRAVIO = ["No aparece en la obra", "Robada en obra", "Robada en traslado"];
