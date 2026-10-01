import type { Rol } from "@prisma/client";

/**
 * Matriz de permisos: el ÚNICO lugar donde se define quién puede hacer qué.
 * Se verifica en el servidor en cada Server Action y cada query (exigirPermiso),
 * y la interfaz la usa solo para mostrar u ocultar navegación y botones.
 */
const TODOS: Rol[] = ["DIRECCION", "RESPONSABLE_OBRA", "CAPATAZ", "CHOFER", "DEPOSITO", "ADMINISTRACION"];
const OBRA: Rol[] = ["RESPONSABLE_OBRA", "CAPATAZ"];
const GESTION: Rol[] = ["DIRECCION", "ADMINISTRACION"];

export const PERMISOS = {
  // Pedidos y viajes
  "pedidos.ver": TODOS, // la cola es única y la ven todos
  "pedidos.crear": ["DIRECCION", ...OBRA],
  "pedidos.cancelarPropios": ["DIRECCION", ...OBRA],
  "pedidos.cancelarCualquiera": ["DIRECCION", "CAPATAZ"],
  "pedidos.tomar": ["CHOFER"],
  "pedidos.reasignar": ["DIRECCION"],
  "viajes.verPropios": ["CHOFER"],
  "viajes.verTodos": [...GESTION, "CAPATAZ"],
  "viajes.ejecutar": ["CHOFER"],

  // Flota
  "flota.ver": TODOS,
  "flota.editar": GESTION,
  "flota.documentacion": GESTION,
  "combustible.cargar": ["CHOFER", ...GESTION],
  "combustible.ver": ["CHOFER", ...GESTION, "DEPOSITO"],
  "mantenimiento.ver": [...GESTION, "DEPOSITO"],
  "mantenimiento.registrar": [...GESTION, "DEPOSITO"],
  "incidentes.registrar": [...GESTION, "CHOFER"],
  "flota.agenda": [...GESTION, "CAPATAZ", "DEPOSITO"],

  // Depósito
  "herramientas.ver": TODOS,
  "herramientas.solicitar": ["DIRECCION", ...OBRA],
  "herramientas.mover": ["DEPOSITO"], // entregar, transferir, reparación, extravío, escanear
  "herramientas.devolver": ["DEPOSITO", ...OBRA], // responsable: solo lo que está en sus obras
  "herramientas.editar": ["DEPOSITO", ...GESTION], // alta, edición, baja, etiquetas, CSV
  "herramientas.mantenimiento": ["DEPOSITO", ...GESTION],
  "sobrantes.ver": ["DEPOSITO", ...GESTION, ...OBRA],
  "sobrantes.editar": ["DEPOSITO", ...GESTION],

  // Mapa, alertas, costos
  "mapa.ver": [...GESTION, ...OBRA],
  "alertas.ver": TODOS,
  "costos.ver": GESTION,
  "costos.exportar": GESTION,

  // Configuración
  "obras.ver": TODOS,
  "proveedores.ver": [...GESTION, ...OBRA],
  "usuarios.gestionar": GESTION,
} as const satisfies Record<string, readonly Rol[]>;

export type Permiso = keyof typeof PERMISOS;

export function puede(rol: Rol, permiso: Permiso): boolean {
  return (PERMISOS[permiso] as readonly Rol[]).includes(rol);
}

/** Roles que ven todas las obras. Responsable de obra: solo las suyas. */
export function veTodasLasObras(rol: Rol) {
  return rol !== "RESPONSABLE_OBRA";
}

/** Qué alertas le llegan a cada rol (por tipo de entidad). */
export const ALERTAS_POR_ROL: Record<Rol, string[] | "todas"> = {
  DIRECCION: "todas",
  ADMINISTRACION: "todas",
  CAPATAZ: ["PedidoViaje", "Obra", "Herramienta"],
  RESPONSABLE_OBRA: ["PedidoViaje", "Obra"],
  CHOFER: ["PedidoViaje", "Usuario"],
  DEPOSITO: ["Herramienta", "Vehiculo"],
};
