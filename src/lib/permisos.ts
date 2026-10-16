import type { Rol } from "@prisma/client";

/**
 * MATRIZ DE PERMISOS: el ÚNICO lugar donde se decide qué ve y qué hace cada rol.
 * Sin Prisma ni Node: también la usa el middleware.
 *
 * ┌──────────────────┬──────────────────────────────────────────────────────────────────────────────┐
 * │ Rol              │ Rutas                                                                        │
 * ├──────────────────┼──────────────────────────────────────────────────────────────────────────────┤
 * │ RESPONSABLE_OBRA │ /inicio /obras /obras/[id] /pedir /pedir/** /pedir-materiales /mis-pedidos/** │
 * │                  │ /compras/oc/** (el documento de compra que arma y sigue)                      │
 * │ CAPATAZ          │ /viajes-en-curso /viajes-en-curso/[id] /herramientas /herramientas/[id]       │
 * │                  │ /avisos /cuenta                                                              │
 * │ CHOFER           │ /inicio /hoy /solicitudes /solicitudes/[id] /viaje/[id] /combustible         │
 * │                  │ /avisos /cuenta                                                              │
 * │ DEPOSITO         │ /inicio /herramientas/** /entregas /sobrantes                                │
 * │                  │ /avisos /cuenta                                                              │
 * │ ADMINISTRACION   │ /inicio /flota/** /costos /alertas /obras/** /usuarios /avisos /cuenta       │
 * │                  │ /compras/tablero /compras/facturacion /compras/oc/** (documento de compra)   │
 * │ COMPRAS          │ /inicio /compras /compras/** /habilitados /proveedores /proveedores/[id]     │
 * │                  │ /avisos /cuenta                                                              │
 * │ DIRECCION        │ todas las anteriores + /mapa/** /actividad /solicitudes/** /viajes           │
 * │                  │ /proveedores /usuarios /sobrantes /aprobaciones                              │
 * └──────────────────┴──────────────────────────────────────────────────────────────────────────────┘
 *
 * Una ruta que no está en la matriz del rol NO EXISTE para él: el middleware y el layout
 * lo mandan a /inicio sin mensaje. Las acciones se verifican en el servidor en cada
 * Server Action y cada query (exigirPermiso). La interfaz las usa solo para mostrar botones.
 *
 * Patrones: "/x" exacta · "/x/[id]" un segmento más · "/x/**" la ruta y todo lo de abajo.
 */

export const ACCIONES = [
  // Pedidos y viajes
  "pedidos.ver", "pedidos.crear", "pedidos.cancelarPropios", "pedidos.cancelarCualquiera", "pedidos.tomar", "pedidos.reasignar", "pedidos.reprogramar",
  // Compras pide viajes "para" alguien de obra (y edita o cancela solicitudes pendientes)
  "pedidos.coordinar",
  "viajes.verPropios", "viajes.verTodos", "viajes.ejecutar",
  // Flota
  "flota.ver", "flota.editar", "flota.documentacion", "flota.agenda", "combustible.cargar", "combustible.ver",
  "mantenimiento.ver", "mantenimiento.registrar", "incidentes.registrar",
  // Depósito
  "herramientas.ver", "herramientas.solicitar", "herramientas.mover", "herramientas.devolver", "herramientas.editar",
  "herramientas.mantenimiento", "sobrantes.ver", "sobrantes.editar",
  // Materiales y Compras: pedir (obra), gestionar (Compras), aprobar (el dueño)
  "materiales.pedir", "materiales.gestionar", "materiales.aprobar",
  // Mapa, alertas, costos, actividad
  "mapa.ver", "rastreo.configurar", "alertas.ver", "avisos.ver", "costos.ver", "costos.exportar", "actividad.ver",
  // Configuración
  "obras.ver", "obras.cargar", "proveedores.ver", "proveedores.cargar", "usuarios.gestionar", "ubicaciones.cargar",
  // Compras según Alejandra: razones sociales, numeradores de OC/PE (solo el dueño) y la cotización del dólar
  "razonesSociales.editar", "compras.numeradores", "dolar.ver",
] as const;

export type Permiso = (typeof ACCIONES)[number];

type Entrada = { rutas: readonly string[]; acciones: readonly Permiso[] };

