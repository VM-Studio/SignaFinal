import "server-only";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { inicioDelDia } from "@/lib/formato";
import { viajesVisibles } from "@/lib/alcance";

export type Punto = { nombre: string; direccion: string; lat: number | null; lng: number | null };

/**
 * Enlace a Google Maps con coordenadas: sale de la base (o de donde esté el teléfono
 * si ya salió), pasa a retirar y termina en la obra.
 */
export function enlaceMaps(desde: Punto | null, retiro: Punto | null, destino: Punto) {
  const c = (p: Punto) => (p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : p.direccion);
  const q = new URLSearchParams({ api: "1", destination: c(destino), travelmode: "driving" });
  if (desde) q.set("origin", c(desde));
  if (retiro) q.set("waypoints", c(retiro));
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}

const include = {
  vehiculo: { select: { id: true, nombre: true, patente: true, kmActual: true, base: true } },
  pedido: {
    include: {
      obra: true,
      proveedor: true,
      solicitante: { select: { nombre: true } },
    },
  },
} as const;

/** El día del chofer: en curso, después programados por orden de salida, después lo terminado hoy. */
export async function misViajes() {
  const u = await exigirPermiso("viajes.verPropios");
  const [viajes, baseGeneral] = await Promise.all([
    db.viaje.findMany({
      where: {
        ...viajesVisibles(u),
        choferId: u.id,
        OR: [{ estado: { in: ["EN_CURSO", "PROGRAMADO"] }, pedido: { estado: { in: ["TOMADO", "EN_VIAJE"] } } }, { estado: "FINALIZADO", llegadaReal: { gte: inicioDelDia() } }],
      },
      include,
    }),
    db.ubicacion.findFirst({ where: { tipo: "BASE_VEHICULOS" } }),
  ]);

  // Origen de cada pedido (proveedor, obra, depósito o base).
  const idsObra = viajes.filter((v) => v.pedido.origenTipo === "OBRA").map((v) => v.pedido.origenId);
  const idsUbic = viajes.filter((v) => v.pedido.origenTipo === "BASE" || v.pedido.origenTipo === "DEPOSITO").map((v) => v.pedido.origenId);
  const [obras, ubic] = await Promise.all([
    db.obra.findMany({ where: { id: { in: idsObra } } }),
    db.ubicacion.findMany({ where: { id: { in: idsUbic } } }),
  ]);

  const orden = { EN_CURSO: 0, PROGRAMADO: 1, FINALIZADO: 2, CANCELADO: 3 } as const;
  return viajes
    .sort(
      (a, b) =>
        orden[a.estado] - orden[b.estado] ||
        (a.estado === "FINALIZADO"
          ? (b.llegadaReal?.getTime() ?? 0) - (a.llegadaReal?.getTime() ?? 0)
          : (a.ordenRuta ?? 999) - (b.ordenRuta ?? 999) || (a.salidaEstimada?.getTime() ?? 0) - (b.salidaEstimada?.getTime() ?? 0)),
    )
    .map((v) => {
      const p = v.pedido;
      const base = v.vehiculo.base ?? baseGeneral;
      const desde: Punto | null = base ? { nombre: base.nombre, direccion: base.direccion, lat: base.latitud, lng: base.longitud } : null;
      let retiro: Punto | null = null;
      if (p.proveedor) retiro = { nombre: p.proveedor.nombre, direccion: `${p.proveedor.direccion}, ${p.proveedor.localidad}`, lat: p.proveedor.latitud, lng: p.proveedor.longitud };
      else if (p.origenTipo === "OBRA") {
        const o = obras.find((x) => x.id === p.origenId);
        if (o && o.id !== p.obraId) retiro = { nombre: `Obra ${o.nombre}`, direccion: `${o.direccion}, ${o.localidad}`, lat: o.latitud, lng: o.longitud };
      } else {
        const x = ubic.find((y) => y.id === p.origenId);
        if (x && x.id !== base?.id) retiro = { nombre: x.nombre, direccion: x.direccion, lat: x.latitud, lng: x.longitud };
      }
      const destino: Punto = { nombre: `Obra ${p.obra.nombre}`, direccion: `${p.obra.direccion}, ${p.obra.localidad}`, lat: p.obra.latitud, lng: p.obra.longitud };
      return {
        viajeId: v.id,
        pedidoId: p.id,
        numero: p.numero,
        estado: v.estado as "EN_CURSO" | "PROGRAMADO" | "FINALIZADO",
        descripcion: p.descripcion,
        tipo: p.tipo,
        solicitante: p.solicitante.nombre,
        prioridad: p.prioridad,
        vehiculo: { nombre: v.vehiculo.nombre, patente: v.vehiculo.patente, kmActual: v.vehiculo.kmActual },
        salidaEstimada: v.salidaEstimada?.toISOString() ?? null,
        salidaReal: v.salidaReal?.toISOString() ?? null,
        llegadaReal: v.llegadaReal?.toISOString() ?? null,
        kmSalida: v.kmSalida,
        kmLlegada: v.kmLlegada,
        costo: v.costoCalculado == null ? null : Number(v.costoCalculado),
        desde,
        retiro,
        destino,
        maps: enlaceMaps(v.estado === "EN_CURSO" ? null : desde, retiro, destino),
      };
    });
}

export type ViajeDelDia = Awaited<ReturnType<typeof misViajes>>[number];

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

/** Para gestión: viajes de los últimos días con chofer, vehículo, km y costo. */
export async function viajesRecientes(dias = 7) {
  const u = await exigirPermiso("viajes.verTodos");
  const desde = new Date(inicioDelDia().getTime() - dias * 86_400_000);
  const viajes = await db.viaje.findMany({
    where: { AND: [viajesVisibles(u), { OR: [{ estado: { in: ["EN_CURSO", "PROGRAMADO"] } }, { estado: "FINALIZADO", llegadaReal: { gte: desde } }] }] },
    orderBy: [{ estado: "asc" }, { llegadaReal: { sort: "desc", nulls: "first" } }, { salidaEstimada: "asc" }],
    take: 150,
    include: { chofer: { select: { nombre: true } }, vehiculo: { select: { nombre: true } }, pedido: { select: { id: true, descripcion: true, obra: { select: { nombre: true } } } } },
  });
  return viajes.map((v) => ({
    id: v.id, pedidoId: v.pedido.id, estado: v.estado, descripcion: v.pedido.descripcion, obra: v.pedido.obra.nombre,
    chofer: v.chofer.nombre, vehiculo: v.vehiculo.nombre, salidaEstimada: v.salidaEstimada, salidaReal: v.salidaReal, llegadaReal: v.llegadaReal,
    km: v.kmLlegada != null && v.kmSalida != null ? v.kmLlegada - v.kmSalida : null,
    costo: v.costoCalculado == null ? null : Number(v.costoCalculado), remitoUrl: v.remitoUrl,
  }));
}
