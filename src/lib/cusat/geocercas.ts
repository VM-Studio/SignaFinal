import "server-only";
import { db } from "@/lib/db";
import { distancia } from "@/lib/geo";
import type { PosicionCusat } from "./tipos";
import { auditar } from "@/lib/auditoria";
import { describirPedido } from "@/lib/pedidos/reglas";
import { conEtapa } from "@/lib/viajes/etapas";
import { alCambiarElViaje } from "@/lib/materiales/circuito";

const SALIDA_DE_BASE_M = 300;

/**
 * Geocercas:
 * - Entró en el radio de la obra destino de un viaje en curso → llegadaReal (si el chofer no la marcó).
 * - Se alejó de la base con un viaje programado para hoy → salidaReal (si el chofer no la marcó).
 */
export async function aplicarGeocercas(posiciones: PosicionCusat[]) {
  const eventos: string[] = [];
  const base = await db.ubicacion.findFirst({ where: { tipo: "BASE_VEHICULOS" } });

  for (const p of posiciones) {
    const aqui = { lat: p.latitud, lng: p.longitud };

    // Llegada
    const enCurso = await db.viaje.findFirst({
      where: { vehiculoId: p.vehiculoId, estado: "EN_CURSO", llegadaReal: null },
      include: { vehiculo: { select: { nombre: true } }, pedido: { select: { id: true, numero: true, obra: { select: { nombre: true, latitud: true, longitud: true, radioGeocercaM: true } } } } },
    });
    if (enCurso) {
      const o = enCurso.pedido.obra;
      if (distancia(aqui, { lat: o.latitud, lng: o.longitud }) <= o.radioGeocercaM) {
        const r = await db.viaje.updateMany({ where: { id: enCurso.id, llegadaReal: null }, data: { llegadaReal: p.fecha, llegadaDestinoEn: p.fecha } });
        if (r.count) {
          await auditar(db, {
            accion: "viaje.llegada.gps", entidad: "PedidoViaje", entidadId: enCurso.pedido.id,
            resumen: `GPS: ${enCurso.vehiculo.nombre} llegó a Obra ${o.nombre} (pedido #${enCurso.pedido.numero})`,
            despues: { llegadaReal: p.fecha.toISOString(), obra: o.nombre },
          });
          eventos.push(`Llegada por GPS a Obra ${o.nombre}`);
        }
      }
      continue;
    }

    // Salida: solo si está andando, lejos de la base, sin viaje en curso, y tiene un viaje programado para hoy.
    if (!base || p.velocidad < 5) continue;
    const vBase = await db.vehiculo.findUnique({ where: { id: p.vehiculoId }, select: { base: true, kmActual: true } });
    const b = vBase?.base ?? base;
    if (distancia(aqui, { lat: b.latitud, lng: b.longitud }) < SALIDA_DE_BASE_M) continue;
    const hace3h = new Date(Date.now() - 3 * 3_600_000);
    const en4h = new Date(Date.now() + 4 * 3_600_000);
    const programado = await db.viaje.findFirst({
      where: { vehiculoId: p.vehiculoId, estado: "PROGRAMADO", salidaReal: null, salidaEstimada: { gte: hace3h, lte: en4h }, pedido: { estado: "TOMADO" } },
      orderBy: [{ ordenRuta: { sort: "asc", nulls: "last" } }, { salidaEstimada: "asc" }],
    });
    if (!programado) continue;
    const choferOcupado = await db.viaje.count({ where: { choferId: programado.choferId, estado: "EN_CURSO" } });
    if (choferOcupado) continue;
    await db.$transaction(async (tx) => {
      const r = await tx.viaje.updateMany({
        where: { id: programado.id, estado: "PROGRAMADO" },
        data: { ...conEtapa("HACIA_RETIRO"), salidaReal: p.fecha, inicioEn: p.fecha, kmSalida: vBase?.kmActual ?? null, observaciones: "Salida registrada por GPS." },
      });
      if (!r.count) return;
      await tx.pedidoViaje.update({ where: { id: programado.pedidoId }, data: { estado: "EN_VIAJE" } });
      await alCambiarElViaje(tx, programado.pedidoId, "EN_VIAJE", null);
      await tx.vehiculo.update({ where: { id: p.vehiculoId }, data: { estado: "EN_VIAJE" } });
      const v = await tx.vehiculo.findUnique({ where: { id: p.vehiculoId }, select: { nombre: true } });
      await auditar(tx, {
        accion: "viaje.salida.gps", entidad: "PedidoViaje", entidadId: programado.pedidoId,
        resumen: `GPS: ${v?.nombre ?? "un vehículo"} salió de la base para ${await describirPedido(tx, programado.pedidoId)}`,
        despues: { salidaReal: p.fecha.toISOString() },
      });
      eventos.push("Salida por GPS");
    });
  }
  return eventos;
}
