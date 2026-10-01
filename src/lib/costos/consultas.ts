import "server-only";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { aFecha, diaISO, inicioDelMes, inicioMesSiguiente, sumarDias } from "@/lib/formato";

export type Periodo = { desde: Date; hasta: Date; desdeISO: string; hastaISO: string };

/** Período desde ?desde=2026-10-01&hasta=2026-10-31 (días incluidos). Por defecto, el mes actual. */
export function periodo(p: { desde?: string; hasta?: string } = {}): Periodo {
  const valido = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const desdeISO = valido(p.desde) ? p.desde! : diaISO(inicioDelMes());
  const hastaISO = valido(p.hasta) ? p.hasta! : diaISO(new Date(inicioMesSiguiente().getTime() - 1));
  return { desde: aFecha(desdeISO), hasta: aFecha(sumarDias(hastaISO, 1)), desdeISO, hastaISO };
}

const n = (v: unknown) => (v == null ? 0 : Number(v));

async function viajesDelPeriodo({ desde, hasta }: Periodo) {
  return db.viaje.findMany({
    where: { estado: "FINALIZADO", llegadaReal: { gte: desde, lt: hasta } },
    select: { vehiculoId: true, kmSalida: true, kmLlegada: true, costoCalculado: true, peajes: true, pedido: { select: { obraId: true } } },
  });
}

export type FilaObra = { obraId: string; codigo: string; idLebane: string | null; obra: string; viajes: number; km: number; peajes: number; costoViajes: number; combustible: number; litros: number; total: number };

/** Por obra: viajes, km, costo de viajes y combustible imputado. */
export async function costosPorObra(p: Periodo): Promise<FilaObra[]> {
  await exigirPermiso("costos.ver");
  const [viajes, cargas, obras] = await Promise.all([
    viajesDelPeriodo(p),
    db.cargaCombustible.findMany({ where: { obraId: { not: null }, fecha: { gte: p.desde, lt: p.hasta } }, select: { obraId: true, monto: true, litros: true } }),
    db.obra.findMany({ select: { id: true, codigo: true, idLebane: true, nombre: true } }),
  ]);
  const filas = new Map<string, FilaObra>();
  const fila = (id: string) => {
    if (!filas.has(id)) {
      const o = obras.find((x) => x.id === id)!;
      filas.set(id, { obraId: id, codigo: o.codigo, idLebane: o.idLebane, obra: o.nombre, viajes: 0, km: 0, peajes: 0, costoViajes: 0, combustible: 0, litros: 0, total: 0 });
    }
    return filas.get(id)!;
  };
  for (const v of viajes) {
    const f = fila(v.pedido.obraId);
    f.viajes++;
    f.km += (v.kmLlegada ?? 0) - (v.kmSalida ?? 0);
    f.peajes += n(v.peajes);
    f.costoViajes += n(v.costoCalculado);
  }
  for (const c of cargas) {
    const f = fila(c.obraId!);
    f.combustible += n(c.monto);
    f.litros += n(c.litros);
  }
  return [...filas.values()].map((f) => ({ ...f, total: f.costoViajes + f.combustible })).sort((a, b) => b.total - a.total);
}

export type FilaVehiculo = {
  vehiculoId: string; vehiculo: string; patente: string; viajes: number; km: number; costoViajes: number;
  combustible: number; litros: number; mantenimiento: number; incidentes: number; costoReal: number; costoPorKm: number | null;
};

/** Por vehículo: lo mismo, más mantenimiento e incidentes y el costo real por km. */
export async function costosPorVehiculo(p: Periodo, vehiculoId?: string): Promise<FilaVehiculo[]> {
  await exigirPermiso("flota.ver");
  const filtroV = vehiculoId ? { vehiculoId } : {};
  const [vehiculos, viajes, cargas, mant, inc] = await Promise.all([
    db.vehiculo.findMany({ where: vehiculoId ? { id: vehiculoId } : { activo: true }, select: { id: true, nombre: true, patente: true }, orderBy: [{ tipo: "asc" }, { nombre: "asc" }] }),
    db.viaje.findMany({ where: { ...filtroV, estado: "FINALIZADO", llegadaReal: { gte: p.desde, lt: p.hasta } }, select: { vehiculoId: true, kmSalida: true, kmLlegada: true, costoCalculado: true } }),
    db.cargaCombustible.findMany({ where: { ...filtroV, fecha: { gte: p.desde, lt: p.hasta } }, select: { vehiculoId: true, monto: true, litros: true } }),
    db.mantenimientoVehiculo.findMany({ where: { ...filtroV, fecha: { gte: p.desde, lt: p.hasta } }, select: { vehiculoId: true, costo: true } }),
    db.incidenteVehiculo.findMany({ where: { ...filtroV, fecha: { gte: p.desde, lt: p.hasta } }, select: { vehiculoId: true, monto: true } }),
  ]);
  return vehiculos.map((v) => {
    const vj = viajes.filter((x) => x.vehiculoId === v.id);
    const kmTot = vj.reduce((a, x) => a + (x.kmLlegada ?? 0) - (x.kmSalida ?? 0), 0);
    const combustible = cargas.filter((x) => x.vehiculoId === v.id).reduce((a, x) => a + n(x.monto), 0);
    const mantenimiento = mant.filter((x) => x.vehiculoId === v.id).reduce((a, x) => a + n(x.costo), 0);
    const incidentes = inc.filter((x) => x.vehiculoId === v.id).reduce((a, x) => a + n(x.monto), 0);
    const costoReal = combustible + mantenimiento + incidentes;
    return {
      vehiculoId: v.id, vehiculo: v.nombre, patente: v.patente, viajes: vj.length, km: kmTot,
      costoViajes: vj.reduce((a, x) => a + n(x.costoCalculado), 0),
      combustible, litros: cargas.filter((x) => x.vehiculoId === v.id).reduce((a, x) => a + n(x.litros), 0),
      mantenimiento, incidentes, costoReal, costoPorKm: kmTot > 0 ? costoReal / kmTot : null,
    };
  });
}
