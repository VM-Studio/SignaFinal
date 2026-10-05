import "server-only";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { viajesVisibles } from "@/lib/alcance";

/** Vehículos para cargar combustible y cuál preseleccionar (el del viaje en curso, si no el propio). */
export async function datosCarga() {
  const u = await exigirPermiso("combustible.cargar");
  const [vehiculos, enCurso, yo] = await Promise.all([
    db.vehiculo.findMany({ where: { activo: true }, orderBy: [{ tipo: "asc" }, { nombre: "asc" }], select: { id: true, nombre: true, patente: true, kmActual: true, asignadoAId: true } }),
    db.viaje.findFirst({ where: { ...viajesVisibles(u), choferId: u.id, estado: "EN_CURSO" }, select: { vehiculoId: true, pedido: { select: { obra: { select: { nombre: true } } } } } }),
    db.usuario.findUnique({ where: { id: u.id }, select: { vehiculoAsignadoId: true } }),
  ]);
  const preseleccion = enCurso?.vehiculoId ?? yo?.vehiculoAsignadoId ?? null;
  // Primero los suyos: el del viaje y el asignado.
  const propios = new Set([preseleccion, ...vehiculos.filter((v) => v.asignadoAId === u.id).map((v) => v.id)]);
  return {
    vehiculos: [...vehiculos.filter((v) => propios.has(v.id)), ...vehiculos.filter((v) => !propios.has(v.id))].map((v) => ({ id: v.id, nombre: v.nombre, detalle: v.patente, kmActual: v.kmActual })),
    preseleccion,
    obraEnViaje: enCurso && enCurso.vehiculoId === preseleccion ? enCurso.pedido.obra.nombre : null,
    vehiculoEnViaje: enCurso?.vehiculoId ?? null,
  };
}

export async function misCargas() {
  const u = await exigirPermiso("combustible.ver");
  const soloMias = u.rol === "CHOFER";
  const cargas = await db.cargaCombustible.findMany({
    where: soloMias ? { usuarioId: u.id } : {},
    orderBy: { fecha: "desc" },
    take: 30,
    include: { vehiculo: { select: { nombre: true } }, usuario: { select: { nombre: true } }, obra: { select: { nombre: true } } },
  });
  return cargas.map((c) => ({ ...c, litros: Number(c.litros), monto: Number(c.monto) }));
}

/** Dirección y gestión: todos los viajes de todos. "activos": en curso y aceptados; "terminados": historial, paginado. */
export async function viajesTodos(vista: "activos" | "terminados", pagina = 1, porPagina = 50) {
  const u = await exigirPermiso("viajes.verTodos");
  const where = { AND: [viajesVisibles(u), vista === "activos" ? { estado: { in: ["EN_CURSO", "PROGRAMADO"] as ("EN_CURSO" | "PROGRAMADO")[] } } : { estado: "FINALIZADO" as const }] };
  const [viajes, total] = await Promise.all([
    db.viaje.findMany({
      where,
      orderBy: vista === "activos" ? [{ estado: "asc" }, { salidaEstimada: "asc" }] : [{ llegadaReal: "desc" }],
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      select: {
        id: true, estado: true, etapa: true, salidaEstimada: true, salidaReal: true, llegadaReal: true, kmSalida: true, kmLlegada: true, costoCalculado: true, remitoUrl: true,
        chofer: { select: { nombre: true } }, vehiculo: { select: { nombre: true } }, pedido: { select: { id: true, descripcion: true, obra: { select: { nombre: true } } } },
      },
    }),
    db.viaje.count({ where }),
  ]);
  return {
    total, paginas: Math.max(1, Math.ceil(total / porPagina)),
    viajes: viajes.map((v) => ({
      id: v.id, pedidoId: v.pedido.id, estado: v.estado, etapa: v.etapa, descripcion: v.pedido.descripcion, obra: v.pedido.obra.nombre,
      chofer: v.chofer.nombre, vehiculo: v.vehiculo.nombre, salidaEstimada: v.salidaEstimada, salidaReal: v.salidaReal, llegadaReal: v.llegadaReal,
      km: v.kmLlegada != null && v.kmSalida != null ? v.kmLlegada - v.kmSalida : null,
      costo: v.costoCalculado == null ? null : Number(v.costoCalculado), remitoUrl: v.remitoUrl,
    })),
  };
}
