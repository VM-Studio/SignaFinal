import "server-only";
import { startOfMonth } from "date-fns";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";

/** Cada query verifica su permiso: no alcanza con esconder el botón. */

export async function pedidosPendientes() {
  await exigirPermiso("pedidos.ver");
  return db.pedidoViaje.count({ where: { estado: "PENDIENTE" } });
}

export async function miViajeEnCurso() {
  const u = await exigirPermiso("viajes.verPropios");
  return db.viaje.findFirst({
    where: { choferId: u.id, estado: "EN_CURSO" },
    select: {
      id: true, salidaReal: true, kmSalida: true,
      vehiculo: { select: { nombre: true } },
      pedido: { select: { numero: true, descripcion: true, obra: { select: { nombre: true } }, proveedor: { select: { nombre: true } } } },
    },
  });
}

export async function misPedidos() {
  const u = await exigirPermiso("pedidos.crear");
  return db.pedidoViaje.findMany({
    where: { solicitanteId: u.id, OR: [{ estado: { in: ["PENDIENTE", "TOMADO", "EN_VIAJE"] } }, { actualizadoEn: { gte: new Date(Date.now() - 3 * 86_400_000) } }] },
    orderBy: [{ creadoEn: "desc" }],
    take: 15,
    select: { id: true, numero: true, estado: true, descripcion: true, paraCuando: true, prioridad: true, obra: { select: { nombre: true } }, tomadoPor: { select: { nombre: true } } },
  });
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
  await exigirPermiso("mapa.ver");
  const [pendientes, enViaje, criticas] = await Promise.all([
    db.pedidoViaje.count({ where: { estado: "PENDIENTE" } }),
    db.vehiculo.count({ where: { activo: true, estado: "EN_VIAJE" } }),
    db.alerta.count({ where: { estado: { not: "RESUELTA" }, severidad: "CRITICA" } }),
  ]);
  return { pendientes, enViaje, criticas };
}

export async function vencimientosProximos(dias = 30) {
  await exigirPermiso("flota.documentacion");
  return db.documentoVehiculo.findMany({
    where: { vencimiento: { not: null, lte: new Date(Date.now() + dias * 86_400_000) }, vehiculo: { activo: true } },
    orderBy: { vencimiento: "asc" },
    select: { id: true, tipo: true, vencimiento: true, vehiculo: { select: { id: true, nombre: true } } },
  });
}

/** Costo de viajes del mes imputado a cada obra (Decimal → number antes de salir del servidor). */
export async function costoDelMesPorObra() {
  await exigirPermiso("costos.ver");
  const viajes = await db.viaje.findMany({
    where: { estado: "FINALIZADO", llegadaReal: { gte: startOfMonth(new Date()) } },
    select: { costoCalculado: true, pedido: { select: { obra: { select: { id: true, nombre: true } } } } },
  });
  const porObra = new Map<string, { obra: string; viajes: number; costo: number }>();
  for (const v of viajes) {
    const o = v.pedido.obra;
    const fila = porObra.get(o.id) ?? { obra: o.nombre, viajes: 0, costo: 0 };
    fila.viajes++;
    fila.costo += Number(v.costoCalculado ?? 0);
    porObra.set(o.id, fila);
  }
  return [...porObra.entries()].map(([id, f]) => ({ id, ...f })).sort((a, b) => b.costo - a.costo);
}
