import { distancia, type Punto } from "@/lib/geo";
import { decodificarPolyline } from "./formato";

export { metros, minutos } from "./formato";

/**
 * Ruteo: distancia, por dónde y, SOLO si hay un proveedor que sabe el tránsito, cuánto tarda.
 *
 * - Con GOOGLE_MAPS_API_KEY: Google Routes API (computeRoutes, TRAFFIC_AWARE_OPTIMAL, salida ahora),
 *   caché de 60 s por par de puntos. Es la única fuente que da minutos y hora de llegada ("con tránsito").
 * - Sin clave (o si Google falla): OSRM público para la distancia y el recorrido; si OSRM falla o
 *   tarda más de 4 s, línea recta × 1,3. Sin tránsito no hay minutos: la app muestra solo "7,2 km".
 *
 * duracionS siempre viene (sirve para ordenar paradas), pero solo se le MUESTRA a alguien si conTransito.
 * Nunca bloquea una acción del chofer. Detalle y costos en docs/rutas.md.
 */
export type Ruta = {
  distanciaM: number;
  /** Interna (para ordenar). No se muestra salvo conTransito. */
  duracionS: number;
  /** [lat, lng] del recorrido (simplificado). */
  geometria: [number, number][];
  fuente: "google" | "osrm" | "estimada";
  /** Tiempo con tránsito real (Google): recién ahí se muestran minutos y hora de llegada. */
  conTransito: boolean;
};

const OSRM = "https://router.project-osrm.org/route/v1/driving";
const GOOGLE = "https://routes.googleapis.com/directions/v2:computeRoutes";
const TIMEOUT_MS = 4_000;
const CACHE_OSRM_MS = 10 * 60_000;
const CACHE_GOOGLE_MS = 60_000;
const FACTOR_CALLES = 1.3;
const VELOCIDAD_MS = 28 / 3.6;

// Caché en memoria por par de coordenadas redondeadas (~100 m).
const cache = new Map<string, { ruta: Ruta; vence: number }>();
const clave = (a: Punto, b: Punto, google: boolean) => `${google ? "g" : "o"}:${[a.lat, a.lng, b.lat, b.lng].map((n) => n.toFixed(3)).join(",")}`;

/** ¿Hay proveedor con tránsito? Sin él, la app no muestra minutos ni hora de llegada. */
export const hayTransito = () => !!process.env.GOOGLE_MAPS_API_KEY;

export function rutaEstimada(desde: Punto, hasta: Punto): Ruta {
  const m = Math.round(distancia(desde, hasta) * FACTOR_CALLES);
  return { distanciaM: m, duracionS: Math.round(m / VELOCIDAD_MS), geometria: [[desde.lat, desde.lng], [hasta.lat, hasta.lng]], fuente: "estimada", conTransito: false };
}

async function rutaOsrm(desde: Punto, hasta: Punto): Promise<Ruta> {
  const url = `${OSRM}/${desde.lng},${desde.lat};${hasta.lng},${hasta.lat}?overview=simplified&geometries=geojson`;
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "signa-logistica" } });
  if (!r.ok) throw new Error(`OSRM ${r.status}`);
  const j = (await r.json()) as { code: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] };
  const ruta = j.routes?.[0];
  if (j.code !== "Ok" || !ruta) throw new Error(`OSRM ${j.code}`);
  return { distanciaM: Math.round(ruta.distance), duracionS: Math.round(ruta.duration), geometria: ruta.geometry.coordinates.map(([lng, lat]) => [lat, lng]), fuente: "osrm", conTransito: false };
}

/** Google Routes API con tránsito. La clave va en el header, nunca en la URL. */
export async function rutaGoogle(desde: Punto, hasta: Punto, clave = process.env.GOOGLE_MAPS_API_KEY): Promise<Ruta> {
  if (!clave) throw new Error("Sin GOOGLE_MAPS_API_KEY");
  const punto = (p: Punto) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
  const r = await fetch(GOOGLE, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": clave,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      // Si la clave está restringida por sitio web (docs/rutas.md), Google mira este encabezado.
      ...(process.env.GOOGLE_MAPS_REFERER ? { Referer: process.env.GOOGLE_MAPS_REFERER } : {}),
    },
    body: JSON.stringify({
      origin: punto(desde), destination: punto(hasta), travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE_OPTIMAL",
      // "Ahora" (unos segundos adelante: Google rechaza una salida en el pasado).
      departureTime: new Date(Date.now() + 15_000).toISOString(), languageCode: "es-419", units: "METRIC",
    }),
  });
  if (!r.ok) throw new Error(`Google Routes ${r.status}`);
  const j = (await r.json()) as { routes?: { duration?: string; distanceMeters?: number; polyline?: { encodedPolyline?: string } }[] };
  const ruta = j.routes?.[0];
  const seg = Number(ruta?.duration?.replace(/s$/, ""));
  if (!ruta || !Number.isFinite(seg) || ruta.distanceMeters == null) throw new Error("Google Routes sin ruta");
  const geometria = ruta.polyline?.encodedPolyline ? decodificarPolyline(ruta.polyline.encodedPolyline) : [[desde.lat, desde.lng], [hasta.lat, hasta.lng]] as [number, number][];
  return { distanciaM: Math.round(ruta.distanceMeters), duracionS: Math.round(seg), geometria, fuente: "google", conTransito: true };
}

/**
 * transito: false para lo que solo necesita distancia y recorrido (pantallas que se refrescan, mapas):
 * así Google se usa únicamente para la hora de llegada (motor y job de horas estimadas) y el costo queda bajo.
 */
export async function calcularRuta(desde: Punto, hasta: Punto, o: { transito?: boolean } = {}): Promise<Ruta> {
  const google = o.transito !== false && hayTransito();
  const k = clave(desde, hasta, google);
  const guardada = cache.get(k);
  if (guardada && guardada.vence > Date.now()) return guardada.ruta;
  let ruta: Ruta | null = null;
  if (google) {
    try {
      ruta = await rutaGoogle(desde, hasta);
    } catch (e) {
      // Si Google falla, solo distancia: nada se rompe.
      console.warn("Google Routes falló, sigo sin tránsito:", (e as Error).message);
    }
  }
  if (!ruta) {
    try {
      ruta = await rutaOsrm(desde, hasta);
    } catch {
      ruta = rutaEstimada(desde, hasta);
    }
  }
  cache.set(k, { ruta, vence: Date.now() + (ruta.conTransito ? CACHE_GOOGLE_MS : CACHE_OSRM_MS) });
  if (cache.size > 500) for (const [c, v] of cache) if (v.vence < Date.now()) cache.delete(c);
  return ruta;
}

/** Hora de llegada SOLO si la ruta sabe el tránsito; si no, null (la app no inventa horas). */
export const llegadaCon = (ruta: Pick<Ruta, "duracionS" | "conTransito"> | null | undefined, desde: Date, extraS = 0) =>
  ruta?.conTransito ? new Date(desde.getTime() + (ruta.duracionS + extraS) * 1000) : null;
