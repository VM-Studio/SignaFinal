import "server-only";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";

export type MarcadorVehiculo = { id: string; nombre: string; lat: number; lng: number; enViaje: boolean; detalle: string; fecha: string };
export type MarcadorLugar = { id: string; nombre: string; lat: number; lng: number; tipo: "obra" | "base" | "deposito" };

/** Última posición de cada vehículo (Cusat), obras activas, base y depósito. */
export async function datosMapa() {
  await exigirPermiso("mapa.ver");
  const [vehiculos, obras, ubicaciones] = await Promise.all([
    db.vehiculo.findMany({
      where: { activo: true },
      select: {
        id: true, nombre: true, estado: true,
        posiciones: { orderBy: { fecha: "desc" }, take: 1 },
        viajes: { where: { estado: "EN_CURSO" }, take: 1, select: { chofer: { select: { nombre: true } }, pedido: { select: { obra: { select: { nombre: true } } } } } },
      },
    }),
    db.obra.findMany({ where: { estado: "ACTIVA" }, select: { id: true, nombre: true, latitud: true, longitud: true } }),
    db.ubicacion.findMany(),
  ]);
  const marcadores: MarcadorVehiculo[] = vehiculos.flatMap((v) => {
    const p = v.posiciones[0];
    if (!p) return [];
    const viaje = v.viajes[0];
    return [{
      id: v.id, nombre: v.nombre, lat: p.latitud, lng: p.longitud, enViaje: !!viaje, fecha: p.fecha.toISOString(),
      detalle: viaje ? `En viaje a Obra ${viaje.pedido.obra.nombre} · ${viaje.chofer.nombre}` : p.velocidad > 0 ? `En movimiento · ${Math.round(p.velocidad)} km/h` : "Detenido",
    }];
  });
  const lugares: MarcadorLugar[] = [
    ...obras.map((o) => ({ id: o.id, nombre: `Obra ${o.nombre}`, lat: o.latitud, lng: o.longitud, tipo: "obra" as const })),
    ...ubicaciones.map((u) => ({ id: u.id, nombre: u.nombre, lat: u.latitud, lng: u.longitud, tipo: u.tipo === "DEPOSITO" ? ("deposito" as const) : ("base" as const) })),
  ];
  return { vehiculos: marcadores, lugares, sinPosicion: vehiculos.filter((v) => !v.posiciones.length).map((v) => v.nombre) };
}
