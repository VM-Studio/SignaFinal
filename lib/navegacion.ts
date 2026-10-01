import type { Rol } from "@prisma/client";

export type NombreIcono =
  | "inicio" | "camion" | "lista" | "mapa" | "herramienta" | "escanear" | "alerta"
  | "costos" | "combustible" | "obra" | "personas" | "viajes" | "pedir" | "bandeja";

export type ItemNav = { href: string; etiqueta: string; icono: NombreIcono };

/**
 * Navegación por rol. Las primeras 4 van en la barra inferior del celular
 * (nunca más de 4). En escritorio se muestran todas en la barra lateral.
 */
export const NAVEGACION: Record<Rol, ItemNav[]> = {
  CHOFER: [
    { href: "/inicio", etiqueta: "Para tomar", icono: "bandeja" },
    { href: "/viajes", etiqueta: "Mis viajes", icono: "viajes" },
    { href: "/combustible", etiqueta: "Combustible", icono: "combustible" },
    { href: "/alertas", etiqueta: "Avisos", icono: "alerta" },
    { href: "/flota", etiqueta: "Flota", icono: "camion" },
  ],
  RESPONSABLE_OBRA: [
    { href: "/inicio", etiqueta: "Pedir", icono: "pedir" },
    { href: "/pedidos", etiqueta: "Cola", icono: "lista" },
    { href: "/herramientas", etiqueta: "Herramientas", icono: "herramienta" },
    { href: "/mapa", etiqueta: "Mapa", icono: "mapa" },
    { href: "/obras", etiqueta: "Mis obras", icono: "obra" },
    { href: "/alertas", etiqueta: "Avisos", icono: "alerta" },
  ],
  CAPATAZ: [
    { href: "/inicio", etiqueta: "Pedir", icono: "pedir" },
    { href: "/pedidos", etiqueta: "Cola", icono: "lista" },
    { href: "/herramientas", etiqueta: "Herramientas", icono: "herramienta" },
    { href: "/mapa", etiqueta: "Mapa", icono: "mapa" },
    { href: "/obras", etiqueta: "Obras", icono: "obra" },
    { href: "/flota", etiqueta: "Flota", icono: "camion" },
    { href: "/alertas", etiqueta: "Alertas", icono: "alerta" },
  ],
  DEPOSITO: [
    { href: "/inicio", etiqueta: "Escanear", icono: "escanear" },
    { href: "/deposito", etiqueta: "Inventario", icono: "herramienta" },
    { href: "/deposito/solicitudes", etiqueta: "Solicitudes", icono: "bandeja" },
    { href: "/flota", etiqueta: "Flota", icono: "camion" },
    { href: "/alertas", etiqueta: "Alertas", icono: "alerta" },
    { href: "/pedidos", etiqueta: "Cola de viajes", icono: "lista" },
  ],
  DIRECCION: [
    { href: "/inicio", etiqueta: "Mapa", icono: "mapa" },
    { href: "/pedidos", etiqueta: "Pedidos", icono: "lista" },
    { href: "/costos", etiqueta: "Costos", icono: "costos" },
    { href: "/alertas", etiqueta: "Alertas", icono: "alerta" },
    { href: "/pedidos/nuevo", etiqueta: "Pedir un viaje", icono: "pedir" },
    { href: "/flota", etiqueta: "Flota", icono: "camion" },
    { href: "/deposito", etiqueta: "Depósito", icono: "herramienta" },
    { href: "/obras", etiqueta: "Obras", icono: "obra" },
    { href: "/personas", etiqueta: "Personas", icono: "personas" },
  ],
  ADMINISTRACION: [
    { href: "/inicio", etiqueta: "Resumen", icono: "inicio" },
    { href: "/flota", etiqueta: "Flota", icono: "camion" },
    { href: "/costos", etiqueta: "Costos", icono: "costos" },
    { href: "/alertas", etiqueta: "Alertas", icono: "alerta" },
    { href: "/pedidos", etiqueta: "Pedidos", icono: "lista" },
    { href: "/mapa", etiqueta: "Mapa", icono: "mapa" },
    { href: "/deposito", etiqueta: "Depósito", icono: "herramienta" },
    { href: "/obras", etiqueta: "Obras", icono: "obra" },
    { href: "/personas", etiqueta: "Personas", icono: "personas" },
  ],
};

export const MAX_BARRA_INFERIOR = 4;
