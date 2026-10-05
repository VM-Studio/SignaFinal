import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { conAlcance, filtroObras } from "@/lib/alcance";
import { finDelDia, inicioDelDia } from "@/lib/formato";

/** Fila liviana para listas de pedidos (inicio, mis pedidos, viajes de mis obras, obra). */
const fila = {
  id: true, numero: true, estado: true, descripcion: true, paraCuando: true, prioridad: true, creadoEn: true,
  origenNombre: true, destinoNombre: true,
  obra: { select: { id: true, nombre: true } },
  solicitante: { select: { nombre: true } },
  tomadoPor: { select: { nombre: true } },
  viaje: { select: { etapa: true, etaDestino: true, etaRetiro: true, llegadaReal: true, vehiculo: { select: { nombre: true } } } },
} satisfies Prisma.PedidoViajeSelect;

export type FilaPedidoLista = Prisma.PedidoViajeGetPayload<{ select: typeof fila }>;

const ORDEN_ESTADO = { EN_VIAJE: 0, TOMADO: 1, PENDIENTE: 2, ENTREGADO: 3, CANCELADO: 4 } as const;
const porEstado = (a: FilaPedidoLista, b: FilaPedidoLista) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || a.paraCuando.getTime() - b.paraCuando.getTime();

const ACTIVOS = ["PENDIENTE", "TOMADO", "EN_VIAJE"] as const;
const hoy = () => ({ gte: inicioDelDia(), lte: finDelDia() });

/** Inicio de obra: mis pedidos de hoy (los activos para hoy o antes, y lo entregado hoy). Máximo 5. */
export async function misPedidosDeHoy() {
  const u = await exigirPermiso("pedidos.crear");
  const filas = await db.pedidoViaje.findMany({
    where: conAlcance(u, {
      solicitanteId: u.id,
      OR: [{ estado: { in: [...ACTIVOS] }, paraCuando: { lte: finDelDia() } }, { estado: "ENTREGADO", viaje: { llegadaReal: hoy() } }],
    }),
    select: fila,
    take: 20,
  });
  return filas.sort(porEstado).slice(0, 5);
}

/** Inicio de obra: viajes ya aceptados que van hoy a mis obras (de cualquiera que los haya pedido). */
export async function viajesAMisObrasHoy() {
  const u = await exigirPermiso("pedidos.ver");
  const filas = await db.pedidoViaje.findMany({
    where: conAlcance(u, {
      obra: filtroObras(u),
      OR: [{ estado: { in: ["TOMADO", "EN_VIAJE"] }, paraCuando: { lte: finDelDia() } }, { estado: "ENTREGADO", viaje: { llegadaReal: hoy() } }],
    }),
    select: fila,
    take: 30,
  });
  return filas.sort(porEstado);
}

/** /mis-pedidos: todo lo que pedí, lo activo primero y después lo último terminado. */
export async function misPedidos() {
  const u = await exigirPermiso("pedidos.crear");
  const filas = await db.pedidoViaje.findMany({ where: conAlcance(u, { solicitanteId: u.id }), select: fila, orderBy: { creadoEn: "desc" }, take: 100 });
  return {
    activos: filas.filter((f) => (ACTIVOS as readonly string[]).includes(f.estado)).sort(porEstado),
    terminados: filas.filter((f) => !(ACTIVOS as readonly string[]).includes(f.estado)).slice(0, 30),
  };
}

/** /viajes-en-curso: viajes aceptados que van a mis obras, y lo entregado en los últimos 2 días. */
export async function viajesDeMisObras() {
  const u = await exigirPermiso("pedidos.ver");
  const filas = await db.pedidoViaje.findMany({
    where: conAlcance(u, {
      obra: filtroObras(u),
      OR: [{ estado: { in: ["TOMADO", "EN_VIAJE"] } }, { estado: "ENTREGADO", viaje: { llegadaReal: { gte: new Date(Date.now() - 2 * 86_400_000) } } }],
    }),
    select: fila,
    take: 100,
  });
  return { enCurso: filas.filter((f) => f.estado !== "ENTREGADO").sort(porEstado), entregados: filas.filter((f) => f.estado === "ENTREGADO") };
}

/** Ficha de obra: los pedidos de esa obra que el usuario puede ver. */
export async function pedidosDeObra(obraId: string) {
  const u = await exigirPermiso("pedidos.ver");
  return db.pedidoViaje.findMany({
    where: conAlcance(u, { obraId, OR: [{ estado: { in: [...ACTIVOS] } }, { creadoEn: { gte: new Date(Date.now() - 7 * 86_400_000) } }] }),
    select: fila,
    orderBy: { creadoEn: "desc" },
    take: 30,
  });
}
