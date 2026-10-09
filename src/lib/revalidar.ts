import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Revalidación puntual: cada módulo refresca sus listas y sus detalles, no toda la app.
 * Los detalles con [id] se revalidan como patrón (todas las páginas de esa ruta).
 * La campana no depende de esto: se actualiza sola cada 30 s.
 */
const MODULOS = {
  pedidos: {
    listas: ["/inicio", "/solicitudes", "/mis-pedidos", "/viajes-en-curso", "/hoy", "/viajes", "/obras", "/avisos", "/entregas"],
    detalles: ["/solicitudes/[id]", "/mis-pedidos/[id]", "/viajes-en-curso/[id]", "/viaje/[id]", "/obras/[id]"],
  },
  herramientas: {
    listas: ["/inicio", "/herramientas", "/entregas", "/obras", "/avisos"],
    detalles: ["/herramientas/[id]", "/obras/[id]", "/h/[codigo]"],
  },
  flota: {
    listas: ["/inicio", "/flota", "/flota/agenda", "/flota/mantenimiento", "/combustible", "/costos", "/alertas"],
    detalles: ["/flota/[id]"],
  },
  materiales: {
    listas: ["/inicio", "/compras", "/habilitados", "/aprobaciones", "/mis-pedidos", "/pedir", "/avisos", "/alertas"],
    detalles: ["/compras/[id]", "/mis-pedidos/material/[id]"],
  },
  avisos: { listas: ["/avisos", "/alertas", "/inicio"], detalles: [] as string[] },
  usuarios: { listas: ["/usuarios", "/obras", "/alertas", "/actividad"], detalles: ["/obras/[id]", "/actividad/[id]"] },
} as const;

export type ModuloRevalidar = keyof typeof MODULOS;

export function revalidar(...modulos: ModuloRevalidar[]) {
  const listas = new Set<string>();
  const detalles = new Set<string>();
  for (const m of modulos) {
    MODULOS[m].listas.forEach((r) => listas.add(r));
    MODULOS[m].detalles.forEach((r) => detalles.add(r));
  }
  listas.forEach((r) => revalidatePath(r));
  detalles.forEach((r) => revalidatePath(r, "page"));
}
