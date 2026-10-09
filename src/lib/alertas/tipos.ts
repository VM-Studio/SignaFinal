import type { Severidad } from "@prisma/client";

/** Lo que calcula cada regla. claveUnica = regla + entidad: nunca se duplica. */
export type AlertaCalculada = {
  claveUnica: string;
  regla: string;
  severidad: Severidad;
  titulo: string;
  detalle: string;
  entidadTipo: "PedidoViaje" | "Viaje" | "Vehiculo" | "DocumentoVehiculo" | "Usuario" | "Herramienta" | "CargaCombustible" | "PedidoMaterial" | "MaterialListo";
  entidadId: string;
  enlace: string;
  obraId?: string | null;
  usuarioId?: string | null;
  /** Personas puntuales (el que pidió, el chofer, quien tiene la herramienta). Se filtran por rol en destinatarios.ts. */
  usuarios?: string[];
};

/** Módulos: después de cada acción se reevalúan solo las reglas del módulo afectado. */
export type Modulo = "pedidos" | "flota" | "herramientas" | "cusat" | "materiales";

export type Regla = { nombre: string; modulo: Modulo; evaluar: () => Promise<AlertaCalculada[]> };
