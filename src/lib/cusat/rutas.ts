import { nombreSucursal, sucursalDe } from "@/lib/pedidos/puntos";
import "server-only";
import { db } from "@/lib/db";

export type Parada = { tipo: "base" | "retiro" | "obra"; nombre: string; lat: number; lng: number };

type ViajeParaRuta = {
  vehiculo: { baseId: string | null };
  pedido: { origenTipo: "BASE" | "PROVEEDOR" | "DEPOSITO" | "OBRA"; origenId: string; obraId: string };
};

/** Paradas planificadas de un viaje: base del vehículo → donde se retira → obra destino. */
export async function paradasDe(v: ViajeParaRuta): Promise<Parada[]> {
  const [base, obra] = await Promise.all([
    v.vehiculo.baseId ? db.ubicacion.findUnique({ where: { id: v.vehiculo.baseId } }) : db.ubicacion.findFirst({ where: { tipo: "BASE_VEHICULOS" } }),
    db.obra.findUniqueOrThrow({ where: { id: v.pedido.obraId } }),
  ]);
  const paradas: Parada[] = [];
  if (base) paradas.push({ tipo: "base", nombre: base.nombre, lat: base.latitud, lng: base.longitud });
  const { origenTipo, origenId } = v.pedido;
  if (origenTipo === "PROVEEDOR") {
    const p = await sucursalDe(db, origenId);
    if (p) paradas.push({ tipo: "retiro", nombre: nombreSucursal(p), lat: p.latitud, lng: p.longitud });
  } else if (origenTipo === "OBRA" && origenId !== v.pedido.obraId) {
    const o = await db.obra.findUnique({ where: { id: origenId } });
    if (o) paradas.push({ tipo: "retiro", nombre: `Obra ${o.nombre}`, lat: o.latitud, lng: o.longitud });
  } else if (origenTipo === "DEPOSITO" || (origenTipo === "BASE" && origenId !== base?.id)) {
    const u = await db.ubicacion.findUnique({ where: { id: origenId } });
    if (u && u.id !== base?.id) paradas.push({ tipo: "retiro", nombre: u.nombre, lat: u.latitud, lng: u.longitud });
  }
  paradas.push({ tipo: "obra", nombre: `Obra ${obra.nombre}`, lat: obra.latitud, lng: obra.longitud });
  return paradas;
}
