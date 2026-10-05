import "server-only";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { aFecha, diaISO, sumarDias } from "@/lib/formato";
import { capturarPosiciones } from "@/lib/cusat/captura";
import { clienteCusat } from "@/lib/cusat";
import { paradasDe, type Parada } from "@/lib/cusat/rutas";
import type { TipoUbicacion } from "@prisma/client";
import { viajesVisibles } from "@/lib/alcance";

export type VehiculoMapa = {
  id: string; nombre: string; tipo: "CAMION" | "CAMIONETA" | "AUTO" | "MAQUINA"; estado: "DISPONIBLE" | "EN_VIAJE" | "EN_TALLER" | "FUERA_DE_SERVICIO";
  patente: string; lat: number; lng: number; velocidad: number; rumbo: number; fecha: string;
  chofer: string | null;
  viaje: { pedidoId: string; descripcion: string; obra: string; llegoPorGps: boolean } | null;
};
export type ObraMapa = { id: string; nombre: string; lat: number; lng: number; radio: number };
export type LugarMapa = { id: string; nombre: string; lat: number; lng: number; tipo: TipoUbicacion };
export type DatosMapa = { vehiculos: VehiculoMapa[]; obras: ObraMapa[]; lugares: LugarMapa[]; origen: "mock" | "api"; actualizado: string; sinGps: string[] };

/** Estado del mapa. Antes de leer, pide posiciones nuevas si las últimas tienen más de un minuto. */
export async function datosMapa(): Promise<DatosMapa> {
  await exigirPermiso("mapa.ver");
  try {
    await capturarPosiciones();
  } catch (e) {
    console.error("No se pudieron capturar posiciones", e);
  }
  const [vehiculos, obras, lugares] = await Promise.all([
    db.vehiculo.findMany({
      where: { activo: true },
      orderBy: [{ tipo: "asc" }, { nombre: "asc" }],
      select: {
        id: true, nombre: true, tipo: true, estado: true, patente: true, idCusat: true,
        asignadoA: { select: { nombre: true } },
        posiciones: { orderBy: { fecha: "desc" }, take: 1 },
        viajes: { where: { estado: "EN_CURSO" }, take: 1, select: { llegadaReal: true, chofer: { select: { nombre: true } }, pedido: { select: { id: true, descripcion: true, obra: { select: { nombre: true } } } } } },
      },
    }),
    db.obra.findMany({ where: { estado: "ACTIVA" }, select: { id: true, nombre: true, latitud: true, longitud: true, radioGeocercaM: true } }),
    db.ubicacion.findMany(),
  ]);
  return {
    vehiculos: vehiculos.flatMap((v): VehiculoMapa[] => {
      const p = v.posiciones[0];
      if (!p) return [];
      const viaje = v.viajes[0];
      return [{
        id: v.id, nombre: v.nombre, tipo: v.tipo, estado: v.estado, patente: v.patente,
        lat: p.latitud, lng: p.longitud, velocidad: Math.round(p.velocidad), rumbo: p.rumbo, fecha: p.fecha.toISOString(),
        chofer: viaje?.chofer.nombre ?? v.asignadoA?.nombre ?? null,
        viaje: viaje ? { pedidoId: viaje.pedido.id, descripcion: viaje.pedido.descripcion, obra: viaje.pedido.obra.nombre, llegoPorGps: !!viaje.llegadaReal } : null,
      }];
    }),
    obras: obras.map((o) => ({ id: o.id, nombre: o.nombre, lat: o.latitud, lng: o.longitud, radio: o.radioGeocercaM })),
    lugares: lugares.map((l) => ({ id: l.id, nombre: l.nombre, lat: l.latitud, lng: l.longitud, tipo: l.tipo })),
    origen: clienteCusat().origen,
    actualizado: new Date().toISOString(),
    sinGps: vehiculos.filter((v) => !v.posiciones.length).map((v) => v.nombre),
  };
}

export type ParadaNumerada = Parada & { numero: number; viaje: string };
export type PuntoRastro = { lat: number; lng: number; fecha: string; velocidad: number };

async function rastroDelDia(vehiculoId: string, dia: string): Promise<PuntoRastro[]> {
  const desde = aFecha(dia);
  const hasta = aFecha(sumarDias(dia, 1));
  let pos = (await db.posicionVehiculo.findMany({ where: { vehiculoId, fecha: { gte: desde, lt: hasta } }, orderBy: { fecha: "asc" } })).map((p) => ({ lat: p.latitud, lng: p.longitud, fecha: p.fecha.toISOString(), velocidad: p.velocidad }));
  // Pocos puntos guardados (el cron no corrió todo el día): se completa con el historial del adaptador.
  if (pos.length < 10) {
    const h = await clienteCusat().obtenerHistorial(vehiculoId, desde, hasta);
    if (h.length > pos.length) pos = h.map((p) => ({ lat: p.latitud, lng: p.longitud, fecha: p.fecha.toISOString(), velocidad: p.velocidad }));
  }
  return pos;
}

/** "Ver recorrido de hoy": la ruta planificada (paradas numeradas) y el rastro real. */
export async function recorridoDelDia(vehiculoId: string, dia = diaISO()) {
  const u = await exigirPermiso("mapa.ver");
  const desde = aFecha(dia);
  const hasta = aFecha(sumarDias(dia, 1));
  const viajes = await db.viaje.findMany({
    where: { ...viajesVisibles(u), vehiculoId, estado: { not: "CANCELADO" }, OR: [{ salidaReal: { gte: desde, lt: hasta } }, { salidaReal: null, salidaEstimada: { gte: desde, lt: hasta } }] },
    orderBy: [{ salidaReal: { sort: "asc", nulls: "last" } }, { ordenRuta: { sort: "asc", nulls: "last" } }, { salidaEstimada: "asc" }],
    include: { vehiculo: { select: { baseId: true } }, pedido: { select: { origenTipo: true, origenId: true, obraId: true, descripcion: true } } },
  });
  const paradas: ParadaNumerada[] = [];
  for (const v of viajes) {
    for (const p of await paradasDe(v)) {
      // La base solo al principio; si dos paradas seguidas son el mismo lugar, va una.
      if (p.tipo === "base" && paradas.length) continue;
      const ult = paradas.at(-1);
      if (ult && ult.lat === p.lat && ult.lng === p.lng) continue;
      paradas.push({ ...p, numero: paradas.length + 1, viaje: v.pedido.descripcion });
    }
  }
  return { paradas, rastro: await rastroDelDia(vehiculoId, dia) };
}

/** /mapa/historial: vehículos para elegir y el recorrido completo de un día. */
export async function historial(vehiculoId: string | undefined, dia: string) {
  await exigirPermiso("mapa.ver");
  const vehiculos = await db.vehiculo.findMany({ where: { activo: true, idCusat: { not: null } }, orderBy: [{ tipo: "asc" }, { nombre: "asc" }], select: { id: true, nombre: true } });
  if (!vehiculoId) return { vehiculos, rastro: [] as PuntoRastro[], paradas: [] as ParadaNumerada[] };
  const r = await recorridoDelDia(vehiculoId, dia);
  return { vehiculos, ...r };
}
