import { db } from "@/lib/db";
import { distancia } from "@/lib/geo";
import { diaISO, hora } from "@/lib/formato";
import type { AlertaCalculada, Regla } from "../tipos";

/** Horario laboral: lunes a viernes de 7 a 19, sábados de 7 a 13 (hora argentina). */
export function enHorarioLaboral(f: Date) {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(f);
  const dia = partes.find((p) => p.type === "weekday")!.value;
  const h = Number(partes.find((p) => p.type === "hour")!.value) % 24 + Number(partes.find((p) => p.type === "minute")!.value) / 60;
  if (dia === "Sun") return false;
  if (dia === "Sat") return h >= 7 && h < 13;
  return h >= 7 && h < 19;
}

/** Vehículo en movimiento fuera del horario laboral (con Cusat). */
async function fueraDeHorario(): Promise<AlertaCalculada[]> {
  const desde = new Date(Date.now() - 15 * 60_000);
  const pos = await db.posicionVehiculo.findMany({
    where: { fecha: { gte: desde }, velocidad: { gt: 5 } },
    orderBy: { fecha: "desc" },
    include: { vehiculo: { select: { id: true, nombre: true, asignadoAId: true } } },
  });
  const vistos = new Set<string>();
  const out: AlertaCalculada[] = [];
  for (const p of pos) {
    if (vistos.has(p.vehiculoId) || enHorarioLaboral(p.fecha)) continue;
    vistos.add(p.vehiculoId);
    out.push({
      claveUnica: `FUERA_HORARIO:${p.vehiculoId}:${diaISO(p.fecha)}`, regla: "FUERA_HORARIO", severidad: "AVISO",
      titulo: `${p.vehiculo.nombre} andando fuera de horario`, detalle: `A las ${hora(p.fecha)} iba a ${Math.round(p.velocidad)} km/h.`,
      entidadTipo: "Vehiculo", entidadId: p.vehiculoId, enlace: `/mapa?vehiculo=${p.vehiculoId}`, usuarioId: p.vehiculo.asignadoAId,
    });
  }
  return out;
}

/** Parado más de 1 hora durante un viaje en curso (fuera de la obra destino). */
async function paradoEnViaje(): Promise<AlertaCalculada[]> {
  const viajes = await db.viaje.findMany({
    where: { estado: "EN_CURSO", llegadaReal: null, salidaReal: { lt: new Date(Date.now() - 60 * 60_000) } },
    include: { vehiculo: { select: { nombre: true } }, chofer: { select: { id: true, nombre: true } }, pedido: { select: { id: true, obraId: true, obra: { select: { nombre: true, latitud: true, longitud: true, radioGeocercaM: true } } } } },
  });
  const out: AlertaCalculada[] = [];
  for (const v of viajes) {
    const pos = await db.posicionVehiculo.findMany({ where: { vehiculoId: v.vehiculoId, fecha: { gte: new Date(Date.now() - 60 * 60_000) } }, orderBy: { fecha: "asc" } });
    if (pos.length < 3 || pos.some((p) => p.velocidad > 3)) continue;
    // Debe cubrir la hora entera, y lo mismo en un radio chico (no es solo una lectura).
    if (Date.now() - pos[0].fecha.getTime() < 55 * 60_000) continue;
    if (distancia({ lat: pos[0].latitud, lng: pos[0].longitud }, { lat: pos.at(-1)!.latitud, lng: pos.at(-1)!.longitud }) > 150) continue;
    const o = v.pedido.obra;
    if (distancia({ lat: pos.at(-1)!.latitud, lng: pos.at(-1)!.longitud }, { lat: o.latitud, lng: o.longitud }) <= o.radioGeocercaM) continue;
    out.push({
      claveUnica: `PARADO_EN_VIAJE:${v.id}`, regla: "PARADO_EN_VIAJE", severidad: "AVISO",
      titulo: `${v.vehiculo.nombre} parado hace más de 1 h`, detalle: `${v.chofer.nombre} va a Obra ${o.nombre} y el vehículo no se mueve desde las ${hora(pos[0].fecha)}.`,
      entidadTipo: "Viaje", entidadId: v.id, enlace: `/mapa?vehiculo=${v.vehiculoId}`, obraId: v.pedido.obraId,
    });
  }
  return out;
}

export const REGLAS_CUSAT: Regla[] = [
  { nombre: "FUERA_HORARIO", modulo: "cusat", evaluar: fueraDeHorario },
  { nombre: "PARADO_EN_VIAJE", modulo: "cusat", evaluar: paradoEnViaje },
];
