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
  viaje: {
    select: {
      etapa: true, salidaEstimada: true, etaDestino: true, etaRetiro: true, llegadaReal: true, llegadaDestinoEn: true,
      chofer: { select: { nombre: true } }, vehiculo: { select: { nombre: true } },
    },
  },
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

export const PESTANAS_MIS_PEDIDOS = { pendientes: "Pendientes", aceptados: "Aceptados", entregados: "Entregados" } as const;
export type PestanaMisPedidos = keyof typeof PESTANAS_MIS_PEDIDOS;

const ESTADOS_PESTANA = { pendientes: ["PENDIENTE"], aceptados: ["TOMADO", "EN_VIAJE"], entregados: ["ENTREGADO"] } as const;

/** /mis-pedidos: solo los propios, por pestaña, con cuántos hay en cada una. */
export async function misPedidos(pestana: PestanaMisPedidos) {
  const u = await exigirPermiso("pedidos.crear");
  const propios = (p: PestanaMisPedidos): Prisma.PedidoViajeWhereInput =>
    conAlcance(u, { solicitanteId: u.id, estado: { in: [...ESTADOS_PESTANA[p]] }, ...(p === "entregados" ? { creadoEn: { gte: new Date(Date.now() - 30 * 86_400_000) } } : {}) });
  const [filas, ...conteos] = await Promise.all([
    db.pedidoViaje.findMany({ where: propios(pestana), select: fila, orderBy: pestana === "entregados" ? { actualizadoEn: "desc" } : { paraCuando: "asc" }, take: 100 }),
    ...(Object.keys(PESTANAS_MIS_PEDIDOS) as PestanaMisPedidos[]).map((p) => db.pedidoViaje.count({ where: propios(p) })),
  ]);
  const cuantos = Object.fromEntries((Object.keys(PESTANAS_MIS_PEDIDOS) as PestanaMisPedidos[]).map((p, k) => [p, conteos[k]])) as Record<PestanaMisPedidos, number>;
  return { filas: pestana === "aceptados" ? filas.sort(porEstado) : filas, cuantos };
}

/**
 * /viajes-en-curso: viajes ya aceptados que van a mis obras (nunca pendientes de otros).
 * En viaje primero, después aceptados por hora de salida, después lo entregado hoy.
 */
export async function viajesDeMisObras() {
  const u = await exigirPermiso("pedidos.ver");
  const filas = await db.pedidoViaje.findMany({
    where: conAlcance(u, {
      obra: filtroObras(u),
      OR: [{ estado: { in: ["TOMADO", "EN_VIAJE"] } }, { estado: "ENTREGADO", viaje: { llegadaReal: hoy() } }],
    }),
    select: fila,
    take: 100,
  });
  const salida = (f: FilaPedidoLista) => f.viaje?.salidaEstimada?.getTime() ?? f.paraCuando.getTime();
  return [
    ...filas.filter((f) => f.estado === "EN_VIAJE").sort((a, b) => (a.viaje?.etaDestino?.getTime() ?? 0) - (b.viaje?.etaDestino?.getTime() ?? 0)),
    ...filas.filter((f) => f.estado === "TOMADO").sort((a, b) => salida(a) - salida(b)),
    ...filas.filter((f) => f.estado === "ENTREGADO").sort((a, b) => (b.viaje?.llegadaReal?.getTime() ?? 0) - (a.viaje?.llegadaReal?.getTime() ?? 0)),
  ];
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
