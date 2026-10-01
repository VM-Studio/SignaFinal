import "server-only";
import { db } from "@/lib/db";
import { startOfMonth, endOfMonth, endOfDay, parseISO, isValid } from "date-fns";

export type Periodo = { desde: Date; hasta: Date };

export function periodoDesdeParams(p: { desde?: string; hasta?: string }): Periodo {
  const d = p.desde ? parseISO(p.desde) : null;
  const h = p.hasta ? parseISO(p.hasta) : null;
  const hoy = new Date();
  return {
    desde: d && isValid(d) ? d : startOfMonth(hoy),
    hasta: h && isValid(h) ? endOfDay(h) : endOfMonth(hoy),
  };
}

const n = (v: unknown) => (v == null ? 0 : Number(v));

/** Costo de viajes imputado a cada obra en el período. */
export async function costosPorObra({ desde, hasta }: Periodo) {
  const [grupos, obras] = await Promise.all([
    db.viaje.groupBy({
      by: ["obraId"],
      where: { estado: "FINALIZADO", llegadaEn: { gte: desde, lte: hasta } },
      _sum: { costo: true, kmRecorridos: true, peajes: true },
      _count: { _all: true },
    }),
    db.obra.findMany({ select: { id: true, nombre: true } }),
  ]);
  const nombre = new Map(obras.map((o) => [o.id, o.nombre]));
  return grupos
    .map((g) => ({
      obraId: g.obraId,
      obra: nombre.get(g.obraId) ?? "—",
      viajes: g._count._all,
      km: n(g._sum.kmRecorridos),
      peajes: n(g._sum.peajes),
      costo: n(g._sum.costo),
    }))
    .sort((a, b) => b.costo - a.costo);
}

/** Por vehículo: viajes, combustible y mantenimiento del período. */
export async function costosPorVehiculo({ desde, hasta }: Periodo) {
  const [vehiculos, viajes, cargas, mant] = await Promise.all([
    db.vehiculo.findMany({ select: { id: true, nombre: true, tipo: true }, orderBy: { nombre: "asc" } }),
    db.viaje.groupBy({ by: ["vehiculoId"], where: { estado: "FINALIZADO", llegadaEn: { gte: desde, lte: hasta } }, _sum: { costo: true, kmRecorridos: true }, _count: { _all: true } }),
    db.cargaCombustible.groupBy({ by: ["vehiculoId"], where: { fecha: { gte: desde, lte: hasta } }, _sum: { litros: true, monto: true } }),
    db.mantenimiento.groupBy({ by: ["vehiculoId"], where: { fecha: { gte: desde, lte: hasta } }, _sum: { costo: true }, _count: { _all: true } }),
  ]);
  const v = new Map(viajes.map((x) => [x.vehiculoId, x]));
  const c = new Map(cargas.map((x) => [x.vehiculoId, x]));
  const m = new Map(mant.map((x) => [x.vehiculoId, x]));
  return vehiculos
    .map((veh) => ({
      vehiculoId: veh.id,
      vehiculo: veh.nombre,
      viajes: v.get(veh.id)?._count._all ?? 0,
      km: n(v.get(veh.id)?._sum.kmRecorridos),
      costoViajes: n(v.get(veh.id)?._sum.costo),
      litros: n(c.get(veh.id)?._sum.litros),
      combustible: n(c.get(veh.id)?._sum.monto),
      mantenimiento: n(m.get(veh.id)?._sum.costo),
    }))
    .filter((x) => x.viajes || x.litros || x.mantenimiento);
}

export async function viajesDelPeriodo({ desde, hasta }: Periodo, filtro: { obraId?: string; choferId?: string } = {}) {
  const viajes = await db.viaje.findMany({
    where: { estado: "FINALIZADO", llegadaEn: { gte: desde, lte: hasta }, ...filtro },
    orderBy: { llegadaEn: "desc" },
    select: {
      id: true, salidaEn: true, llegadaEn: true, kmSalida: true, kmLlegada: true, kmRecorridos: true,
      costoKmAplicado: true, peajes: true, costo: true,
      obra: { select: { nombre: true } }, chofer: { select: { nombre: true } }, vehiculo: { select: { nombre: true } },
      pedido: { select: { id: true, numero: true, descripcion: true, origenTexto: true, proveedor: { select: { nombre: true } }, ordenCompra: { select: { numero: true } } } },
    },
  });
  return viajes.map((v) => ({
    ...v,
    costoKmAplicado: n(v.costoKmAplicado),
    peajes: n(v.peajes),
    costo: n(v.costo),
    origen: v.pedido.proveedor?.nombre ?? v.pedido.origenTexto ?? "—",
  }));
}
