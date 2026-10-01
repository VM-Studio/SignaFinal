import "server-only";
import { db } from "@/lib/db";
import { clienteCusat } from "@/lib/cusat";

export type VehiculoEnMapa = {
  id: string;
  nombre: string;
  tipo: "CAMION" | "CAMIONETA" | "AUTO";
  lat: number;
  lng: number;
  velocidadKmh: number;
  rumbo: number;
  motorEncendido: boolean;
  registradaEn: string;
  estado: string; // "En viaje a Obra Darwin · Claudio", "Estacionado"
  enViaje: boolean;
};

export type PuntoEnMapa = { id: string; nombre: string; detalle: string; lat: number; lng: number; tipo: "obra" | "deposito" | "cochera" };

export type DatosMapa = {
  vehiculos: VehiculoEnMapa[];
  puntos: PuntoEnMapa[];
  sinGps: string[];
  origen: "mock" | "api";
  actualizado: string;
};

export async function datosMapa(): Promise<DatosMapa> {
  const cusat = clienteCusat();
  const [vehiculos, obras, lugares] = await Promise.all([
    db.vehiculo.findMany({
      where: { activo: true },
      select: {
        id: true, nombre: true, tipo: true, idCusat: true,
        viajes: { where: { estado: "EN_VIAJE" }, take: 1, select: { chofer: { select: { nombre: true } }, obra: { select: { nombre: true } } } },
      },
      orderBy: { nombre: "asc" },
    }),
    db.obra.findMany({ where: { activa: true, lat: { not: null }, lng: { not: null } }, select: { id: true, nombre: true, direccion: true, lat: true, lng: true } }),
    db.lugar.findMany({ where: { activo: true, lat: { not: null }, lng: { not: null } } }),
  ]);

  const conGps = vehiculos.filter((v) => v.idCusat);
  const posiciones = await cusat.posicionesActuales(conGps.map((v) => v.idCusat!));
  const porId = new Map(posiciones.map((p) => [p.idCusat, p]));

  return {
    vehiculos: conGps.flatMap((v) => {
      const p = porId.get(v.idCusat!);
      if (!p) return [];
      const viaje = v.viajes[0];
      return [{
        id: v.id,
        nombre: v.nombre,
        tipo: v.tipo,
        lat: p.lat,
        lng: p.lng,
        velocidadKmh: p.velocidadKmh,
        rumbo: p.rumbo,
        motorEncendido: p.motorEncendido,
        registradaEn: p.registradaEn,
        enViaje: !!viaje,
        estado: viaje ? `En viaje a Obra ${viaje.obra.nombre} · ${viaje.chofer.nombre}` : p.velocidadKmh > 0 ? `En movimiento · ${p.velocidadKmh} km/h` : "Estacionado",
      }];
    }),
    puntos: [
      ...obras.map((o) => ({ id: o.id, nombre: `Obra ${o.nombre}`, detalle: o.direccion, lat: o.lat!, lng: o.lng!, tipo: "obra" as const })),
      ...lugares.map((l) => ({ id: l.id, nombre: l.nombre, detalle: l.direccion, lat: l.lat!, lng: l.lng!, tipo: l.tipo === "DEPOSITO" ? ("deposito" as const) : ("cochera" as const) })),
    ],
    sinGps: vehiculos.filter((v) => !v.idCusat).map((v) => v.nombre),
    origen: cusat.origen,
    actualizado: new Date().toISOString(),
  };
}
