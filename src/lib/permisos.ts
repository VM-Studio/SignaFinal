import type { Rol } from "@prisma/client";

/**
 * MATRIZ DE PERMISOS: el ÚNICO lugar donde se decide qué ve y qué hace cada rol.
 * Sin Prisma ni Node: también la usa el middleware.
 *
 * ┌──────────────────┬──────────────────────────────────────────────────────────────────────────────┐
 * │ Rol              │ Rutas                                                                        │
 * ├──────────────────┼──────────────────────────────────────────────────────────────────────────────┤
 * │ RESPONSABLE_OBRA │ /inicio /obras /obras/[id] /pedir /pedir/** /mis-pedidos /mis-pedidos/[id]   │
 * │ CAPATAZ          │ /viajes-en-curso /viajes-en-curso/[id] /herramientas /herramientas/[id]       │
 * │                  │ /h/[codigo] /avisos /cuenta                                                  │
 * │ CHOFER           │ /inicio /hoy /solicitudes /solicitudes/[id] /viaje/[id] /combustible         │
 * │                  │ /avisos /cuenta                                                              │
 * │ DEPOSITO         │ /inicio /escanear /herramientas/** /h/[codigo] /entregas /imprimir/**        │
 * │                  │ /avisos /cuenta                                                              │
 * │ ADMINISTRACION   │ /inicio /flota/** /costos /alertas /obras/** /avisos /cuenta                 │
 * │ DIRECCION        │ todas las anteriores + /mapa/** /actividad /solicitudes/** /viajes           │
 * │                  │ /proveedores /usuarios /sobrantes                                            │
 * └──────────────────┴──────────────────────────────────────────────────────────────────────────────┘
 * (/h/[codigo] es el QR pegado en cada herramienta; /imprimir/** son las etiquetas A4.)
 *
 * Una ruta que no está en la matriz del rol NO EXISTE para él: el middleware y el layout
 * lo mandan a /inicio sin mensaje. Las acciones se verifican en el servidor en cada
 * Server Action y cada query (exigirPermiso). La interfaz las usa solo para mostrar botones.
 *
 * Patrones: "/x" exacta · "/x/[id]" un segmento más · "/x/**" la ruta y todo lo de abajo.
 */

export const ACCIONES = [
  // Pedidos y viajes
  "pedidos.ver", "pedidos.crear", "pedidos.cancelarPropios", "pedidos.cancelarCualquiera", "pedidos.tomar", "pedidos.reasignar",
  "viajes.verPropios", "viajes.verTodos", "viajes.ejecutar",
  // Flota
  "flota.ver", "flota.editar", "flota.documentacion", "flota.agenda", "combustible.cargar", "combustible.ver",
  "mantenimiento.ver", "mantenimiento.registrar", "incidentes.registrar",
  // Depósito
  "herramientas.ver", "herramientas.solicitar", "herramientas.mover", "herramientas.devolver", "herramientas.editar",
  "herramientas.mantenimiento", "sobrantes.ver", "sobrantes.editar",
  // Mapa, alertas, costos, actividad
  "mapa.ver", "alertas.ver", "avisos.ver", "costos.ver", "costos.exportar", "actividad.ver",
  // Configuración
  "obras.ver", "proveedores.ver", "usuarios.gestionar",
] as const;

export type Permiso = (typeof ACCIONES)[number];

type Entrada = { rutas: readonly string[]; acciones: readonly Permiso[] };

const OBRA: Entrada = {
  rutas: [
    "/inicio", "/obras", "/obras/[id]", "/pedir", "/pedir/**", "/mis-pedidos", "/mis-pedidos/[id]",
    "/viajes-en-curso", "/viajes-en-curso/[id]", "/herramientas", "/herramientas/[id]", "/h/[codigo]", "/avisos", "/cuenta",
  ],
  acciones: [
    "pedidos.ver", "pedidos.crear", "pedidos.cancelarPropios", "herramientas.ver", "herramientas.solicitar", "herramientas.devolver",
    "sobrantes.ver", "alertas.ver", "avisos.ver", "obras.ver", "proveedores.ver",
  ],
};

const CHOFER: Entrada = {
  rutas: ["/inicio", "/hoy", "/solicitudes", "/solicitudes/[id]", "/viaje/[id]", "/combustible", "/avisos", "/cuenta"],
  acciones: [
    "pedidos.ver", "pedidos.tomar", "viajes.verPropios", "viajes.ejecutar", "combustible.cargar", "combustible.ver",
    "incidentes.registrar", "alertas.ver", "avisos.ver",
  ],
};

const DEPOSITO: Entrada = {
  rutas: ["/inicio", "/escanear", "/herramientas/**", "/h/[codigo]", "/entregas", "/imprimir/**", "/avisos", "/cuenta"],
  acciones: [
    "pedidos.ver", "herramientas.ver", "herramientas.mover", "herramientas.devolver", "herramientas.editar", "herramientas.mantenimiento",
    "sobrantes.ver", "sobrantes.editar", "alertas.ver", "avisos.ver",
  ],
};

