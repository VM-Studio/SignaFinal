import { nombreSucursal } from "@/lib/pedidos/puntos";
import "server-only";
import { db } from "@/lib/db";
import { aFecha, diaISO, sumarDias } from "@/lib/formato";
import { distancia } from "@/lib/geo";
import { fuenteCusat } from "./index";
import { CLAVE, guardarEstado, leerEstado } from "./estado";

export type PuntoRastro = { lat: number; lng: number; fecha: string; velocidad: number };
export type ParadaDetectada = { numero: number; lat: number; lng: number; llegada: string; salida: string; minutos: number; direccion: string };

/** Más rápido que esto entre dos puntos es un salto del GPS: no suma km. */
const VELOCIDAD_IMPOSIBLE_KMH = 150;
/** Quieto (velocidad 0) más que esto es una parada. */
const PARADA_MIN = 5;
/** Una parada a menos de esto de una obra, proveedor o base se nombra con ese lugar. */
const CERCA_M = 250;

/**
 * Recorrido de un vehículo en un día. Fuente: Cusat (o el simulador). Los días pasados se guardan en
 * PosicionVehiculo la primera vez y después se leen de ahí (no se le vuelve a pedir a Cusat).
 * Si Cusat no responde, lo que haya guardado (incluye las posiciones del teléfono del chofer).
 */
export async function rastroDelDia(vehiculoId: string, dia: string): Promise<PuntoRastro[]> {
  const desde = aFecha(dia);
  const hasta = aFecha(sumarDias(dia, 1));
  const guardado = async () =>
    (await db.posicionVehiculo.findMany({ where: { vehiculoId, fecha: { gte: desde, lt: hasta } }, orderBy: { fecha: "asc" }, select: { latitud: true, longitud: true, fecha: true, velocidad: true } }))
      .map((p) => ({ lat: p.latitud, lng: p.longitud, fecha: p.fecha.toISOString(), velocidad: p.velocidad }));

  const pasado = dia < diaISO();
  if (pasado && (await leerEstado(CLAVE.historial(vehiculoId, dia)))) return guardado();

  const fuente = fuenteCusat();
  const v = await db.vehiculo.findUnique({ where: { id: vehiculoId }, select: { idCusat: true } });
  const idExterno = fuente.modo === "mock" ? vehiculoId : v?.idCusat;
  if (!idExterno) return guardado();
  const r = await fuente.obtenerHistorial(idExterno, desde, new Date(Math.min(hasta.getTime() - 1, Date.now())));
  if (!r.ok || r.datos.length === 0) return guardado();

  // Día terminado: se guarda una vez (sin repetir los puntos que ya estaban) y queda marcado.
  if (pasado && fuente.modo === "cusatview") {
    const ya = new Set((await db.posicionVehiculo.findMany({ where: { vehiculoId, fecha: { gte: desde, lt: hasta }, fuente: "CUSAT" }, select: { fecha: true } })).map((p) => p.fecha.getTime()));
    const nuevos = r.datos.filter((p) => !ya.has(p.fecha.getTime()));
    if (nuevos.length) await db.posicionVehiculo.createMany({ data: nuevos.map((p) => ({ vehiculoId, latitud: p.latitud, longitud: p.longitud, velocidad: p.velocidadKmh, motorEncendido: p.velocidadKmh > 0, fecha: p.fecha, fuente: "CUSAT" as const })) });
    await guardarEstado(CLAVE.historial(vehiculoId, dia), { puntos: r.datos.length, guardado: new Date().toISOString() });
  }
  return r.datos.map((p) => ({ lat: p.latitud, lng: p.longitud, fecha: p.fecha.toISOString(), velocidad: p.velocidadKmh }));
}

