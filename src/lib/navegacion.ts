import type { Rol } from "@prisma/client";
import { rutaPermitida } from "./permisos";

export type Icono =
  | "inicio" | "pedidos" | "pedir" | "viajes" | "combustible" | "flota" | "mantenimiento" | "herramientas"
  | "escanear" | "entregas" | "sobrantes" | "mapa" | "alertas" | "obras" | "proveedores" | "usuarios" | "cuenta" | "mas"
  | "agenda" | "costos" | "etiquetas" | "hoy" | "avisos" | "actividad" | "importar";

export type Seccion = { href: string; titulo: string; icono: Icono; corto?: string };

/** Todas las secciones. El título es el del header del celular; "corto", el de la barra inferior. */
export const SECCIONES = {
  inicio: { href: "/inicio", titulo: "Inicio", icono: "inicio" },
  // Obra
  obras: { href: "/obras", titulo: "Obras", icono: "obras" },
  pedir: { href: "/pedir", titulo: "Pedir un viaje", corto: "Pedir", icono: "pedir" },
  misPedidos: { href: "/mis-pedidos", titulo: "Mis pedidos", icono: "pedidos" },
  viajesObra: { href: "/viajes-en-curso", titulo: "Viajes", icono: "viajes" },
  // Chofer
  hoy: { href: "/hoy", titulo: "Hoy", icono: "hoy" },
  solicitudes: { href: "/solicitudes", titulo: "Solicitudes", icono: "pedidos" },
  combustible: { href: "/combustible", titulo: "Combustible", icono: "combustible" },
  // Depósito
  escanear: { href: "/herramientas/escanear", titulo: "Escanear", icono: "escanear" },
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
  actividad: { href: "/actividad", titulo: "Actividad", icono: "actividad" },
  proveedores: { href: "/proveedores", titulo: "Proveedores", icono: "proveedores" },
  usuarios: { href: "/usuarios", titulo: "Usuarios", icono: "usuarios" },
  // Todos (header)
  avisos: { href: "/avisos", titulo: "Avisos", icono: "avisos" },
  misAvisos: { href: "/avisos", titulo: "Mis avisos", icono: "avisos" },
  cuenta: { href: "/cuenta", titulo: "Mi cuenta", icono: "cuenta" },
} as const satisfies Record<string, Seccion>;

type Clave = keyof typeof SECCIONES;

/**
 * Navegación de cada rol (CLAUDE.md, "Navegación"). Barra inferior: máximo 4 ítems;
 * si hay "Más", la barra tiene 3 y el cuarto es "Más". Cuenta y avisos van en el header.
 */
const NAV: Record<Rol, { barra: Clave[]; mas: Clave[] }> = {
  RESPONSABLE_OBRA: { barra: ["obras", "pedir", "viajesObra", "herramientas"], mas: [] },
  CAPATAZ: { barra: ["obras", "pedir", "viajesObra", "herramientas"], mas: [] },
  CHOFER: { barra: ["hoy", "solicitudes", "combustible"], mas: ["cuenta", "misAvisos"] },
  DEPOSITO: { barra: ["escanear", "herramientas", "entregas"], mas: ["inicio", "sobrantes", "etiquetas", "importar"] },
  ADMINISTRACION: { barra: ["flota", "costos", "alertas"], mas: ["inicio", "agenda", "mantenimiento", "obras"] },
  DIRECCION: {
    barra: ["mapa", "solicitudes", "viajes"],
    mas: [
      "inicio", "actividad", "alertas", "pedir", "misPedidos", "flota", "agenda", "mantenimiento", "combustible", "costos",
      "herramientas", "entregas", "sobrantes", "obras", "proveedores", "usuarios",
    ],
  },
};

// Nunca se muestra un enlace a una ruta que el rol no tiene (la matriz manda).
const visibles = (rol: Rol, claves: Clave[]) =>
  claves.map((k) => SECCIONES[k] as Seccion).filter((s) => rutaPermitida(rol, s.href.split("?")[0]));

export function barraInferior(rol: Rol): Seccion[] {
  return visibles(rol, NAV[rol].barra).map((s) => ({ ...s, titulo: s.corto ?? s.titulo }));
}

export function menuMas(rol: Rol): Seccion[] {
  return visibles(rol, NAV[rol].mas);
}

export type Grupo = { titulo: string | null; items: Seccion[] };

/** Escritorio: las mismas entradas del rol, nada más. */
export function gruposEscritorio(rol: Rol): Grupo[] {
  return [
    { titulo: null, items: visibles(rol, NAV[rol].barra) },
    { titulo: "Más", items: menuMas(rol) },
  ].filter((g) => g.items.length > 0);
}

/** Título para el header del celular según la ruta. */
export function tituloDeRuta(pathname: string): string {
  const todas = Object.values(SECCIONES) as Seccion[];
  const exacta = todas.find((s) => s.href === pathname);
  if (exacta) return exacta.titulo;
  if (pathname.startsWith("/solicitudes/") || pathname.startsWith("/mis-pedidos/") || pathname.startsWith("/viaje/") || pathname.startsWith("/viajes-en-curso/")) return "Pedido";
  const prefijo = todas.filter((s) => pathname.startsWith(s.href + "/")).sort((a, b) => b.href.length - a.href.length)[0];
  return prefijo?.titulo ?? "SIGNA";
}
