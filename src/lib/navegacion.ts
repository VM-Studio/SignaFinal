import type { Rol } from "@prisma/client";
import { rutaPermitida } from "./permisos";

export type Icono =
  | "inicio" | "pedidos" | "pedir" | "viajes" | "combustible" | "flota" | "mantenimiento" | "herramientas"
  | "deposito" | "entregas" | "sobrantes" | "mapa" | "alertas" | "obras" | "proveedores" | "usuarios" | "cuenta" | "mas"
  | "agenda" | "costos" | "hoy" | "avisos" | "actividad" | "importar" | "compras" | "habilitados" | "aprobaciones" | "rastreo"
  | "buscar" | "tablero" | "configuracion";

/** Contadores de la barra (punto rojo con número): los arma el servidor y los actualiza el tiempo real. */
export type ClaveContador = "aprobaciones" | "pedidosNuevos" | "solicitudesNuevas" | "avisos" | "listosRetirar";
export type Seccion = { href: string; titulo: string; icono: Icono; corto?: string; contador?: ClaveContador };

/** Todas las secciones. El título es el del header del celular; "corto", el de la barra inferior. */
export const SECCIONES = {
  inicio: { href: "/inicio", titulo: "Inicio", icono: "inicio" },
  // Obra
  obras: { href: "/obras", titulo: "Obras", icono: "obras" },
  pedir: { href: "/pedir", titulo: "Pedir un viaje", corto: "Pedir", icono: "pedir" },
  misPedidos: { href: "/mis-pedidos", titulo: "Mis pedidos", icono: "pedidos", contador: "listosRetirar" },
  viajesObra: { href: "/viajes-en-curso", titulo: "Viajes", icono: "viajes" },
  pedirMateriales: { href: "/pedir-materiales", titulo: "Pedir materiales", icono: "compras" },
  // Compras
  compras: { href: "/compras", titulo: "Pedidos de material", corto: "Pedidos", icono: "compras", contador: "pedidosNuevos" },
  pedidosMaterial: { href: "/compras", titulo: "Pedidos de material", corto: "Pedidos", icono: "compras" },
  tablero: { href: "/compras/tablero", titulo: "Órdenes", icono: "tablero" },
  tableroLectura: { href: "/compras/tablero", titulo: "Tablero de Compras", icono: "tablero" },
  viajesCompras: { href: "/compras/viajes", titulo: "Viajes", icono: "viajes" },
  importarExcel: { href: "/compras/importar", titulo: "Importar Excel", icono: "importar" },
  habilitados: { href: "/habilitados", titulo: "Habilitados", icono: "habilitados" },
  ordenes: { href: "/compras/ordenes", titulo: "Órdenes de compra", icono: "aprobaciones" },
  aprobaciones: { href: "/aprobaciones", titulo: "Aprobaciones", icono: "aprobaciones", contador: "aprobaciones" },
  // Chofer
  hoy: { href: "/hoy", titulo: "Hoy", icono: "hoy" },
  hoyChoferes: { href: "/hoy", titulo: "Vista del chofer", icono: "hoy" },
  solicitudes: { href: "/solicitudes", titulo: "Solicitudes", icono: "pedidos", contador: "solicitudesNuevas" },
  solicitudesDireccion: { href: "/solicitudes", titulo: "Solicitudes", icono: "pedidos" },
  combustible: { href: "/combustible", titulo: "Combustible", icono: "combustible" },
  // Depósito ("Buscar": no hay escaneo ni etiquetas QR, las herramientas se buscan por nombre)
  buscar: { href: "/herramientas?buscar=1", titulo: "Buscar", icono: "buscar" },
  deposito: { href: "/herramientas", titulo: "Depósito", icono: "deposito" },
  herramientasDeposito: { href: "/herramientas", titulo: "Herramientas", icono: "herramientas" },
  herramientas: { href: "/herramientas", titulo: "Herramientas", icono: "herramientas" },
  entregas: { href: "/entregas", titulo: "Entregas", icono: "entregas" },
  sobrantes: { href: "/sobrantes", titulo: "Sobrantes", icono: "sobrantes" },
  importar: { href: "/herramientas/importar", titulo: "Alta masiva", icono: "importar" },
  // Gestión
  flota: { href: "/flota", titulo: "Flota", icono: "flota" },
  agenda: { href: "/flota/agenda", titulo: "Agenda", icono: "agenda" },
  mantenimiento: { href: "/flota/mantenimiento", titulo: "Mantenimiento", icono: "mantenimiento" },
  costos: { href: "/costos", titulo: "Costos", icono: "costos" },
  alertas: { href: "/alertas", titulo: "Alertas", icono: "alertas" },
  // Dirección
  mapa: { href: "/mapa", titulo: "Mapa", icono: "mapa" },
  viajes: { href: "/viajes", titulo: "Viajes en curso", icono: "viajes" },
  viajesAObras: { href: "/viajes-en-curso", titulo: "Viajes hacia obras", icono: "viajes" },
  historial: { href: "/mapa/historial", titulo: "Recorridos del día", icono: "mapa" },
  rastreo: { href: "/configuracion/rastreo", titulo: "Rastreo (Cusat)", icono: "rastreo" },
  ubicaciones: { href: "/configuracion/ubicaciones", titulo: "Depósitos y base", icono: "deposito" },
  razonesSociales: { href: "/configuracion/razones-sociales", titulo: "Razones sociales", icono: "configuracion" },
  configCompras: { href: "/configuracion/compras", titulo: "Numeración y solicitantes", icono: "configuracion" },
  actividad: { href: "/actividad", titulo: "Actividad", icono: "actividad" },
  proveedores: { href: "/proveedores", titulo: "Proveedores", icono: "proveedores" },
  usuarios: { href: "/usuarios", titulo: "Usuarios", icono: "usuarios" },
  // Todos
  avisos: { href: "/avisos", titulo: "Avisos", icono: "avisos", contador: "avisos" },
  misAvisos: { href: "/avisos", titulo: "Mis avisos", icono: "avisos", contador: "avisos" },
  cuenta: { href: "/cuenta", titulo: "Mi cuenta", icono: "cuenta" },
} as const satisfies Record<string, Seccion>;

