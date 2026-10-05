import { distancia, type Punto } from "@/lib/geo";

/**
 * Ruteo: cuánto falta y por dónde. OSRM público (gratis, sin clave) y, si falla o tarda más
 * de 4 s, un respaldo que nunca falla: línea recta × 1,3 a 28 km/h (promedio de CABA/GBA).
 * Nunca bloquea una acción del chofer.
 */
export type Ruta = {
  distanciaM: number;
  duracionS: number;
  /** [lat, lng] del recorrido (simplificado). */
  geometria: [number, number][];
  fuente: "osrm" | "estimada";
};

const OSRM = "https://router.project-osrm.org/route/v1/driving";
const TIMEOUT_MS = 4_000;
const CACHE_MS = 10 * 60_000;
const FACTOR_CALLES = 1.3;
const VELOCIDAD_MS = 28 / 3.6;

// Caché en memoria por par de coordenadas redondeadas (~100 m): 10 minutos.
const cache = new Map<string, { ruta: Ruta; vence: number }>();
const clave = (a: Punto, b: Punto) => [a.lat, a.lng, b.lat, b.lng].map((n) => n.toFixed(3)).join(",");

export function rutaEstimada(desde: Punto, hasta: Punto): Ruta {
  const m = Math.round(distancia(desde, hasta) * FACTOR_CALLES);
  return { distanciaM: m, duracionS: Math.round(m / VELOCIDAD_MS), geometria: [[desde.lat, desde.lng], [hasta.lat, hasta.lng]], fuente: "estimada" };
}

async function rutaOsrm(desde: Punto, hasta: Punto): Promise<Ruta> {
  const url = `${OSRM}/${desde.lng},${desde.lat};${hasta.lng},${hasta.lat}?overview=simplified&geometries=geojson`;
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "signa-logistica" } });
  if (!r.ok) throw new Error(`OSRM ${r.status}`);
  const j = (await r.json()) as { code: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] };
  const ruta = j.routes?.[0];
  if (j.code !== "Ok" || !ruta) throw new Error(`OSRM ${j.code}`);
  return {
    distanciaM: Math.round(ruta.distance),
    duracionS: Math.round(ruta.duration),
    geometria: ruta.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    fuente: "osrm",
  };
}

export async function calcularRuta(desde: Punto, hasta: Punto): Promise<Ruta> {
  const k = clave(desde, hasta);
  const guardada = cache.get(k);
  if (guardada && guardada.vence > Date.now()) return guardada.ruta;
  let ruta: Ruta;
  try {
    ruta = await rutaOsrm(desde, hasta);
  } catch {
    ruta = rutaEstimada(desde, hasta);
  }
  cache.set(k, { ruta, vence: Date.now() + CACHE_MS });
  if (cache.size > 500) for (const [c, v] of cache) if (v.vence < Date.now()) cache.delete(c);
  return ruta;
}

/** "12 min", "1 h 05 min". */
export function minutos(s: number) {
  const m = Math.max(1, Math.round(s / 60));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}

/** "3,4 km", "800 m". */
export function metros(m: number) {
  return m < 1000 ? `${Math.round(m / 50) * 50} m` : `${(m / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} km`;
}
