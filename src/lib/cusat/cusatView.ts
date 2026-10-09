/**
 * Adaptador de Cusat View (cusatglobal.com). Cusat no tiene API pública: esto reproduce las
 * llamadas internas de su web, descubiertas con scripts/cusat-descubrir.ts
 * (ver docs/cusat/api-descubierta.md).
 *
 * - Un solo endpoint, POST https://cusatglobal.com/webApi, JSON como text/plain con "iq" = operación.
 * - Login (iq 3387061) con CUSAT_WEB_USER / CUSAT_WEB_PASS de .env → user_id. Las demás llamadas
 *   solo llevan ese user_id (no hay cookie ni token).
 * - Nunca lanza: cada método devuelve { ok, datos } o { ok: false, error }.
 *
 * Sin "server-only" a propósito: lo usa también scripts/cusat-probar.ts. Nunca importarlo desde
 * un Client Component (lee las credenciales del entorno).
 */
import type { FuenteCusat, PosicionExterna, Prueba, PuntoHistorial, Resultado } from "./tipos";

const URL_API = "https://cusatglobal.com/webApi";
const TIMEOUT_MS = 8_000;
/** El user_id no vence, pero se renueva cada tanto por si la cuenta cambia. */
const SESION_MS = 6 * 3_600_000;

const OP = { login: 3387061, unidades: 338100, direccion: 90100, historial: 3381030 } as const;

type Unidad = {
  unit_id: number; plate: string; ali?: string; lat: number | string; lon: number | string; speed: number | string;
  direction?: number | string; load_date: string; ev?: string; ignition_on?: string;
};
type PuntoCrudo = { lt: number | string; ln: number | string; e?: string; s?: number | string };

let sesion: { userId: number; hasta: number } | null = null;
let ingresando: Promise<number> | null = null;

class NoLogueado extends Error {}

const num = (v: unknown) => (typeof v === "number" ? v : Number(String(v ?? "").replace(",", ".")));

/**
 * Coordenadas: Cusat las manda como número (lista) o como texto con coma decimal (dirección).
 * Si vinieran al revés (latitud fuera de -90..90) se intercambian, y si vinieran como enteros
 * escalados (-34498990) se dividen por 10^6. En la captura del 9/10/2026 vinieron bien.
 */
export function normalizarCoordenadas(latCruda: unknown, lngCruda: unknown): { lat: number; lng: number } | null {
  let lat = num(latCruda);
  let lng = num(lngCruda);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 1000) lat /= 1e6;
  if (Math.abs(lng) > 1000) lng /= 1e6;
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) [lat, lng] = [lng, lat];
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

/** "09/10/2026 00:39:45" (hora argentina, UTC-3 todo el año) → Date. */
export function fechaCusat(texto: string, diaISO?: string): Date | null {
  const t = texto.trim();
  let m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4].padStart(2, "0")}:${m[5]}:${m[6] ?? "00"}-03:00`);
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4].padStart(2, "0")}:${m[5]}:${m[6] ?? "00"}-03:00`);
  // Historial: solo la hora; el día es el consultado.
  m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m && diaISO) return new Date(`${diaISO}T${m[1].padStart(2, "0")}:${m[2]}:${m[3] ?? "00"}-03:00`);
  return null;
}

/** Hora argentina → "AAAA-MM-DD". */
const diaAR = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(d);
const sumarDia = (dia: string) => diaAR(new Date(new Date(`${dia}T12:00:00-03:00`).getTime() + 86_400_000));

