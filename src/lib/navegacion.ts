import type { Rol } from "@prisma/client";
import { rutaPermitida } from "./permisos";

export type Icono =
  | "inicio" | "pedidos" | "pedir" | "viajes" | "combustible" | "flota" | "mantenimiento" | "herramientas"
  | "escanear" | "entregas" | "sobrantes" | "mapa" | "alertas" | "obras" | "proveedores" | "usuarios" | "cuenta" | "mas"
  | "agenda" | "costos" | "etiquetas" | "hoy" | "avisos" | "actividad" | "importar" | "compras" | "habilitados" | "aprobaciones";

export type Seccion = { href: string; titulo: string; icono: Icono; corto?: string };

/** Todas las secciones. El título es el del header del celular; "corto", el de la barra inferior. */
export const SECCIONES = {
  inicio: { href: "/inicio", titulo: "Inicio", icono: "inicio" },
  // Obra
  obras: { href: "/obras", titulo: "Obras", icono: "obras" },
  pedir: { href: "/pedir", titulo: "Pedir un viaje", corto: "Pedir", icono: "pedir" },
  misPedidos: { href: "/mis-pedidos", titulo: "Mis pedidos", icono: "pedidos" },
  viajesObra: { href: "/viajes-en-curso", titulo: "Viajes", icono: "viajes" },
  pedirMateriales: { href: "/pedir-materiales", titulo: "Pedir materiales", icono: "compras" },
  // Compras
  compras: { href: "/compras", titulo: "Pedidos de material", corto: "Pedidos", icono: "compras" },
  habilitados: { href: "/habilitados", titulo: "Habilitados", icono: "habilitados" },
  aprobaciones: { href: "/aprobaciones", titulo: "Aprobaciones", icono: "aprobaciones" },
  // Chofer
  hoy: { href: "/hoy", titulo: "Hoy", icono: "hoy" },
  solicitudes: { href: "/solicitudes", titulo: "Solicitudes", icono: "pedidos" },
  combustible: { href: "/combustible", titulo: "Combustible", icono: "combustible" },
  // Depósito
  escanear: { href: "/herramientas/escanear", titulo: "Escanear", icono: "escanear" },
  deposito: { href: "/herramientas?vista=deposito", titulo: "Depósito", icono: "herramientas" },
  herramientas: { href: "/herramientas", titulo: "Herramientas", icono: "herramientas" },
  entregas: { href: "/entregas", titulo: "Entregas", icono: "entregas" },
  sobrantes: { href: "/herramientas?tab=sobrantes", titulo: "Sobrantes", icono: "sobrantes" },
  etiquetas: { href: "/herramientas/etiquetas", titulo: "Etiquetas QR", icono: "etiquetas" },
  importar: { href: "/herramientas/importar", titulo: "Alta masiva", icono: "importar" },
  // Gestión
  flota: { href: "/flota", titulo: "Flota", icono: "flota" },
  agenda: { href: "/flota/agenda", titulo: "Agenda", icono: "agenda" },
  mantenimiento: { href: "/flota/mantenimiento", titulo: "Mantenimiento", icono: "mantenimiento" },
  costos: { href: "/costos", titulo: "Costos", icono: "costos" },
  alertas: { href: "/alertas", titulo: "Alertas", icono: "alertas" },
  // Dirección
  mapa: { href: "/mapa", titulo: "Mapa", icono: "mapa" },
  viajes: { href: "/viajes", titulo: "Viajes", icono: "viajes" },
  viajesAObras: { href: "/viajes-en-curso", titulo: "Viajes hacia obras", icono: "viajes" },
  historial: { href: "/mapa/historial", titulo: "Recorridos del día", icono: "mapa" },
  actividad: { href: "/actividad", titulo: "Actividad", icono: "actividad" },
  proveedores: { href: "/proveedores", titulo: "Proveedores", icono: "proveedores" },
  usuarios: { href: "/usuarios", titulo: "Usuarios", icono: "usuarios" },
  // Todos (header)
  avisos: { href: "/avisos", titulo: "Avisos", icono: "avisos" },
  misAvisos: { href: "/avisos", titulo: "Mis avisos", icono: "avisos" },
  cuenta: { href: "/cuenta", titulo: "Mi cuenta", icono: "cuenta" },
} as const satisfies Record<string, Seccion>;

