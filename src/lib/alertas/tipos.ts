import type { Severidad } from "@prisma/client";

/** Lo que calcula cada regla. claveUnica = regla + entidad: nunca se duplica. */
export type AlertaCalculada = {
  claveUnica: string;
  regla: string;
  severidad: Severidad;
  titulo: string;
  detalle: string;
  entidadTipo: "PedidoViaje" | "Viaje" | "Vehiculo" | "DocumentoVehiculo" | "Usuario" | "Herramienta" | "CargaCombustible";
  entidadId: string;
  enlace: string;
  obraId?: string | null;
  usuarioId?: string | null;
};

/** Módulos: después de cada acción se reevalúan solo las reglas del módulo afectado. */
export type Modulo = "pedidos" | "flota" | "herramientas" | "cusat";

export type Regla = { nombre: string; modulo: Modulo; evaluar: () => Promise<AlertaCalculada[]> };