async function llamar<T>(iq: number, params: Record<string, unknown>): Promise<T> {
  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(URL_API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8", Referer: "https://cusatglobal.com/mobile.html" },
      body: JSON.stringify({ ...params, iq }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (r.status === 401 || r.status === 403) throw new NoLogueado(`Cusat respondió ${r.status}`);
    if (!r.ok) throw new Error(`Cusat respondió ${r.status}`);
    const texto = await r.text();
    if (!texto.trim()) return null as T;
    try {
      return JSON.parse(texto) as T;
    } catch {
      if (/login|sesi[oó]n|logue/i.test(texto)) throw new NoLogueado("Cusat pide volver a ingresar");
      throw new Error(`Cusat devolvió algo que no es JSON: ${texto.slice(0, 80)}`);
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error(`Cusat no respondió en ${TIMEOUT_MS / 1000} s`);
    throw e;
  } finally {
    clearTimeout(corte);
  }
}

async function login(): Promise<number> {
  const us = process.env.CUSAT_WEB_USER;
  const ps = process.env.CUSAT_WEB_PASS;
  if (!us || !ps) throw new Error("Faltan CUSAT_WEB_USER y CUSAT_WEB_PASS en el entorno.");
  const r = await llamar<{ user_id?: number }[] | null>(OP.login, { us, ps, tk: "" });
  const userId = Array.isArray(r) ? r[0]?.user_id : undefined;
  if (!userId) throw new Error("Cusat rechazó el usuario o la contraseña.");
  sesion = { userId, hasta: Date.now() + SESION_MS };
  return userId;
}

async function usuario(renovar = false): Promise<number> {
  if (!renovar && sesion && sesion.hasta > Date.now()) return sesion.userId;
  // Un solo login a la vez aunque lleguen varias llamadas juntas.
  ingresando ??= login().finally(() => (ingresando = null));
  return ingresando;
}

/** Hace la llamada con la sesión; si Cusat dice "no logueado" (o viene vacío), reintenta el login UNA vez. */
async function conSesion<T>(fn: (userId: number) => Promise<T>, vacio: (r: T) => boolean = () => false): Promise<T> {
  try {
    const r = await fn(await usuario());
    if (!vacio(r)) return r;
  } catch (e) {
    if (!(e instanceof NoLogueado)) throw e;
  }
  return fn(await usuario(true));
}

const aResultado = async <T>(fn: () => Promise<T>): Promise<Resultado<T>> => {
  try {
    return { ok: true, datos: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

function aPosicion(u: Unidad): PosicionExterna | null {
  const c = normalizarCoordenadas(u.lat, u.lon);
  const fechaGps = fechaCusat(u.load_date ?? "");
  if (!c || !fechaGps) return null;
  return {
    idExterno: String(u.unit_id),
    nombre: (u.ali ?? "").trim() || u.plate,
    patente: u.plate,
    latitud: c.lat,
    longitud: c.lng,
    velocidadKmh: Math.max(0, num(u.speed) || 0),
    rumbo: num(u.direction) || 0,
    // ignition_on viene vacío siempre: el contacto sale del texto del evento ("POS. EN CTO./MOV.").
    motorEncendido: u.ignition_on === "Y" || /\bEN CTO\b/i.test(u.ev ?? ""),
    fechaGps,
    direccionTexto: null,
  };
}

export class CusatView implements FuenteCusat {
  readonly modo = "cusatview" as const;

  obtenerPosicionesActuales(): Promise<Resultado<PosicionExterna[]>> {
    return aResultado(async () => {
      const r = await conSesion((uid) => llamar<{ u?: Unidad[] } | null>(OP.unidades, { uid }), (r) => !r?.u);
      if (!r?.u) throw new Error("Cusat no devolvió la lista de vehículos.");
      return r.u.map(aPosicion).filter((p): p is PosicionExterna => !!p);
    });
  }

  async obtenerDireccion(idExterno: string): Promise<string | null> {
    try {
      const r = await conSesion((iu) => llamar<{ geo?: string }[] | null>(OP.direccion, { iu, un: Number(idExterno) }));
      return r?.[0]?.geo?.trim() || null;
    } catch {
      return null;
    }
  }

  /** Cusat da el recorrido de a un día: se pide día por día y se recorta a [desde, hasta]. */
  obtenerHistorial(idExterno: string, desde: Date, hasta: Date, patente?: string): Promise<Resultado<PuntoHistorial[]>> {
    return aResultado(async () => {
      const out: PuntoHistorial[] = [];
      for (let dia = diaAR(desde); dia <= diaAR(hasta); dia = sumarDia(dia)) {
        const pedir = (idunit: string | number) => conSesion((iduser) => llamar<PuntoCrudo[] | null>(OP.historial, { iduser, idunit, report_date: dia }));
        // La web manda el id de la unidad; si viniera vacío se prueba con la patente (a confirmar con scripts/cusat-probar.ts).
        let puntos = await pedir(Number(idExterno));
        if ((!Array.isArray(puntos) || !puntos.length) && patente) puntos = await pedir(patente);
        for (const p of Array.isArray(puntos) ? puntos : []) {
          const c = normalizarCoordenadas(p.lt, p.ln);
          const fecha = fechaCusat(String(p.e ?? ""), dia);
          if (c && fecha && fecha >= desde && fecha <= hasta) out.push({ latitud: c.lat, longitud: c.lng, velocidadKmh: Math.max(0, num(p.s) || 0), fecha });
        }
      }
      return out.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    });
  }

  async probar(): Promise<Prueba> {
    const pasos: Prueba["pasos"] = [];
    const medir = async (paso: string, fn: () => Promise<string>) => {
      const t = Date.now();
      try {
        pasos.push({ paso, ok: true, detalle: await fn(), ms: Date.now() - t });
        return true;
      } catch (e) {
        pasos.push({ paso, ok: false, detalle: e instanceof Error ? e.message : String(e), ms: Date.now() - t });
        return false;
      }
    };
    sesion = null;
    if (!(await medir("Ingreso", async () => `Ingresó (usuario ${String(await usuario()).replace(/\d(?=\d{2})/g, "•")})`))) return { modo: this.modo, pasos };
    let primera: PosicionExterna | undefined;
    await medir("Posiciones", async () => {
      const r = await this.obtenerPosicionesActuales();
      if (!r.ok) throw new Error(r.error);
      primera = r.datos[0];
      return `${r.datos.length} vehículos. Primero: ${primera ? `${primera.nombre} (${primera.patente}) ${primera.latitud.toFixed(5)}, ${primera.longitud.toFixed(5)} · ${primera.velocidadKmh} km/h · ${primera.fechaGps.toISOString()}` : "ninguno"}`;
    });
    if (primera) {
      const p = primera;
      await medir("Dirección", async () => (await this.obtenerDireccion(p.idExterno)) ?? "Sin dirección");
      await medir("Historial de hoy", async () => {
        const r = await this.obtenerHistorial(p.idExterno, new Date(`${diaAR(new Date())}T00:00:00-03:00`), new Date(), p.patente);
        if (!r.ok) throw new Error(r.error);
        return `${r.datos.length} puntos${r.datos[0] ? ` desde ${r.datos[0].fecha.toISOString()}` : ""}`;
      });
    }
    return { modo: this.modo, pasos };
  }
}
