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
