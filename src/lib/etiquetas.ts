import type { EstadoPedido, EstadoHerramienta, Rol, TipoDocumentoVehiculo, TipoPedido } from "@prisma/client";

/** Palabras que ve la gente para cada valor interno. Nunca se muestra el código. */

export type Tono = "ok" | "aviso" | "critico" | "activo" | "neutro";

export const ROL: Record<Rol, string> = {
  DIRECCION: "Dirección",
  RESPONSABLE_OBRA: "Responsable de obra",
  CAPATAZ: "Capataz general",
  CHOFER: "Chofer",
  DEPOSITO: "Depósito",
  ADMINISTRACION: "Administración",
};

export const ESTADO_PEDIDO: Record<EstadoPedido, { texto: string; tono: Tono }> = {
  PENDIENTE: { texto: "Pendiente", tono: "aviso" },
  TOMADO: { texto: "Tomado", tono: "activo" },
  EN_VIAJE: { texto: "En viaje", tono: "activo" },
  ENTREGADO: { texto: "Entregado", tono: "ok" },
  CANCELADO: { texto: "Cancelado", tono: "neutro" },
};

/** "Tomado por Claudio", "En viaje · Cristian". */
export function textoEstadoPedido(estado: EstadoPedido, chofer?: string | null) {
  if (estado === "TOMADO" && chofer) return `Tomado por ${chofer}`;
  if (estado === "EN_VIAJE" && chofer) return `En viaje · ${chofer}`;
  return ESTADO_PEDIDO[estado].texto;
}

export const TIPO_PEDIDO: Record<TipoPedido, string> = {
  RETIRO_PROVEEDOR: "Retiro en proveedor",
  TRASLADO_MAQUINARIA: "Traslado de maquinaria",
  TRASLADO_HERRAMIENTAS: "Traslado de herramientas",
  LLEVAR_A_OBRA: "Llevar a obra",
  RETIRO_ESCOMBROS: "Retiro de escombros",
  TRASLADO_PERSONAS: "Traslado de personas",
  OTRO: "Otro",
};

export const ESTADO_HERRAMIENTA: Record<EstadoHerramienta, { texto: string; tono: Tono }> = {
  DISPONIBLE: { texto: "En depósito", tono: "ok" },
  EN_OBRA: { texto: "En obra", tono: "activo" },
  EN_REPARACION: { texto: "En reparación", tono: "aviso" },
  EXTRAVIADA: { texto: "Extraviada", tono: "critico" },
  BAJA: { texto: "De baja", tono: "neutro" },
};

export const DOCUMENTO: Record<TipoDocumentoVehiculo, string> = {
  SEGURO: "Seguro",
  VTV: "VTV",
  PATENTE: "Patente",
  CEDULA: "Cédula",
  RUTA: "RUTA",
  OTRO: "Documento",
};