type Clave = keyof typeof SECCIONES;

type GrupoClaves = { titulo: string | null; claves: Clave[] };

/**
 * Navegación de cada rol (CLAUDE.md, "Navegación"): lo más usado adelante. Barra inferior del
 * celular: 3 ítems + "Más" (grilla de tarjetas, con Cuenta y Cerrar sesión al pie). Escritorio: la barra
 * lateral con los mismos 3 arriba y el resto en un grupo "Más" plegado. Cada ruta que el rol tiene en la
 * matriz de permisos tiene al menos un enlace acá (lo verifica scripts/verificar-navegacion.ts).
 */
const NAV: Record<Rol, { barra: Clave[]; mas: GrupoClaves[] }> = {
  DIRECCION: {
    barra: ["aprobaciones", "pedidosMaterial", "avisos"],
    mas: [
      { titulo: "Viajes", claves: ["mapa", "viajes", "solicitudesDireccion", "historial", "pedir", "misPedidos", "viajesAObras", "hoyChoferes"] },
      { titulo: "Compras", claves: ["tablero", "ordenes", "habilitados", "pedirMateriales"] },
      { titulo: "Flota", claves: ["flota", "costos", "agenda", "mantenimiento", "combustible"] },
      { titulo: "Depósito", claves: ["herramientasDeposito", "sobrantes", "entregas"] },
      { titulo: "Seguimiento", claves: ["actividad", "alertas"] },
      { titulo: "Obras y proveedores", claves: ["obras", "proveedores"] },
      { titulo: "Configuración", claves: ["rastreo", "razonesSociales", "configCompras", "ubicaciones", "usuarios", "importar"] },
      { titulo: null, claves: ["inicio"] },
    ],
  },
  COMPRAS: { barra: ["compras", "tablero", "viajesCompras"], mas: [{ titulo: null, claves: ["habilitados", "proveedores", "importarExcel", "pedirMateriales", "configCompras", "misAvisos", "inicio"] }] },
  RESPONSABLE_OBRA: { barra: ["pedir", "misPedidos", "viajesObra"], mas: [{ titulo: null, claves: ["herramientas", "obras", "pedirMateriales", "misAvisos", "inicio"] }] },
  CAPATAZ: { barra: ["pedir", "misPedidos", "viajesObra"], mas: [{ titulo: null, claves: ["herramientas", "obras", "pedirMateriales", "misAvisos", "inicio"] }] },
  CHOFER: { barra: ["hoy", "solicitudes", "avisos"], mas: [{ titulo: null, claves: ["combustible", "inicio"] }] },
  DEPOSITO: { barra: ["buscar", "herramientasDeposito", "entregas"], mas: [{ titulo: null, claves: ["sobrantes", "importar", "misAvisos", "inicio"] }] },
  ADMINISTRACION: { barra: ["flota", "costos", "alertas"], mas: [{ titulo: null, claves: ["obras", "proveedores", "razonesSociales", "agenda", "mantenimiento", "tableroLectura", "ubicaciones", "usuarios", "misAvisos", "inicio"] }] },
};

