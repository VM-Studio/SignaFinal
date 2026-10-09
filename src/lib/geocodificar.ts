import "server-only";

/**
 * Coordenadas de una dirección (OpenStreetMap / Nominatim, gratis; máximo una consulta por segundo).
 * Las necesitan el mapa, el ruteo y el motor de viajes.
 *
 * Primero la búsqueda estructurada (calle + localidad por separado), que acierta el número de
 * puerta; si no, la búsqueda libre. Solo acepta un resultado que esté en esa localidad: nunca
 * guarda una calle homónima de otro partido (con "Av. San Martín 2450, Florida" la búsqueda libre
 * devolvía Quilmes). Null si no la encuentra.
 */
type Resultado = { lat: string; lon: string; display_name: string };

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function buscar(params: string): Promise<Resultado[]> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ar&${params}`, {
      headers: { "User-Agent": "SIGNA-Logistica/1.0 (signa-final.vercel.app)", "Accept-Language": "es" },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    return r.ok ? ((await r.json()) as Resultado[]) : [];
  } catch {
    return [];
  }
}

export async function geocodificar(direccion: string, localidad: string): Promise<{ lat: number; lng: number; encontrada: string } | null> {
  // "Av.", "Avda.", "Avenida" confunden al buscador: se buscan sin el prefijo.
  const calle = direccion.replace(/\b(Av|Avda|Avd|Avenida)\.?\s+/gi, "").replace(/\bGral\.?\s+/gi, "General ").trim();
  const m = calle.match(/^(.*?)\s+(\d+)\s*$/);
  const ciudad = localidad.split(",")[0].trim();
  const enc = encodeURIComponent;

  const candidatos = [
    ...(await buscar(`street=${enc(m ? `${m[2]} ${m[1]}` : calle)}&city=${enc(ciudad)}`)),
    ...(await new Promise<Resultado[]>((ok) => setTimeout(() => buscar(`q=${enc(`${calle}, ${localidad}, Buenos Aires`)}`).then(ok), 1_100))),
  ];
  const lugar = sinAcentos(ciudad);
  const puntaje = (r: Resultado) => {
    const t = sinAcentos(r.display_name);
    return (m && t.startsWith(`${m[2]},`) ? 2 : 0) + (t.includes(lugar) ? 4 : 0);
  };
  // Tiene que estar en la localidad pedida; entre esos, el que tenga el número de puerta.
  const mejor = candidatos.filter((r) => sinAcentos(r.display_name).includes(lugar)).sort((a, b) => puntaje(b) - puntaje(a))[0];
  return mejor ? { lat: Number(mejor.lat), lng: Number(mejor.lon), encontrada: mejor.display_name } : null;
}
