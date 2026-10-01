import type { Rol } from "@prisma/client";
import { puede, type Permiso } from "./permisos";

export type Icono =
  | "inicio" | "pedidos" | "pedir" | "viajes" | "combustible" | "flota" | "mantenimiento" | "herramientas"
  | "escanear" | "entregas" | "sobrantes" | "mapa" | "alertas" | "obras" | "proveedores" | "usuarios" | "cuenta" | "mas";

export type Seccion = { href: string; titulo: string; icono: Icono; permiso?: Permiso };

/** Todas las secciones de la app. El título es el que va en el header del celular. */
export const SECCIONES = {
  inicio: { href: "/inicio", titulo: "Inicio", icono: "inicio" },
  cola: { href: "/pedidos", titulo: "Cola de pedidos", icono: "pedidos", permiso: "pedidos.ver" },
  pedir: { href: "/pedidos/nuevo", titulo: "Pedir un viaje", icono: "pedir", permiso: "pedidos.crear" },
  misViajes: { href: "/viajes", titulo: "Mis viajes", icono: "viajes", permiso: "viajes.verPropios" },
  viajes: { href: "/viajes", titulo: "Viajes", icono: "viajes", permiso: "viajes.verTodos" },
  flota: { href: "/flota", titulo: "Flota", icono: "flota", permiso: "flota.ver" },
  combustible: { href: "/combustible", titulo: "Combustible", icono: "combustible", permiso: "combustible.ver" },
  mantenimiento: { href: "/mantenimiento", titulo: "Mantenimiento", icono: "mantenimiento", permiso: "mantenimiento.ver" },
  herramientas: { href: "/herramientas", titulo: "Herramientas", icono: "herramientas", permiso: "herramientas.ver" },
  escanear: { href: "/escanear", titulo: "Escanear", icono: "escanear", permiso: "herramientas.mover" },
  entregas: { href: "/entregas", titulo: "Entregas", icono: "entregas", permiso: "herramientas.mover" },
  sobrantes: { href: "/sobrantes", titulo: "Sobrantes", icono: "sobrantes", permiso: "sobrantes.ver" },
  mapa: { href: "/mapa", titulo: "Mapa", icono: "mapa", permiso: "mapa.ver" },
  alertas: { href: "/alertas", titulo: "Alertas", icono: "alertas", permiso: "alertas.ver" },
  obras: { href: "/obras", titulo: "Obras", icono: "obras", permiso: "obras.ver" },
  proveedores: { href: "/proveedores", titulo: "Proveedores", icono: "proveedores", permiso: "proveedores.ver" },
  usuarios: { href: "/usuarios", titulo: "Usuarios", icono: "usuarios", permiso: "usuarios.gestionar" },
  cuenta: { href: "/cuenta", titulo: "Mi cuenta", icono: "cuenta" },
} as const satisfies Record<string, Seccion>;

type Clave = keyof typeof SECCIONES;

/** Barra inferior del celular: 3 secciones + "Más". Nunca más de 4. */
const BARRA: Record<Rol, [Clave, Clave, Clave]> = {
  CHOFER: ["cola", "misViajes", "combustible"],
  RESPONSABLE_OBRA: ["pedir", "cola", "herramientas"],
  CAPATAZ: ["pedir", "cola", "herramientas"],
  DEPOSITO: ["escanear", "herramientas", "entregas"],
  DIRECCION: ["mapa", "cola", "flota"],
  ADMINISTRACION: ["mapa", "cola", "flota"],
};

/** Etiquetas cortas para la barra inferior. */
const ETIQUETA_CORTA: Partial<Record<Clave, string>> = {
  cola: "Cola",
  pedir: "Pedir",
  misViajes: "Mis viajes",
};

export function barraInferior(rol: Rol) {
  return BARRA[rol].map((k) => ({ ...SECCIONES[k], titulo: rol === "CHOFER" && k === "cola" ? "Pedidos" : ETIQUETA_CORTA[k] ?? SECCIONES[k].titulo }));
}

/**
 * "Más": como máximo 5 entradas. Herramientas o Flota (la que no esté en la barra),
 * Alertas, Obras, Mi cuenta y Cerrar sesión (este último lo agrega el componente).
 */
export function menuMas(rol: Rol): Seccion[] {
  const enBarra = BARRA[rol] as readonly Clave[];
  const primera: Clave = enBarra.includes("herramientas") ? "flota" : enBarra.includes("flota") ? "herramientas" : "flota";
  return [SECCIONES[primera], SECCIONES.alertas, SECCIONES.obras, SECCIONES.cuenta].filter((s) => !("permiso" in s) || puede(rol, s.permiso));
}

export type Grupo = { titulo: string | null; items: Seccion[] };

/** Escritorio: navegación completa agrupada, filtrada por permisos. */
export function gruposEscritorio(rol: Rol): Grupo[] {
  const grupos: { titulo: string | null; claves: Clave[] }[] = [
    { titulo: null, claves: ["inicio"] },
    { titulo: "Pedidos y viajes", claves: ["cola", "pedir", rol === "CHOFER" ? "misViajes" : "viajes"] },
    { titulo: "Flota", claves: ["flota", "combustible", "mantenimiento"] },
    { titulo: "Depósito", claves: ["herramientas", "escanear", "entregas", "sobrantes"] },
    { titulo: "Mapa", claves: ["mapa"] },
    { titulo: "Alertas", claves: ["alertas"] },
    { titulo: "Configuración", claves: ["obras", "proveedores", "usuarios", "cuenta"] },
  ];
  return grupos
    .map((g) => ({
      titulo: g.titulo,
      items: g.claves.map((k) => SECCIONES[k] as Seccion).filter((s) => !s.permiso || puede(rol, s.permiso)),
    }))
    .filter((g) => g.items.length > 0);
}

/** Título para el header del celular según la ruta. */
export function tituloDeRuta(pathname: string, rol: Rol): string {
  if (pathname === "/viajes") return rol === "CHOFER" ? "Mis viajes" : "Viajes";
  const todas = Object.values(SECCIONES) as Seccion[];
  const exacta = todas.find((s) => s.href === pathname);
  if (exacta) return exacta.titulo;
  const prefijo = todas.filter((s) => pathname.startsWith(s.href + "/")).sort((a, b) => b.href.length - a.href.length)[0];
  return prefijo?.titulo ?? "SIGNA";
}
