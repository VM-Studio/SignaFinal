import "server-only";
import { z } from "zod";
import { ErrorNegocio } from "@/lib/resultado";
import { geocodificar } from "./geocodificar";

/**
 * Lo que manda SelectorDireccion: la dirección escrita, la localidad y el pin confirmado en el mapa.
 * Toda alta de un lugar (obra, sede, sucursal, depósito) usa este esquema.
 */
export const lugarEsquema = z.object({
  direccion: z.string().trim().min(4, "Poné la dirección (calle y número).").max(160),
  localidad: z.string().trim().min(2, "Poné la localidad.").max(80),
  lat: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().min(-56).max(-21).optional()),
  lng: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().min(-74).max(-53).optional()),
});

/** Coordenadas del lugar: las del pin (confirmadas en el mapa) o, si no vinieron, buscadas por la dirección. */
export async function ubicarLugar(d: { direccion: string; localidad: string; lat?: number; lng?: number }) {
  if (d.lat != null && d.lng != null) return { lat: d.lat, lng: d.lng };
  const p = await geocodificar(d.direccion, d.localidad);
  if (!p) throw new ErrorNegocio("No encontramos esa dirección. Elegí una sugerencia o poné el pin en el mapa.");
  return { lat: p.lat, lng: p.lng };
}
