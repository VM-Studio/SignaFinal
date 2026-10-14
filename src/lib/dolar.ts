import { db } from "@/lib/db";

/**
 * COTIZACIÓN DEL DÓLAR (blue y oficial) de dolarapi.com (gratis, sin clave), la misma referencia que
 * Alejandra tenía arriba de su planilla ("Dólar · Fuente: DólarHoy.com · Blue / Oficial · Compra /
 * Venta"). El último valor queda en EstadoSistema ("dolar") con caché de 15 minutos del lado del
 * servidor: la ruta /api/dolar y el header leen de ahí; el job de cada minuto lo refresca cuando pasaron
 * 15 minutos. Si dolarapi no responde, se sigue mostrando el último conocido ("actualizado hace X")
 * y se reintenta en la próxima vuelta, sin errores a la vista.
 */
export const FUENTE_DOLAR = { nombre: "dolarapi.com", url: "https://dolarapi.com" } as const;
const URLS = { blue: "https://dolarapi.com/v1/dolares/blue", oficial: "https://dolarapi.com/v1/dolares/oficial" } as const;
export const CACHE_DOLAR_MS = 15 * 60_000;
const CLAVE = "dolar";

export type Cotizacion = { compra: number; venta: number; fechaActualizacion: string };
export type Dolar = { blue: Cotizacion | null; oficial: Cotizacion | null; consultadoEn: string; error: string | null };

async function traer(url: string, timeoutMs = 6000): Promise<Cotizacion> {
  const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store", headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`dolarapi respondió ${r.status}`);
  const j = (await r.json()) as { compra?: unknown; venta?: unknown; fechaActualizacion?: unknown };
  const compra = Number(j.compra);
  const venta = Number(j.venta);
  if (!Number.isFinite(compra) || !Number.isFinite(venta)) throw new Error("dolarapi devolvió un valor inválido");
  return { compra, venta, fechaActualizacion: typeof j.fechaActualizacion === "string" ? j.fechaActualizacion : new Date().toISOString() };
}

/** El último valor guardado (sin salir a internet). */
export async function dolarGuardado(): Promise<Dolar | null> {
  const fila = await db.estadoSistema.findUnique({ where: { clave: CLAVE } });
  return (fila?.valor as Dolar | undefined) ?? null;
}

/**
 * Consulta dolarapi si pasaron 15 minutos (o si se fuerza) y guarda. Si falla, conserva el último
 * valor conocido y anota el error (el próximo intento vuelve a probar). Nunca tira.
 */
export async function refrescarDolar(forzar = false): Promise<Dolar | null> {
  const actual = await dolarGuardado();
  if (!forzar && actual && Date.now() - new Date(actual.consultadoEn).getTime() < CACHE_DOLAR_MS && !actual.error) return actual;
  const [blue, oficial] = await Promise.allSettled([traer(URLS.blue), traer(URLS.oficial)]);
  const ok = <T,>(r: PromiseSettledResult<T>) => (r.status === "fulfilled" ? r.value : null);
  const fallo = [blue, oficial].find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
  const nuevo: Dolar = {
    blue: ok(blue) ?? actual?.blue ?? null,
    oficial: ok(oficial) ?? actual?.oficial ?? null,
    // Si falló, se reintenta en la próxima vuelta del job (consultadoEn no avanza).
    consultadoEn: fallo && actual ? actual.consultadoEn : new Date().toISOString(),
    error: fallo ? String(fallo.reason instanceof Error ? fallo.reason.message : fallo.reason).slice(0, 200) : null,
  };
  try {
    await db.estadoSistema.upsert({ where: { clave: CLAVE }, create: { clave: CLAVE, valor: nuevo }, update: { valor: nuevo } });
  } catch (e) {
    console.error("No se pudo guardar el dólar", e);
  }
  return nuevo;
}

/** Para la pantalla: el guardado, y si está vencido (o no hay), se refresca en el momento. */
export async function dolarActual(): Promise<Dolar | null> {
  const g = await dolarGuardado();
  if (g && Date.now() - new Date(g.consultadoEn).getTime() < CACHE_DOLAR_MS) return g;
  return refrescarDolar();
}

/** Cotización del día para guardar en una OC en dólares (venta del oficial; si no hay, del blue). */
export async function cotizacionParaOC(): Promise<number | null> {
  const d = await dolarActual().catch(() => null);
  return d?.oficial?.venta ?? d?.blue?.venta ?? null;
}
