import "server-only";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { documentosVigentes } from "@/lib/flota/consultas";
import { conAlcance, viajesVisibles } from "@/lib/alcance";

/** Cada query verifica su permiso: no alcanza con esconder el botón. */


export async function pedidosPendientes() {
  const u = await exigirPermiso("pedidos.ver");
  return db.pedidoViaje.count({ where: conAlcance(u, { estado: "PENDIENTE" }) });
}

export async function devolucionesVencidas() {
  await exigirPermiso("herramientas.mover");
  return db.herramienta.findMany({
    where: { activo: true, obraId: { not: null }, devolucionPrevista: { lt: new Date() } },
    orderBy: { devolucionPrevista: "asc" },
    select: { id: true, codigo: true, nombre: true, devolucionPrevista: true, obra: { select: { nombre: true } }, responsable: { select: { nombre: true } } },
  });
}

export async function resumenDireccion() {
  const u = await exigirPermiso("mapa.ver");
  const [pendientes, enViaje, criticas] = await Promise.all([
    db.pedidoViaje.count({ where: conAlcance(u, { estado: "PENDIENTE" }) }),
    db.viaje.count({ where: { ...viajesVisibles(u), estado: "EN_CURSO" } }),
    db.alerta.count({ where: { estado: { not: "RESUELTA" }, severidad: "CRITICA" } }),
  ]);
  return { pendientes, enViaje, criticas };
}

export async function vencimientosProximos(dias = 30) {
  await exigirPermiso("flota.documentacion");
  const docs = await db.documentoVehiculo.findMany({
    where: { vencimiento: { not: null }, vehiculo: { activo: true } },
    select: { id: true, tipo: true, vencimiento: true, archivoUrl: true, notas: true, creadoEn: true, vehiculoId: true, vehiculo: { select: { id: true, nombre: true } } },
  });
  // Solo el documento vigente de cada tipo (el renovado reemplaza al anterior).
  const porVehiculo = new Map<string, typeof docs>();
  for (const d of docs) porVehiculo.set(d.vehiculoId, [...(porVehiculo.get(d.vehiculoId) ?? []), d]);
  const limite = new Date(Date.now() + dias * 86_400_000);
  return [...porVehiculo.values()]
    .flatMap((lista) => documentosVigentes(lista) as typeof docs)
    .filter((d) => d.vencimiento! <= limite)
    .sort((a, b) => a.vencimiento!.getTime() - b.vencimiento!.getTime());
}