const ADMINISTRACION: Entrada = {
  rutas: ["/inicio", "/flota/**", "/costos", "/alertas", "/obras/**", "/avisos", "/cuenta"],
  acciones: [
    "pedidos.ver", "viajes.verTodos", "flota.ver", "flota.editar", "flota.documentacion", "flota.agenda", "combustible.cargar",
    "combustible.ver", "mantenimiento.ver", "mantenimiento.registrar", "incidentes.registrar", "herramientas.ver", "herramientas.editar",
    "herramientas.mantenimiento", "sobrantes.ver", "sobrantes.editar", "alertas.ver", "avisos.ver", "costos.ver", "costos.exportar",
    "obras.ver", "proveedores.ver", "usuarios.gestionar",
  ],
};

// Dirección ve TODO: todas las rutas de los demás roles más las propias.
const DIRECCION: Entrada = {
  rutas: [
    ...new Set([
      ...OBRA.rutas, ...CHOFER.rutas, ...DEPOSITO.rutas, ...ADMINISTRACION.rutas,
      "/mapa/**", "/actividad", "/solicitudes/**", "/viajes", "/proveedores", "/usuarios", "/sobrantes",
    ]),
  ],
  acciones: [
    "pedidos.ver", "pedidos.crear", "pedidos.cancelarPropios", "pedidos.cancelarCualquiera", "pedidos.reasignar", "viajes.verTodos",
    "flota.ver", "flota.editar", "flota.documentacion", "flota.agenda", "combustible.cargar", "combustible.ver", "mantenimiento.ver",
    "mantenimiento.registrar", "incidentes.registrar", "herramientas.ver", "herramientas.solicitar", "herramientas.mover", "herramientas.editar",
    "herramientas.mantenimiento", "sobrantes.ver", "sobrantes.editar", "mapa.ver", "alertas.ver", "avisos.ver", "costos.ver",
    "costos.exportar", "actividad.ver", "obras.ver", "proveedores.ver", "usuarios.gestionar",
  ],
};

export const MATRIZ: Record<Rol, Entrada> = {
  DIRECCION,
  RESPONSABLE_OBRA: OBRA,
  CAPATAZ: { rutas: OBRA.rutas, acciones: [...OBRA.acciones, "pedidos.cancelarCualquiera"] },
  CHOFER,
  DEPOSITO,
  ADMINISTRACION,
};

export function puede(rol: Rol, permiso: Permiso): boolean {
  return MATRIZ[rol].acciones.includes(permiso);
}

function coincide(patron: string, ruta: string) {
  if (patron.endsWith("/**")) {
    const base = patron.slice(0, -3);
    return ruta === base || ruta.startsWith(base + "/");
  }
  const p = patron.split("/");
  const r = ruta.split("/");
  return p.length === r.length && p.every((s, i) => (s.startsWith("[") && s.endsWith("]") ? r[i] !== "" : s === r[i]));
}

/** ¿La ruta existe para este rol? */
export function rutaPermitida(rol: Rol, ruta: string): boolean {
  const limpia = ruta.length > 1 ? ruta.replace(/\/+$/, "") : ruta;
  return MATRIZ[rol].rutas.some((p) => coincide(p, limpia));
}

/** Roles que ven todas las obras. Responsable de obra: solo las suyas. */
export function veTodasLasObras(rol: Rol) {
  return rol !== "RESPONSABLE_OBRA";
}

/**
 * Rutas de antes de la reorganización por rol: a dónde van ahora.
 * null = la ruta vieja no corresponde a ese rol (el control de rutas lo manda a /inicio).
 */
export function rutaNueva(rol: Rol, ruta: string): string | null {
  const obra = rol === "RESPONSABLE_OBRA" || rol === "CAPATAZ";
  if (ruta === "/pedidos/nuevo") return "/pedir";
  if (ruta === "/pedidos") return obra ? "/mis-pedidos" : "/solicitudes";
  const detalle = ruta.match(/^\/pedidos\/([^/]+)$/);
  if (detalle) return `${obra ? "/mis-pedidos" : rol === "CHOFER" ? "/viaje" : "/solicitudes"}/${detalle[1]}`;
  if (ruta === "/viajes" && rol === "CHOFER") return "/hoy";
  if (ruta === "/viajes" && obra) return "/viajes-en-curso";
  if (ruta === "/mantenimiento") return "/flota/mantenimiento";
  if (ruta === "/alertas" && !rutaPermitida(rol, "/alertas")) return "/avisos";
  return null;
}

/** A dónde lleva "ver el pedido" para cada rol (null si ese rol no tiene pantalla de pedidos). */
export function enlacePedido(rol: Rol, pedidoId: string): string | null {
  const ruta = rutaNueva(rol, `/pedidos/${pedidoId}`)!;
  return rutaPermitida(rol, ruta) ? ruta : null;
}
