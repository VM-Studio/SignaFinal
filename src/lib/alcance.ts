import "server-only";
import { cache } from "react";
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import type { UsuarioSesion } from "@/lib/auth/sesion";

type Cliente = Prisma.TransactionClient | PrismaClient;

/** Filtro de obras que le tocan a cada uno: el responsable, solo las suyas; el resto, todas. */
export function filtroObras(s: Pick<UsuarioSesion, "id" | "rol">): Prisma.ObraWhereInput {
  return s.rol === "RESPONSABLE_OBRA" ? { responsables: { some: { usuarioId: s.id } } } : {};
}

/**
 * Las obras del usuario: todas las activas para DIRECCION, CAPATAZ, CHOFER, DEPOSITO y
 * ADMINISTRACION; para RESPONSABLE_OBRA solo las asignadas. Una vez por request.
 * Toda query que filtre por obra pasa por acá.
 */
export const obrasDelUsuario = cache(async (s: UsuarioSesion, incluirInactivas = false) =>
  db.obra.findMany({
    where: { ...(incluirInactivas ? {} : { estado: "ACTIVA" }), ...filtroObras(s) },
    select: { id: true, nombre: true, estado: true },
    orderBy: { nombre: "asc" },
  }),
);

export async function idsObrasDelUsuario(s: UsuarioSesion, incluirInactivas = false) {
  return (await obrasDelUsuario(s, incluirInactivas)).map((o) => o.id);
}

/** ¿La obra es del usuario? (para RESPONSABLE_OBRA: está asignado; el resto, siempre). */
export async function esObraDelUsuario(s: UsuarioSesion, obraId: string) {
  if (s.rol !== "RESPONSABLE_OBRA") return true;
  return (await db.responsableObra.count({ where: { obraId, usuarioId: s.id } })) > 0;
}

/** El responsable principal de la obra (el primero asignado si ninguno está marcado). */
export async function responsablePrincipal(cliente: Cliente, obraId: string) {
  const r = await cliente.responsableObra.findFirst({
    where: { obraId },
    orderBy: [{ principal: "desc" }, { creadoEn: "asc" }],
    select: { usuario: { select: { id: true, nombre: true } } },
  });
  return r?.usuario ?? null;
}

const ACEPTADOS = ["TOMADO", "EN_VIAJE", "ENTREGADO"] as const;

/**
 * Qué pedidos ve cada rol. TODA query de pedidos pasa por acá.
 * - RESPONSABLE_OBRA / CAPATAZ: los propios en cualquier estado, más los de sus obras ya
 *   aceptados (TOMADO, EN_VIAJE, ENTREGADO). Nunca el PENDIENTE de otro.
 * - CHOFER: todos los PENDIENTE, más los suyos en cualquier estado.
 * - DEPOSITO: los traslados de maquinaria y herramientas.
 * - DIRECCION / ADMINISTRACION: todo.
 */
export function pedidosVisibles(s: Pick<UsuarioSesion, "id" | "rol">): Prisma.PedidoViajeWhereInput {
  switch (s.rol) {
    case "RESPONSABLE_OBRA":
    case "CAPATAZ":
      return { OR: [{ solicitanteId: s.id }, { obra: filtroObras(s), estado: { in: [...ACEPTADOS] } }] };
    case "CHOFER":
      return { OR: [{ estado: "PENDIENTE" }, { tomadoPorId: s.id }] };
    case "DEPOSITO":
      return { tipo: { in: ["TRASLADO_MAQUINARIA", "TRASLADO_HERRAMIENTAS"] } };
    case "DIRECCION":
    case "ADMINISTRACION":
      return {};
  }
}

/** Qué viajes ve cada rol: los de los pedidos que ve (el chofer, además, los suyos). */
export function viajesVisibles(s: Pick<UsuarioSesion, "id" | "rol">): Prisma.ViajeWhereInput {
  if (s.rol === "CHOFER") return { choferId: s.id };
  const p = pedidosVisibles(s);
  return Object.keys(p).length ? { pedido: p } : {};
}

/** Junta el alcance del rol con un filtro propio de la pantalla. */
export const conAlcance = (s: Pick<UsuarioSesion, "id" | "rol">, where: Prisma.PedidoViajeWhereInput = {}): Prisma.PedidoViajeWhereInput => ({
  AND: [pedidosVisibles(s), where],
});
