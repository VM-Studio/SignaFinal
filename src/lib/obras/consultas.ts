import "server-only";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { conAlcance, filtroObras } from "@/lib/alcance";

const responsables = { select: { principal: true, usuario: { select: { nombre: true } } }, orderBy: [{ principal: "desc" as const }, { creadoEn: "asc" as const }] };

/** Las obras del usuario (las suyas si es responsable), con sus responsables y lo que tienen en curso. */
export async function listaObras() {
  const u = await exigirPermiso("obras.ver");
  const obras = await db.obra.findMany({
    where: { estado: { not: "FINALIZADA" }, ...filtroObras(u) },
    orderBy: [{ estado: "asc" }, { nombre: "asc" }],
    select: { id: true, nombre: true, direccion: true, localidad: true, estado: true, responsables },
  });
  const activos = await db.pedidoViaje.groupBy({
    by: ["obraId"],
    where: conAlcance(u, { obraId: { in: obras.map((o) => o.id) }, estado: { in: ["PENDIENTE", "TOMADO", "EN_VIAJE"] } }),
    _count: { _all: true },
  });
  const porObra = new Map(activos.map((a) => [a.obraId, a._count._all]));
  return obras.map((o) => ({ ...o, enCurso: porObra.get(o.id) ?? 0 }));
}

/** Ficha de obra: datos, responsables y herramientas del depósito que están ahí. Null si no es del usuario. */
export async function fichaObra(id: string) {
  const u = await exigirPermiso("obras.ver");
  return db.obra.findFirst({
    where: { id, ...filtroObras(u) },
    select: {
      id: true, nombre: true, codigo: true, direccion: true, localidad: true, estado: true, latitud: true, longitud: true, responsables,
      herramientas: { where: { activo: true, estado: "EN_OBRA" }, orderBy: { nombre: "asc" }, select: { id: true, codigo: true, nombre: true, devolucionPrevista: true } },
      existencias: { where: { cantidad: { gt: 0 } }, select: { id: true, cantidad: true, herramienta: { select: { id: true, nombre: true } } } },
    },
  });
}
