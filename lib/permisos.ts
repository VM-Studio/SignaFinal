import type { Rol } from "@prisma/client";

/**
 * Único lugar donde se define quién puede hacer qué.
 * Se verifica en el servidor en cada acción (ver lib/auth/usuario-actual.ts)
 * y se usa en la interfaz solo para mostrar u ocultar botones.
 */
const TODOS: Rol[] = [
  "DIRECCION",
  "RESPONSABLE_OBRA",
  "CAPATAZ",
  "CHOFER",
  "DEPOSITO",
  "ADMINISTRACION",
];

export const PERMISOS = {
  // Pedidos de viaje
  "pedidos.ver": TODOS,
  "pedidos.crear": ["DIRECCION", "RESPONSABLE_OBRA", "CAPATAZ"],
  /** Cancelar pedidos de otras personas (los propios siempre se pueden cancelar). */
  "pedidos.cancelarCualquiera": ["DIRECCION", "CAPATAZ"],
  "pedidos.tomar": ["CHOFER"],

  // Viajes
  "viajes.ver": TODOS,
  "viajes.ejecutar": ["CHOFER"],

  // Flota
  "flota.ver": ["DIRECCION", "ADMINISTRACION", "CHOFER", "DEPOSITO", "CAPATAZ"],
  "flota.editar": ["DIRECCION", "ADMINISTRACION"],
  "combustible.cargar": ["CHOFER", "ADMINISTRACION", "DIRECCION", "CAPATAZ", "RESPONSABLE_OBRA"],
  "mantenimiento.registrar": ["DEPOSITO", "ADMINISTRACION", "DIRECCION"],

  // Mapa
  "mapa.ver": ["DIRECCION", "ADMINISTRACION", "CAPATAZ", "RESPONSABLE_OBRA"],

  // Depósito
  "deposito.ver": TODOS,
  "deposito.mover": ["DEPOSITO"],
  "deposito.editar": ["DEPOSITO", "ADMINISTRACION"],
  "herramientas.solicitar": ["RESPONSABLE_OBRA", "CAPATAZ", "DIRECCION"],

  // Obras (lectura desde Lebane)
  "obras.ver": TODOS,
  "obras.sincronizar": ["DIRECCION", "ADMINISTRACION"],

  // Costos y exportaciones
  "costos.ver": ["DIRECCION", "ADMINISTRACION"],
  "costos.exportar": ["DIRECCION", "ADMINISTRACION"],

  // Alertas
  "alertas.ver": ["DIRECCION", "ADMINISTRACION", "DEPOSITO", "CAPATAZ", "CHOFER", "RESPONSABLE_OBRA"],

  // Personas
  "usuarios.gestionar": ["DIRECCION", "ADMINISTRACION"],
} as const satisfies Record<string, readonly Rol[]>;

export type Permiso = keyof typeof PERMISOS;

export function puede(rol: Rol, permiso: Permiso): boolean {
  return (PERMISOS[permiso] as readonly Rol[]).includes(rol);
}

/** Roles que ven todas las obras sin estar asignados a cada una. */
export const ROLES_TODAS_LAS_OBRAS: Rol[] = ["DIRECCION", "CAPATAZ", "ADMINISTRACION", "DEPOSITO", "CHOFER"];

/** Qué áreas de alertas le interesan a cada rol. */
export const AREAS_ALERTA_POR_ROL: Record<Rol, ("FLOTA" | "PEDIDOS" | "DEPOSITO" | "PERSONAS")[]> = {
  DIRECCION: ["FLOTA", "PEDIDOS", "DEPOSITO", "PERSONAS"],
  ADMINISTRACION: ["FLOTA", "PERSONAS", "PEDIDOS"],
  DEPOSITO: ["DEPOSITO", "FLOTA"],
  CAPATAZ: ["PEDIDOS", "DEPOSITO"],
  RESPONSABLE_OBRA: ["PEDIDOS"],
  CHOFER: ["PEDIDOS", "PERSONAS"],
};