// Nunca se muestra un enlace a una ruta que el rol no tiene (la matriz manda).
const visibles = (rol: Rol, claves: Clave[]) =>
  claves.map((k) => SECCIONES[k] as Seccion).filter((s) => rutaPermitida(rol, s.href.split("?")[0]));

export function barraInferior(rol: Rol): Seccion[] {
  return visibles(rol, NAV[rol].barra).map((s) => ({ ...s, titulo: s.corto ?? s.titulo }));
}

export type Grupo = { titulo: string | null; items: Seccion[] };

/** "Más": agrupado (Dirección) o una sola lista. */
export function menuMas(rol: Rol): Grupo[] {
  return NAV[rol].mas.map((g) => ({ titulo: g.titulo, items: visibles(rol, g.claves) })).filter((g) => g.items.length > 0);
}

/** Escritorio: los más usados arriba (los de la barra) y el resto en "Más" (plegado, con sus grupos). */
export function gruposEscritorio(rol: Rol): { principales: Seccion[]; mas: Grupo[] } {
  return { principales: visibles(rol, NAV[rol].barra), mas: menuMas(rol) };
}

/** Todos los enlaces de navegación del rol (barra, Más, y el header: logo → inicio, campana, avatar). */
export function enlacesDelRol(rol: Rol): string[] {
  return [...visibles(rol, NAV[rol].barra), ...menuMas(rol).flatMap((g) => g.items)].map((s) => s.href.split("?")[0]).concat(["/inicio", "/avisos", "/cuenta"]);
}

/**
 * Título del header según la ruta. Primero las secciones del rol (la misma ruta puede llamarse
 * distinto: /herramientas es "Depósito" para el depósito y "Herramientas" para la obra).
 */
export function tituloDeRuta(pathname: string, propias: Seccion[] = []): string {
  const propia = propias.find((s) => s.href.split("?")[0] === pathname);
  if (propia) return propia.titulo;
  const todas = Object.values(SECCIONES) as Seccion[];
  const exacta = todas.find((s) => s.href === pathname);
  if (exacta) return exacta.titulo;
  if (/^\/compras\/[^/]+\/oc$/.test(pathname)) return "Orden de compra";
  if (pathname === "/compras/tablero") return "Tablero";
  if (pathname.startsWith("/compras/viajes")) return "Viajes";
  if (pathname === "/compras/ordenes/nueva") return "Nueva orden";
  if (pathname.startsWith("/compras/ordenes/")) return "Orden";
  if (pathname === "/compras/importar") return "Importar desde Excel";
  if (pathname.startsWith("/compras/") || pathname.startsWith("/mis-pedidos/material/")) return "Pedido de material";
  if (pathname.startsWith("/viaje/")) return "Viaje";
  if (pathname.startsWith("/proveedores/")) return "Proveedor";
  if (pathname.startsWith("/solicitudes/") || pathname.startsWith("/mis-pedidos/") || pathname.startsWith("/viajes-en-curso/")) return "Pedido";
  const prefijo = todas.filter((s) => pathname.startsWith(s.href + "/")).sort((a, b) => b.href.length - a.href.length)[0];
  return prefijo?.titulo ?? "SIGNA";
}

/**
 * Rutas de la matriz de permisos del rol que no tienen ningún enlace en su navegación (barra, Más o
 * header). Una ruta cuenta como enlazada si hay un enlace igual o si vive dentro de una sección
 * enlazada (/pedir/retiro está en /pedir). Las rutas con [id] se abren desde las listas.
 */
export function rutasSinEnlace(rol: Rol, rutas: readonly string[]): string[] {
  const enlaces = enlacesDelRol(rol);
  return rutas
    .map((r) => (r.endsWith("/**") ? r.slice(0, -3) : r))
    .filter((r) => !r.includes("["))
    .filter((r) => !enlaces.some((e) => r === e || r.startsWith(`${e}/`)));
}
