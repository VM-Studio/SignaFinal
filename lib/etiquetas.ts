import type {
  CategoriaItem,
  EstadoItem,
  EstadoPedido,
  EstadoSolicitud,
  Prioridad,
  Rol,
  TipoCarga,
  TipoMantenimiento,
  TipoMovimiento,
  TipoVehiculo,
  VehiculoRequerido,
} from "@prisma/client";

/** Palabras que ve la gente para cada valor interno. Nunca se muestra el código. */

export const ROL: Record<Rol, string> = {
  DIRECCION: "Dirección",
  RESPONSABLE_OBRA: "Responsable de obra",
  CAPATAZ: "Capataz general",
  CHOFER: "Chofer",
  DEPOSITO: "Depósito",
  ADMINISTRACION: "Administración",
};

export type Tono = "ok" | "aviso" | "critico" | "neutro" | "activo";

export const ESTADO_PEDIDO: Record<EstadoPedido, { texto: string; tono: Tono }> = {
  PENDIENTE: { texto: "Pendiente", tono: "aviso" },
  TOMADO: { texto: "Tomado", tono: "activo" },
  EN_VIAJE: { texto: "En viaje", tono: "activo" },
  ENTREGADO: { texto: "Entregado", tono: "ok" },
  CANCELADO: { texto: "Cancelado", tono: "neutro" },
};

/** "Tomado por Claudio", "En viaje con Cristian"… */
export function textoEstadoPedido(estado: EstadoPedido, chofer?: string | null) {
  if (estado === "TOMADO" && chofer) return `Tomado por ${chofer}`;
  if (estado === "EN_VIAJE" && chofer) return `En viaje · ${chofer}`;
  if (estado === "ENTREGADO" && chofer) return `Entregado por ${chofer}`;
  return ESTADO_PEDIDO[estado].texto;
}

export const TIPO_CARGA: Record<TipoCarga, string> = {
  MATERIALES: "Materiales",
  MAQUINARIA: "Maquinaria",
  HERRAMIENTAS: "Herramientas",
  OTRO: "Otro",
};

export const VEHICULO_REQUERIDO: Record<VehiculoRequerido, string> = {
  CUALQUIERA: "Lo que haya",
  CAMION: "Camión",
  CAMIONETA: "Camioneta",
  AUTO: "Auto",
};

export const TIPO_VEHICULO: Record<TipoVehiculo, string> = {
  CAMION: "Camión",
  CAMIONETA: "Camioneta",
  AUTO: "Auto",
};

export const PRIORIDAD: Record<Prioridad, string> = {
  NORMAL: "Normal",
  URGENTE: "Urgente",
};

export const TIPO_MANTENIMIENTO: Record<TipoMantenimiento, string> = {
  SERVICE: "Service",
  CUBIERTAS: "Cubiertas",
  FRENOS: "Frenos",
  REPARACION: "Reparación",
  OTRO: "Otro",
};

export const CATEGORIA_ITEM: Record<CategoriaItem, string> = {
  MAQUINARIA: "Maquinaria",
  HERRAMIENTA: "Herramienta",
  SOBRANTE: "Sobrante",
};

export const ESTADO_ITEM: Record<EstadoItem, { texto: string; tono: Tono }> = {
  OPERATIVO: { texto: "Operativa", tono: "ok" },
  EN_REPARACION: { texto: "En reparación", tono: "aviso" },
  FUERA_DE_SERVICIO: { texto: "Fuera de servicio", tono: "critico" },
};

export const TIPO_MOVIMIENTO: Record<TipoMovimiento, string> = {
  ALTA: "Alta",
  ENTREGA: "Entrega a obra",
  DEVOLUCION: "Devolución al depósito",
  TRANSFERENCIA: "Transferencia entre obras",
  AJUSTE: "Ajuste de stock",
};

export const ESTADO_SOLICITUD: Record<EstadoSolicitud, { texto: string; tono: Tono }> = {
  PENDIENTE: { texto: "Pendiente", tono: "aviso" },
  COMPLETADA: { texto: "Completada", tono: "ok" },
  RECHAZADA: { texto: "Rechazada", tono: "critico" },
  CANCELADA: { texto: "Cancelada", tono: "neutro" },
};

export const DEPOSITO = "Depósito";