const OBRA: Entrada = {
  rutas: [
    "/inicio", "/obras", "/obras/[id]", "/pedir", "/pedir/**", "/pedir-materiales", "/mis-pedidos", "/mis-pedidos/[id]", "/mis-pedidos/material/[id]",
    "/viajes-en-curso", "/viajes-en-curso/[id]", "/herramientas", "/herramientas/[id]", "/avisos", "/cuenta",
    // El documento de compra (OC/PE) que arma, envía a Compras y sigue: la plantilla compartida.
    "/compras/oc/**",
  ],
  acciones: [
    "pedidos.ver", "pedidos.crear", "pedidos.cancelarPropios", "herramientas.ver", "herramientas.solicitar", "herramientas.devolver",
    "materiales.pedir", "sobrantes.ver", "alertas.ver", "avisos.ver", "obras.ver", "proveedores.ver",
  ],
};

const CHOFER: Entrada = {
  rutas: ["/inicio", "/hoy", "/solicitudes", "/solicitudes/[id]", "/viaje/[id]", "/viaje/[id]/conducir", "/combustible", "/avisos", "/cuenta"],
  acciones: [
    "pedidos.ver", "pedidos.tomar", "viajes.verPropios", "viajes.ejecutar", "combustible.cargar", "combustible.ver",
    "incidentes.registrar", "alertas.ver", "avisos.ver",
  ],
};

const DEPOSITO: Entrada = {
  rutas: ["/inicio", "/herramientas/**", "/entregas", "/sobrantes", "/avisos", "/cuenta"],
  acciones: [
    "pedidos.ver", "herramientas.ver", "herramientas.mover", "herramientas.devolver", "herramientas.editar", "herramientas.mantenimiento",
    "sobrantes.ver", "sobrantes.editar", "alertas.ver", "avisos.ver",
  ],
};

const ADMINISTRACION: Entrada = {
  // Camila: el tablero de Compras y la facturación de las órdenes (secciones 3 y 4 de la plantilla).
  rutas: ["/inicio", "/flota/**", "/costos", "/alertas", "/obras/**", "/proveedores", "/proveedores/[id]", "/usuarios", "/configuracion/ubicaciones", "/configuracion/razones-sociales", "/compras/tablero", "/compras/facturacion", "/compras/oc/**", "/avisos", "/cuenta"],
  acciones: [
    "pedidos.ver", "viajes.verTodos", "flota.ver", "flota.editar", "flota.documentacion", "flota.agenda", "combustible.cargar",
    "combustible.ver", "mantenimiento.ver", "mantenimiento.registrar", "incidentes.registrar", "herramientas.ver", "herramientas.editar",
    "herramientas.mantenimiento", "sobrantes.ver", "sobrantes.editar", "alertas.ver", "avisos.ver", "costos.ver", "costos.exportar",
    "obras.ver", "obras.cargar", "proveedores.ver", "proveedores.cargar", "usuarios.gestionar", "ubicaciones.cargar",
    "razonesSociales.editar", "dolar.ver",
  ],
};

// Compras: la cola de pedidos de material, lo habilitado para retirar y los proveedores.
const COMPRAS: Entrada = {
  // Pedir materiales es "Nuevo pedido" dentro de /compras; la numeración vive en la Configuración del dueño.
  rutas: ["/inicio", "/compras", "/compras/**", "/habilitados", "/proveedores", "/proveedores/[id]", "/solicitudes/[id]", "/avisos", "/cuenta"],
  acciones: ["materiales.gestionar", "materiales.pedir", "proveedores.ver", "proveedores.cargar", "obras.ver", "obras.cargar", "alertas.ver", "avisos.ver", "dolar.ver", "pedidos.ver", "pedidos.coordinar", "viajes.verTodos"],
};