/** Km del día: suma de distancias entre puntos, sin los saltos imposibles (más de 150 km/h). */
export function kmDelDia(rastro: PuntoRastro[]) {
  let m = 0;
  for (let i = 1; i < rastro.length; i++) {
    const d = distancia(rastro[i - 1], rastro[i]);
    const s = (new Date(rastro[i].fecha).getTime() - new Date(rastro[i - 1].fecha).getTime()) / 1000;
    if (s <= 0 || (d / s) * 3.6 > VELOCIDAD_IMPOSIBLE_KMH) continue;
    m += d;
  }
  return Math.round(m / 100) / 10;
}

/** Paradas: velocidad 0 durante más de 5 minutos. Numeradas, con hora de llegada, duración y dónde. */
export async function paradasDelDia(rastro: PuntoRastro[]): Promise<ParadaDetectada[]> {
  const tramos: { desde: number; hasta: number }[] = [];
  let ini = -1;
  for (let i = 0; i <= rastro.length; i++) {
    const quieto = i < rastro.length && rastro[i].velocidad < 1;
    if (quieto && ini < 0) ini = i;
    if (!quieto && ini >= 0) {
      const fin = Math.min(i, rastro.length - 1);
      const min = (new Date(rastro[fin].fecha).getTime() - new Date(rastro[ini].fecha).getTime()) / 60_000;
      if (min > PARADA_MIN) tramos.push({ desde: ini, hasta: fin });
      ini = -1;
    }
  }
  const lugares = await lugaresConocidos();
  const out: ParadaDetectada[] = [];
  for (const [k, t] of tramos.entries()) {
    const p = rastro[t.desde];
    const cerca = lugares.map((l) => ({ l, d: distancia(p, l) })).filter((x) => x.d <= CERCA_M).sort((a, b) => a.d - b.d)[0];
    out.push({
      numero: k + 1, lat: p.lat, lng: p.lng, llegada: p.fecha, salida: rastro[t.hasta].fecha,
      minutos: Math.round((new Date(rastro[t.hasta].fecha).getTime() - new Date(p.fecha).getTime()) / 60_000),
      direccion: cerca?.l.nombre ?? (k < 12 ? await direccionDe(p.lat, p.lng) : null) ?? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`,
    });
  }
  return out;
}

async function lugaresConocidos() {
  const [obras, proveedores, ubicaciones] = await Promise.all([
    db.obra.findMany({ select: { nombre: true, latitud: true, longitud: true } }),
    db.sucursalProveedor.findMany({ where: { activa: true }, select: { latitud: true, longitud: true, nombre: true, proveedor: { select: { nombre: true } } } }),
    db.ubicacion.findMany({ select: { nombre: true, latitud: true, longitud: true } }),
  ]);
  return [
    ...obras.map((o) => ({ nombre: `Obra ${o.nombre}`, lat: o.latitud, lng: o.longitud })),
    ...proveedores.map((o) => ({ nombre: nombreSucursal(o), lat: o.latitud, lng: o.longitud })),
    ...ubicaciones.map((o) => ({ nombre: o.nombre, lat: o.latitud, lng: o.longitud })),
  ];
}

/** Dirección de un punto (OpenStreetMap, gratis). Se guarda para no volver a pedirla. Sin respuesta en 3 s: null. */
async function direccionDe(lat: number, lng: number): Promise<string | null> {
  const clave = `geo.${lat.toFixed(4)},${lng.toFixed(4)}`;
  const ya = await leerEstado<string>(clave);
  if (ya) return ya.valor;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`, {
      headers: { "User-Agent": "SIGNA-Logistica/1.0 (signa-final.vercel.app)", "Accept-Language": "es" },
      signal: AbortSignal.timeout(3_000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { address?: Record<string, string> };
    const a = j.address ?? {};
    const texto = [[a.road, a.house_number].filter(Boolean).join(" "), a.suburb ?? a.city_district ?? a.town ?? a.city].filter(Boolean).join(", ");
    if (texto) await guardarEstado(clave, texto);
    return texto || null;
  } catch {
    return null;
  }
}
