import "server-only";
import { db } from "@/lib/db";
import { evaluarAlertas } from "@/lib/alertas";
import { avisarAlertas } from "@/lib/alertas/avisar";
import { distancia } from "@/lib/geo";
import { fuenteCusat } from "./index";
import { emparejar } from "./emparejar";
import { evaluarViaje } from "@/lib/viajes/motor";
import { CLAVE, guardarEstado, leerEstado, type UltimaSync } from "./estado";
import type { PosicionCusat } from "./tipos";

/** Mientras alguien mira el mapa o un viaje, se sincroniza si la última vez fue hace más de esto. */
const CADA_MS = 20_000;
/** Se vuelve a pedir la dirección en texto si el vehículo se movió más de esto. */
const NUEVA_DIRECCION_M = 80;

let enCurso: Promise<Awaited<ReturnType<typeof sincronizarAhora>>> | null = null;

/**
 * Sincronización con Cusat (cron cada minuto y al mirar el mapa):
 * 1. pide las posiciones actuales, 2. enlaza unidades con vehículos (emparejar),
 * 3. guarda PosicionVehiculo (fuente CUSAT) solo si la fecha GPS es más nueva que la última,
 * 4. actualiza la última posición del vehículo (ultimaLat, ultimaLng, …), 5. geocercas y alertas.
 * Nunca lanza: el error queda en EstadoSistema y el sistema sigue con la última posición conocida.
 */
export function sincronizar() {
  enCurso ??= sincronizarAhora().finally(() => (enCurso = null));
  return enCurso;
}

async function sincronizarAhora() {
  const t = Date.now();
  const fuente = fuenteCusat();
  try {
    const r = await fuente.obtenerPosicionesActuales();
    if (!r.ok) throw new Error(r.error);

    // En el simulador el id externo ya es el del vehículo.
    const enlace = fuente.modo === "mock" ? new Map(r.datos.map((p) => [p.idExterno, p.idExterno])) : (await emparejar(r.datos)).enlace;
    const ids = [...new Set(enlace.values())];
    const actuales = new Map((await db.vehiculo.findMany({ where: { id: { in: ids } }, select: { id: true, ultimaFechaGps: true, ultimaLat: true, ultimaLng: true, ultimaDireccionTexto: true } })).map((v) => [v.id, v]));

    // La posición de Cusat también es la del viaje en curso de ese vehículo (seguimiento en vivo).
    const viajes = new Map((await db.viaje.findMany({ where: { vehiculoId: { in: ids }, estado: "EN_CURSO" }, select: { id: true, vehiculoId: true } })).map((v) => [v.vehiculoId, v.id]));
    const nuevas: PosicionCusat[] = [];
    for (const p of r.datos) {
      const vehiculoId = enlace.get(p.idExterno);
      const v = vehiculoId ? actuales.get(vehiculoId) : undefined;
      if (!vehiculoId || !v) continue;
      if (v.ultimaFechaGps && p.fechaGps <= v.ultimaFechaGps) continue; // nada nuevo
      const movio = v.ultimaLat == null || v.ultimaLng == null || distancia({ lat: v.ultimaLat, lng: v.ultimaLng }, { lat: p.latitud, lng: p.longitud }) > NUEVA_DIRECCION_M;
      const direccion = p.direccionTexto ?? (!movio && v.ultimaDireccionTexto ? v.ultimaDireccionTexto : ((await fuente.obtenerDireccion?.(p.idExterno)) ?? null));
      await db.$transaction([
        db.posicionVehiculo.create({
          data: { vehiculoId, viajeId: viajes.get(vehiculoId) ?? null, latitud: p.latitud, longitud: p.longitud, velocidad: p.velocidadKmh, rumbo: p.rumbo, motorEncendido: p.motorEncendido, fecha: p.fechaGps, fuente: fuente.modo === "mock" ? "MOCK" : "CUSAT" },
        }),
        db.vehiculo.update({
          where: { id: vehiculoId },
          data: { ultimaLat: p.latitud, ultimaLng: p.longitud, ultimaFechaGps: p.fechaGps, ultimaVelocidad: p.velocidadKmh, ultimaDireccionTexto: direccion },
        }),
      ]);
      nuevas.push({ vehiculoId, latitud: p.latitud, longitud: p.longitud, velocidad: p.velocidadKmh, rumbo: p.rumbo, motorEncendido: p.motorEncendido, fecha: p.fechaGps });
    }

    // Motor de viajes: cada posición nueva de un vehículo con viaje en curso puede pasarlo de etapa.
    const eventos: string[] = [];
    for (const p of nuevas) {
      const viajeId = viajes.get(p.vehiculoId);
      if (!viajeId) continue;
      const m = await evaluarViaje(viajeId, { lat: p.latitud, lng: p.longitud, velocidadKmh: p.velocidad, fecha: p.fecha, fuente: fuente.modo === "mock" ? "MOCK" : "CUSAT" });
      if (m.transicion) eventos.push(`${p.vehiculoId}: ${m.transicion.a}`);
    }
    await avisarAlertas((await evaluarAlertas(["cusat", "pedidos"])).nuevas);

    const resumen: UltimaSync = { fecha: new Date().toISOString(), modo: fuente.modo, recibidas: r.datos.length, enlazadas: enlace.size, nuevas: nuevas.length, ms: Date.now() - t };
    await guardarEstado(CLAVE.ultimaSync, resumen);
    return { ok: true as const, ...resumen, eventos };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("Cusat: no se pudo sincronizar", error);
    await guardarEstado(CLAVE.ultimoError, { fecha: new Date().toISOString(), error }).catch(() => {});
    return { ok: false as const, error, modo: fuente.modo, ms: Date.now() - t };
  }
}

/** Para el mapa y el seguimiento: sincroniza si pasaron más de 20 s, así se actualiza aunque el cron sea lento. */
export async function sincronizarSiHaceFalta() {
  const u = await leerEstado<UltimaSync>(CLAVE.ultimaSync).catch(() => null);
  if (u && Date.now() - new Date(u.valor.fecha).getTime() < CADA_MS) return null;
  return sincronizar();
}
