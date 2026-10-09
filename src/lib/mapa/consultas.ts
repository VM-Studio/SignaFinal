import "server-only";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { aFecha, diaISO, sumarDias } from "@/lib/formato";
import { sincronizarSiHaceFalta } from "@/lib/cusat/sincronizar";
import { modoCusat, type ModoCusat } from "@/lib/cusat";
import { kmDelDia, paradasDelDia, rastroDelDia, type ParadaDetectada } from "@/lib/cusat/historial";
import { paradasDe, type Parada } from "@/lib/cusat/rutas";
import type { TipoUbicacion } from "@prisma/client";
import { viajesVisibles } from "@/lib/alcance";

export type VehiculoMapa = {
  id: string; nombre: string; tipo: "CAMION" | "CAMIONETA" | "AUTO" | "MAQUINA"; estado: "DISPONIBLE" | "EN_VIAJE" | "EN_TALLER" | "FUERA_DE_SERVICIO";
  patente: string; lat: number; lng: number; velocidad: number; rumbo: number;
  /** Fecha GPS de la última posición (la pantalla muestra "hace 48 seg" y lo pone gris pasados 10 minutos). */
  fecha: string;
  direccion: string | null;
  chofer: string | null;
  viaje: { pedidoId: string; descripcion: string; obra: string; llegoPorGps: boolean } | null;
};
export type ObraMapa = { id: string; nombre: string; lat: number; lng: number; radio: number };
export type LugarMapa = { id: string; nombre: string; lat: number; lng: number; tipo: TipoUbicacion };
export type DatosMapa = { vehiculos: VehiculoMapa[]; obras: ObraMapa[]; lugares: LugarMapa[]; origen: ModoCusat; actualizado: string; sinGps: string[] };

/** Estado del mapa: la última posición de cada vehículo (Vehiculo.ultima*). Antes, sincroniza con Cusat si hace falta. */
export async function datosMapa(): Promise<DatosMapa> {
  await exigirPermiso("mapa.ver");
  await sincronizarSiHaceFalta(); // nunca lanza
  const [vehiculos, obras, lugares] = await Promise.all([
    db.vehiculo.findMany({
      where: { activo: true },
      orderBy: [{ tipo: "asc" }, { nombre: "asc" }],
      select: {
        id: true, nombre: true, tipo: true, estado: true, patente: true,
        ultimaLat: true, ultimaLng: true, ultimaFechaGps: true, ultimaVelocidad: true, ultimaDireccionTexto: true,
        asignadoA: { select: { nombre: true } },
        posiciones: { orderBy: { fecha: "desc" }, take: 1, select: { rumbo: true } },
        viajes: { where: { estado: "EN_CURSO" }, take: 1, select: { llegadaReal: true, chofer: { select: { nombre: true } }, pedido: { select: { id: true, descripcion: true, obra: { select: { nombre: true } } } } } },
      },
    }),
    db.obra.findMany({ where: { estado: "ACTIVA" }, select: { id: true, nombre: true, latitud: true, longitud: true, radioGeocercaM: true } }),
    db.ubicacion.findMany(),
  ]);
  return {
    vehiculos: vehiculos.flatMap((v): VehiculoMapa[] => {
      if (v.ultimaLat == null || v.ultimaLng == null || !v.ultimaFechaGps) return [];
      const viaje = v.viajes[0];
      return [{
        id: v.id, nombre: v.nombre, tipo: v.tipo, estado: v.estado, patente: v.patente,
        lat: v.ultimaLat, lng: v.ultimaLng, velocidad: Math.round(v.ultimaVelocidad ?? 0), rumbo: v.posiciones[0]?.rumbo ?? 0,
        fecha: v.ultimaFechaGps.toISOString(), direccion: v.ultimaDireccionTexto,
        chofer: viaje?.chofer.nombre ?? v.asignadoA?.nombre ?? null,
        viaje: viaje ? { pedidoId: viaje.pedido.id, descripcion: viaje.pedido.descripcion, obra: viaje.pedido.obra.nombre, llegoPorGps: !!viaje.llegadaReal } : null,
      }];
    }),
    obras: obras.map((o) => ({ id: o.id, nombre: o.nombre, lat: o.latitud, lng: o.longitud, radio: o.radioGeocercaM })),
    lugares: lugares.map((l) => ({ id: l.id, nombre: l.nombre, lat: l.latitud, lng: l.longitud, tipo: l.tipo })),
    origen: modoCusat(),
    actualizado: new Date().toISOString(),
    sinGps: vehiculos.filter((v) => v.ultimaLat == null).map((v) => v.nombre),
  };
}

export type ParadaNumerada = Parada & { numero: number; viaje: string };
export type { PuntoRastro, ParadaDetectada } from "@/lib/cusat/historial";
import type { PuntoRastro } from "@/lib/cusat/historial";

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

export type ViajeDelDia = { pedidoId: string; numero: number; descripcion: string; obra: string; desde: string; hasta: string };

/**
 * /mapa/historial: el recorrido real de un vehículo en un día (Cusat), sus paradas (más de 5 minutos
 * quieto), los km y los viajes del sistema de ese día para superponerlos.
 */
export async function historial(vehiculoId: string | undefined, dia: string) {
  const u = await exigirPermiso("mapa.ver");
  const vehiculos = await db.vehiculo.findMany({
    where: { activo: true, ...(modoCusat() === "cusatview" ? { idCusat: { not: null } } : {}) },
    orderBy: [{ tipo: "asc" }, { nombre: "asc" }],
    select: { id: true, nombre: true },
  });
  const vacio = { vehiculos, rastro: [] as PuntoRastro[], paradas: [] as ParadaDetectada[], km: 0, viajes: [] as ViajeDelDia[] };
  if (!vehiculoId) return vacio;
  const desde = aFecha(dia);
  const hasta = aFecha(sumarDias(dia, 1));
  const [rastro, viajes] = await Promise.all([
    rastroDelDia(vehiculoId, dia),
    db.viaje.findMany({
      where: { ...viajesVisibles(u), vehiculoId, salidaReal: { lt: hasta }, OR: [{ llegadaReal: null }, { llegadaReal: { gte: desde } }], estado: { in: ["EN_CURSO", "FINALIZADO"] } },
      orderBy: { salidaReal: "asc" },
      select: { salidaReal: true, llegadaReal: true, pedido: { select: { id: true, numero: true, descripcion: true, obra: { select: { nombre: true } } } } },
    }),
  ]);
  return {
    vehiculos, rastro, km: kmDelDia(rastro), paradas: await paradasDelDia(rastro),
    viajes: viajes.map((v) => ({
      pedidoId: v.pedido.id, numero: v.pedido.numero, descripcion: v.pedido.descripcion, obra: v.pedido.obra.nombre,
      desde: v.salidaReal!.toISOString(), hasta: (v.llegadaReal ?? new Date()).toISOString(),
    })),
  };
}
