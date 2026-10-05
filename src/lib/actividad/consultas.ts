import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { aFecha, inicioDelDia, inicioDelMes, sumarDias } from "@/lib/formato";

/** Tipos de acción para filtrar (por el prefijo de "accion"). */
export const TIPOS_ACCION = {
  pedidos: { titulo: "Pedidos", prefijos: ["pedido."] },
  viajes: { titulo: "Viajes", prefijos: ["viaje.", "ruta."] },
  herramientas: { titulo: "Herramientas", prefijos: ["herramienta.", "sobrante."] },
  flota: { titulo: "Flota", prefijos: ["vehiculo.", "combustible."] },
  sesiones: { titulo: "Sesiones y avisos", prefijos: ["sesion.", "push.", "alerta.", "avisos."] },
  otros: { titulo: "Costos y sistema", prefijos: ["costos.", "seed", "demo."] },
} as const;
export type TipoAccion = keyof typeof TIPOS_ACCION;

export type FiltrosActividad = { persona?: string; tipo?: TipoAccion; obra?: string; desde?: string; hasta?: string; q?: string; pagina?: number };

export const POR_PAGINA = 50;

async function donde(f: FiltrosActividad): Promise<Prisma.AuditoriaWhereInput> {
  const y: Prisma.AuditoriaWhereInput[] = [];
  if (f.persona) y.push({ usuarioId: f.persona });
  if (f.tipo && f.tipo in TIPOS_ACCION) y.push({ OR: TIPOS_ACCION[f.tipo].prefijos.map((p) => ({ accion: { startsWith: p } })) });
  if (f.obra) {
    const o = await db.obra.findUnique({ where: { id: f.obra }, select: { nombre: true } });
    if (o) y.push({ resumen: { contains: `Obra ${o.nombre}`, mode: "insensitive" } });
  }
  if (f.desde) y.push({ fecha: { gte: aFecha(f.desde) } });
  if (f.hasta) y.push({ fecha: { lt: aFecha(sumarDias(f.hasta, 1)) } });
  if (f.q) y.push({ resumen: { contains: f.q, mode: "insensitive" } });
  return y.length ? { AND: y } : {};
}

/** Actividad completa (Dirección): cada acción de cada usuario, lo último primero, de a 50. */
export async function actividad(f: FiltrosActividad) {
  await exigirPermiso("actividad.ver");
  const where = await donde(f);
  const pagina = Math.max(1, f.pagina ?? 1);
  const [filas, total] = await Promise.all([
    db.auditoria.findMany({
      where, orderBy: { fecha: "desc" }, skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA,
      select: { id: true, fecha: true, rol: true, accion: true, resumen: true, usuarioId: true, usuario: { select: { nombre: true } } },
    }),
    db.auditoria.count({ where }),
  ]);
  return { filas, total, pagina, paginas: Math.max(1, Math.ceil(total / POR_PAGINA)) };
}

/** Para el CSV: lo mismo, sin paginar (tope 10.000 filas). */
export async function actividadParaExportar(f: FiltrosActividad) {
  await exigirPermiso("actividad.ver");
  return db.auditoria.findMany({
    where: await donde(f), orderBy: { fecha: "desc" }, take: 10_000,
    select: { fecha: true, rol: true, accion: true, resumen: true, ip: true, usuario: { select: { nombre: true } } },
  });
}

export async function accionesDeHoy() {
  await exigirPermiso("actividad.ver");
  return db.auditoria.count({ where: { fecha: { gte: inicioDelDia() } } });
}

export async function opcionesFiltro() {
  await exigirPermiso("actividad.ver");
  const [personas, obras] = await Promise.all([
    db.usuario.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    db.obra.findMany({ where: { estado: { not: "FINALIZADA" } }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);
  return { personas, obras };
}

/** Ficha por persona: su mes (pedidos, viajes, km, herramientas que tiene). */
export async function resumenPersona(usuarioId: string) {
  await exigirPermiso("actividad.ver");
  const desde = inicioDelMes();
  const [u, pedidos, viajes, herramientas] = await Promise.all([
    db.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, nombre: true, rol: true, email: true, telefono: true, activo: true } }),
    db.pedidoViaje.count({ where: { solicitanteId: usuarioId, creadoEn: { gte: desde } } }),
    db.viaje.findMany({ where: { choferId: usuarioId, estado: "FINALIZADO", llegadaReal: { gte: desde } }, select: { kmSalida: true, kmLlegada: true } }),
    db.herramienta.findMany({ where: { responsableId: usuarioId, activo: true, estado: "EN_OBRA" }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, codigo: true, obra: { select: { nombre: true } } } }),
  ]);
  if (!u) return null;
  const km = viajes.reduce((a, v) => a + (v.kmLlegada != null && v.kmSalida != null ? v.kmLlegada - v.kmSalida : 0), 0);
  return { usuario: u, pedidos, viajes: viajes.length, km, herramientas };
}