// Dirección ve TODO: todas las rutas de los demás roles más las propias.
const DIRECCION: Entrada = {
  rutas: [
    ...new Set([
      // Sin la pantalla Hoy del chofer ni la lista de viajes de la obra: el dueño los ve en Viajes en curso.
      ...OBRA.rutas.filter((r) => !r.startsWith("/viajes-en-curso")), ...CHOFER.rutas.filter((r) => r !== "/hoy"), ...DEPOSITO.rutas, ...ADMINISTRACION.rutas, ...COMPRAS.rutas,
      "/aprobaciones", "/configuracion/rastreo", "/configuracion/ubicaciones", "/configuracion/razones-sociales", "/configuracion/compras", "/mapa/**", "/actividad", "/actividad/[id]", "/solicitudes/**", "/viajes", "/proveedores", "/usuarios", "/sobrantes",
    ]),
  ],
  acciones: [
    "pedidos.ver", "pedidos.crear", "pedidos.cancelarPropios", "pedidos.cancelarCualquiera", "pedidos.reasignar", "pedidos.reprogramar", "pedidos.coordinar", "viajes.verTodos",
    "flota.ver", "flota.editar", "flota.documentacion", "flota.agenda", "combustible.cargar", "combustible.ver", "mantenimiento.ver",
    "mantenimiento.registrar", "incidentes.registrar", "herramientas.ver", "herramientas.solicitar", "herramientas.mover", "herramientas.editar",
    "herramientas.mantenimiento", "sobrantes.ver", "sobrantes.editar", "mapa.ver", "alertas.ver", "avisos.ver", "costos.ver",
    "costos.exportar", "actividad.ver", "obras.ver", "proveedores.ver", "usuarios.gestionar",
    "materiales.pedir", "materiales.gestionar", "materiales.aprobar", "rastreo.configurar", "obras.cargar", "proveedores.cargar", "ubicaciones.cargar",
    "razonesSociales.editar", "compras.numeradores", "dolar.ver",
  ],
};

export const MATRIZ: Record<Rol, Entrada> = {
  COMPRAS,
  DIRECCION,
  RESPONSABLE_OBRA: OBRA,
  CAPATAZ: { rutas: OBRA.rutas, acciones: OBRA.acciones },
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

/**
 * Dónde cae cada rol al entrar (y adónde lleva el logo): el primer módulo de su barra. No hay página de inicio:
 * /inicio redirige acá. Tiene que coincidir con NAV[rol].barra[0] (navegacion.test.ts lo verifica).
 */
const INICIOS: Record<Rol, string> = {
  DIRECCION: "/aprobaciones",
  RESPONSABLE_OBRA: "/pedir",
  CAPATAZ: "/pedir",
  CHOFER: "/hoy",
  DEPOSITO: "/herramientas",
  ADMINISTRACION: "/compras/facturacion",
  COMPRAS: "/compras/tablero",
};
export const inicioDe = (rol: Rol) => INICIOS[rol];

/** Roles que ven todas las obras. Responsable de obra: solo las suyas. */
export function veTodasLasObras(rol: Rol) {
  // (Compras ve los pedidos de material de todas las obras.)
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
  // Escaneo y etiquetas QR ya no existen: al depósito (o a las herramientas de la obra).
  if (["/escanear", "/herramientas/escanear", "/herramientas/etiquetas"].includes(ruta) || ruta.startsWith("/h/") || ruta.startsWith("/imprimir/")) return "/herramientas";
  if (ruta === "/alertas" && !rutaPermitida(rol, "/alertas")) return "/avisos";
  // Compras no tiene inicio: entra directo al tablero.
  if (ruta === "/inicio") return inicioDe(rol);
  // El pedido de material ahora es el documento de compra: los enlaces viejos van a su plantilla.
  const viejo = ruta.match(/^\/(?:materiales|mis-pedidos\/material|compras\/ordenes)\/([^/]+)$/) ?? ruta.match(/^\/compras\/([^/]+)(?:\/oc)?$/);
  if (viejo && !["tablero", "ordenes", "viajes", "importar", "nuevo", "facturacion", "oc"].includes(viejo[1]) && viejo[1] !== "nueva") return `/compras/oc/${viejo[1]}`;
  if (ruta === "/compras/ordenes" || ruta === "/compras/ordenes/nueva") return ruta === "/compras/ordenes" ? "/compras/tablero" : "/compras/oc/nueva";
  return null;
}

/** A dónde lleva "ver el pedido" para cada rol (null si ese rol no tiene pantalla de pedidos). */
export function enlacePedido(rol: Rol, pedidoId: string): string | null {
  const ruta = rutaNueva(rol, `/pedidos/${pedidoId}`)!;
  return rutaPermitida(rol, ruta) ? ruta : null;
}