type Clave = keyof typeof SECCIONES;

type GrupoClaves = { titulo: string | null; claves: Clave[] };

/**
 * Navegación de cada rol (CLAUDE.md, "Navegación"). Barra inferior: máximo 4 ítems;
 * si hay "Más", la barra tiene 3 y el cuarto es "Más". Cuenta y avisos van en el header.
 * Dirección ve todo: su "Más" va agrupado por tema.
 */
const NAV: Record<Rol, { barra: Clave[]; mas: GrupoClaves[] }> = {
  COMPRAS: { barra: ["compras", "habilitados", "proveedores"], mas: [{ titulo: null, claves: ["inicio", "misAvisos", "cuenta"] }] },
  RESPONSABLE_OBRA: { barra: ["obras", "pedir", "viajesObra", "herramientas"], mas: [] },
  CAPATAZ: { barra: ["obras", "pedir", "viajesObra", "herramientas"], mas: [] },
  CHOFER: { barra: ["hoy", "solicitudes", "combustible"], mas: [{ titulo: null, claves: ["cuenta", "misAvisos"] }] },
  DEPOSITO: { barra: ["escanear", "herramientas", "entregas"], mas: [{ titulo: null, claves: ["inicio", "sobrantes", "etiquetas", "importar"] }] },
  ADMINISTRACION: { barra: ["flota", "costos", "alertas"], mas: [{ titulo: null, claves: ["inicio", "agenda", "mantenimiento", "obras", "usuarios"] }] },
  DIRECCION: {
    barra: ["mapa", "solicitudes", "viajes"],
    mas: [
      { titulo: null, claves: ["inicio"] },
      { titulo: "Pedidos y viajes", claves: ["pedir", "misPedidos", "viajesAObras"] },
      { titulo: "Compras", claves: ["aprobaciones", "compras", "habilitados"] },
      { titulo: "Flota", claves: ["flota", "agenda", "mantenimiento", "combustible"] },
      { titulo: "Depósito", claves: ["herramientas", "deposito", "escanear", "entregas", "sobrantes", "etiquetas", "importar"] },
      { titulo: "Mapa", claves: ["historial"] },
      { titulo: "Alertas", claves: ["alertas", "avisos"] },
      { titulo: "Actividad", claves: ["actividad"] },
      { titulo: "Costos", claves: ["costos"] },
      { titulo: "Obras", claves: ["obras", "proveedores", "usuarios"] },
    ],
  },
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

/** Escritorio: las mismas entradas del rol, nada más. */
export function gruposEscritorio(rol: Rol): Grupo[] {
  return [{ titulo: null, items: visibles(rol, NAV[rol].barra) }, ...menuMas(rol).map((g) => ({ ...g, titulo: g.titulo ?? (rol === "DIRECCION" ? null : "Más") }))].filter((g) => g.items.length > 0);
}

/** Título para el header del celular según la ruta. */
export function tituloDeRuta(pathname: string): string {
  const todas = Object.values(SECCIONES) as Seccion[];
  const exacta = todas.find((s) => s.href === pathname);
  if (exacta) return exacta.titulo;
  if (pathname.startsWith("/compras/") || pathname.startsWith("/mis-pedidos/material/")) return "Pedido de material";
  if (pathname.startsWith("/proveedores/")) return "Proveedor";
  if (pathname.startsWith("/solicitudes/") || pathname.startsWith("/mis-pedidos/") || pathname.startsWith("/viaje/") || pathname.startsWith("/viajes-en-curso/")) return "Pedido";
  const prefijo = todas.filter((s) => pathname.startsWith(s.href + "/")).sort((a, b) => b.href.length - a.href.length)[0];
  return prefijo?.titulo ?? "SIGNA";
}
