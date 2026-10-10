import type { PrismaClient } from "@prisma/client";
import { db as dbApp } from "@/lib/db";

/**
 * Buscador de direcciones con Nominatim (OpenStreetMap). Sin "server-only" para poder usarlo desde el
 * seed y los scripts; en la app lo usan la ruta /api/geo/buscar y las altas de lugares.
 */
const sinAcentos = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
type Resultado = { lat: string; lon: string; display_name: string };

// ═══════════════════════════ Buscador de direcciones ═══════════════════════════

/** exacta: el resultado tiene el número de puerta (si no, es la calle o la zona). */
export type Candidato = { direccion: string; lat: number; lng: number; localidad: string | null; exacta?: boolean };

const USER_AGENT = "SignaLogistica/1.0 (contacto@signa)";

/** "Av. San Martín 2450, Florida" → "av. san martin 2450, florida": la clave de la caché. */
export const normalizar = (t: string) => sinAcentos(t).replace(/\s+/g, " ").trim();

// Cola simple: Nominatim pide como máximo una consulta por segundo (por instancia del servidor).
let cola: Promise<unknown> = Promise.resolve();
let ultima = 0;
function enCola<T>(fn: () => Promise<T>): Promise<T> {
  const r = cola.then(async () => {
    const espera = ultima + 1_100 - Date.now();
    if (espera > 0) await new Promise((ok) => setTimeout(ok, espera));
    ultima = Date.now();
    return fn();
  });
  cola = r.catch(() => {});
  return r;
}

type ResultadoNominatim = Resultado & { address?: { road?: string; house_number?: string; suburb?: string; city?: string; town?: string; village?: string; city_district?: string; state?: string } };

/** "Darwin 1299, Villa Crespo, CABA": corto y como lo dice la gente, no el display_name larguísimo de OSM. */
function formatear(r: ResultadoNominatim): Candidato {
  const a = r.address ?? {};
  const localidad = a.suburb ?? a.city_district ?? a.town ?? a.village ?? a.city ?? null;
  const calle = a.road ? `${a.road}${a.house_number ? ` ${a.house_number}` : ""}` : null;
  const partes = calle ? [calle, localidad, a.state === "Ciudad Autónoma de Buenos Aires" ? "CABA" : (a.city && a.city !== localidad ? a.city : null)] : r.display_name.split(",").slice(0, 3);
  return { direccion: partes.filter(Boolean).map((x) => String(x).trim()).join(", "), lat: Number(r.lat), lng: Number(r.lon), localidad, exacta: !!a.house_number };
}

/**
 * Busca una dirección escrita como sea ("darwin 1299 villa crespo") y devuelve hasta 5 candidatos con
 * dirección formateada y coordenadas. Usa la caché (GeocodeCache) y, si no está, Nominatim (en cola,
 * 1 por segundo). Si Nominatim no responde devuelve [] y la pantalla deja poner el pin a mano.
 */
export async function buscarDireccion(texto: string, db: PrismaClient = dbApp): Promise<Candidato[]> {
  const clave = normalizar(texto);
  if (clave.length < 4) return [];
  const cache = await db.geocodeCache.findUnique({ where: { texto: clave } });
  if (cache) return (cache.candidatos as Candidato[]).length ? (cache.candidatos as Candidato[]) : [{ direccion: cache.direccionFormateada, lat: cache.lat, lng: cache.lng, localidad: null }];
  const params = new URLSearchParams({ q: /buenos aires|caba|argentina/i.test(texto) ? texto : `${texto}, Buenos Aires`, format: "json", limit: "5", countrycodes: "ar", addressdetails: "1" });
  const crudos = await enCola(async () => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "es" },
        signal: AbortSignal.timeout(6_000),
        cache: "no-store",
      });
      return r.ok ? ((await r.json()) as ResultadoNominatim[]) : null;
    } catch {
      return null;
    }
  });
  if (!crudos) return []; // no respondió: no se guarda en caché, se puede volver a probar
  const vistos = new Set<string>();
  const candidatos = crudos.map(formatear).filter((c) => (vistos.has(c.direccion) ? false : (vistos.add(c.direccion), true)));
  if (candidatos.length) {
    await db.geocodeCache.upsert({
      where: { texto: clave },
      create: { texto: clave, lat: candidatos[0].lat, lng: candidatos[0].lng, direccionFormateada: candidatos[0].direccion, candidatos },
      update: { lat: candidatos[0].lat, lng: candidatos[0].lng, direccionFormateada: candidatos[0].direccion, candidatos, fecha: new Date() },
    });
  }
  return candidatos;
}
