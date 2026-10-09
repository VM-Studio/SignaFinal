import "server-only";
import type { EtapaViaje, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { conAlcance, viajesVisibles } from "@/lib/alcance";
import { finDelDia, inicioDelDia } from "@/lib/formato";
import { vehiculosParaTomar } from "@/lib/pedidos/consultas";
import { ETAPAS_EN_CURSO } from "./etapas";
import { baseDe, destinoDe, origenDe, rutaSegura } from "./tramos";
import type { Punto } from "@/lib/geo";

/** Lo que muestra cada tarjeta del chofer, en el orden en que se lee. */
export type Tarjeta = {
  pedidoId: string;
  numero: number;
  /** Salida estimada si ya lo aceptó; si no, para cuándo lo necesitan. */
  fecha: Date;
  retirar: { nombre: string; direccion: string };
  entregar: { nombre: string; direccion: string };
  que: string;
  pidio: string;
  pesoKg: number | null;
  necesitaCamion: boolean;
  urgente: boolean;
  vehiculo: string | null;
  etapa: EtapaViaje | null;
  km: number | null;
  kmActual: number;
  kmSalida: number | null;
  /** Retiro de material habilitado por Compras: horario, contacto y OC, bien visibles. */
  retiro: { horario: string | null; contacto: string | null; oc: string | null } | null;
};

const seleccion = {
  id: true, numero: true, descripcion: true, paraCuando: true, pesoKg: true, necesitaCamion: true, prioridad: true,
  origenNombre: true, origenDireccion: true, destinoNombre: true, destinoDireccion: true, esRetiroMaterial: true, ordenCompraLebane: true,
  materialesListos: { where: { estado: { not: "CANCELADO" } }, select: { descripcion: true, horarioRetiro: true, contactoRetiro: true, ordenCompraNumero: true } },
  solicitante: { select: { nombre: true } },
  viaje: { select: { etapa: true, estado: true, salidaEstimada: true, kmSalida: true, kmLlegada: true, llegadaReal: true, vehiculo: { select: { nombre: true, kmActual: true } } } },
} satisfies Prisma.PedidoViajeSelect;

const juntar = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].join(" / ") || null;

function tarjeta(p: Prisma.PedidoViajeGetPayload<{ select: typeof seleccion }>): Tarjeta {
  const v = p.viaje && p.viaje.estado !== "CANCELADO" ? p.viaje : null;
  const ml = p.esRetiroMaterial ? p.materialesListos : [];
  return {
    pedidoId: p.id, numero: p.numero,
    fecha: v?.etapa === "FINALIZADO" && v.llegadaReal ? v.llegadaReal : v?.salidaEstimada ?? p.paraCuando,
    retirar: { nombre: p.origenNombre, direccion: p.origenDireccion },
    entregar: { nombre: p.destinoNombre, direccion: p.destinoDireccion },
    que: ml.length ? ml.map((m) => m.descripcion).join(" + ") : p.descripcion, pidio: p.solicitante.nombre, pesoKg: p.pesoKg, necesitaCamion: p.necesitaCamion, urgente: p.prioridad === "URGENTE",
    vehiculo: v?.vehiculo.nombre ?? null, etapa: v?.etapa ?? null,
    km: v?.kmLlegada != null && v.kmSalida != null ? v.kmLlegada - v.kmSalida : null,
    kmActual: v?.vehiculo.kmActual ?? 0,
    kmSalida: v?.kmSalida ?? null,
    retiro: p.esRetiroMaterial
      ? { horario: juntar(ml.map((m) => m.horarioRetiro)), contacto: juntar(ml.map((m) => m.contactoRetiro)), oc: juntar(ml.map((m) => m.ordenCompraNumero?.replace(/^\s*(OC)?\s*#?\s*/i, "") ?? null)) ?? p.ordenCompraLebane }
      : null,
  };
}

const ordenSalida = (a: Tarjeta, b: Tarjeta) => a.fecha.getTime() - b.fecha.getTime();

/**
 * Los viajes del chofer. "hoy": el que está en curso primero, después los aceptados para hoy por
 * hora de salida. "proximos": aceptados para después de hoy. "todos": historial con buscador por obra.
 */
export async function viajesDelChofer(vista: "hoy" | "proximos" | "todos", f: { q?: string; pagina?: number } = {}) {
  const u = await exigirPermiso("viajes.verPropios");
  const mios = { tomadoPorId: u.id, viaje: { choferId: u.id } } satisfies Prisma.PedidoViajeWhereInput;
  if (vista === "todos") {
    const pagina = Math.max(1, f.pagina ?? 1);
    const where = conAlcance(u, { ...mios, ...(f.q ? { destinoNombre: { contains: f.q, mode: "insensitive" } } : {}) });
    const [filas, total] = await Promise.all([
      db.pedidoViaje.findMany({ where, select: seleccion, orderBy: { paraCuando: "desc" }, skip: (pagina - 1) * 20, take: 20 }),
      db.pedidoViaje.count({ where }),
    ]);
    return { tarjetas: filas.map(tarjeta), total, paginas: Math.max(1, Math.ceil(total / 20)) };
  }
  // El día del viaje es el de la salida estimada; si no tiene, el de cuándo lo necesitan.
  const fin = finDelDia();
  const paraHoy: Prisma.PedidoViajeWhereInput = { OR: [{ viaje: { salidaEstimada: { lte: fin } } }, { viaje: { salidaEstimada: null }, paraCuando: { lte: fin } }] };
  const despues: Prisma.PedidoViajeWhereInput = { OR: [{ viaje: { salidaEstimada: { gt: fin } } }, { viaje: { salidaEstimada: null }, paraCuando: { gt: fin } }] };
  const where =
    vista === "hoy"
      ? conAlcance(u, { ...mios, OR: [{ estado: "EN_VIAJE" }, { estado: "TOMADO", ...paraHoy }] })
      : conAlcance(u, { ...mios, estado: "TOMADO", ...despues });
  const tarjetas = (await db.pedidoViaje.findMany({ where, select: seleccion, take: 100 })).map(tarjeta);
  const enCurso = tarjetas.filter((t) => t.etapa && ETAPAS_EN_CURSO.includes(t.etapa));
  return { tarjetas: [...enCurso, ...tarjetas.filter((t) => !enCurso.includes(t)).sort(ordenSalida)], total: tarjetas.length, paginas: 1 };
}

export const FILTROS_SOLICITUDES = { todas: "Todas", hoy: "Hoy", camion: "Necesitan camión" } as const;
export type FiltroSolicitudes = keyof typeof FILTROS_SOLICITUDES;

/** Solicitudes pendientes de cualquiera: urgentes primero, después por fecha necesaria. Con los vehículos para aceptar. */
export async function solicitudesPendientes(filtro: FiltroSolicitudes, limite = 50) {
  const u = await exigirPermiso("pedidos.tomar");
  const extra: Prisma.PedidoViajeWhereInput = filtro === "hoy" ? { paraCuando: { lte: finDelDia() } } : filtro === "camion" ? { necesitaCamion: true } : {};
  const filas = await db.pedidoViaje.findMany({
    where: conAlcance(u, { estado: "PENDIENTE", ...extra }),
    select: seleccion,
    orderBy: [{ prioridad: "desc" }, { fechaNecesaria: { sort: "asc", nulls: "last" } }, { paraCuando: "asc" }, { creadoEn: "asc" }],
    take: limite + 1,
  });
  const pagina = filas.slice(0, limite);
  const vehiculos = await Promise.all(pagina.map((p) => vehiculosParaTomar(p)));
  return { lista: pagina.map((p, i) => ({ ...tarjeta(p), vehiculos: vehiculos[i] })), hayMas: filas.length > limite };
}

/** La última solicitud nueva (para el indicador de la barra del chofer). */
export async function ultimaSolicitud() {
  const u = await exigirPermiso("pedidos.tomar");
  const p = await db.pedidoViaje.findFirst({ where: conAlcance(u, { estado: "PENDIENTE" }), orderBy: { creadoEn: "desc" }, select: { creadoEn: true } });
  // Nunca en el futuro (datos cargados a mano con hora adelantada no deben dejar el indicador prendido).
  return p ? new Date(Math.min(p.creadoEn.getTime(), Date.now())) : null;
}

export async function tengoViajeEnCurso() {
  const u = await exigirPermiso("viajes.verPropios");
  return (await db.viaje.count({ where: { ...viajesVisibles(u), choferId: u.id, etapa: { in: ETAPAS_EN_CURSO } } })) > 0;
}

/**
 * La pantalla del viaje: a dónde va ahora (tramo), por dónde y cuánto falta.
 * Tramo al retiro hasta llegar a cargar; después, a la obra. Null si el viaje no es del chofer.
 */
export async function pantallaViaje(pedidoId: string) {
  const u = await exigirPermiso("viajes.ejecutar");
  const p = await db.pedidoViaje.findFirst({
    where: conAlcance(u, { id: pedidoId, tomadoPorId: u.id }),
    include: {
      solicitante: { select: { nombre: true } },
      materialesListos: { where: { estado: { not: "CANCELADO" } }, select: { descripcion: true, horarioRetiro: true, contactoRetiro: true, ordenCompraNumero: true } },
      viaje: {
        include: {
          vehiculo: { select: { nombre: true, patente: true, kmActual: true, baseId: true } },
          posiciones: { where: { fuente: "TELEFONO" }, orderBy: { fecha: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!p?.viaje || p.viaje.choferId !== u.id || p.viaje.estado === "CANCELADO") return null;
  const v = p.viaje;
  const ultima: Punto | null = v.posiciones[0] ? { lat: v.posiciones[0].latitud, lng: v.posiciones[0].longitud } : null;
  const aRetiro = v.etapa === "PROGRAMADO" || v.etapa === "HACIA_RETIRO";
  const hasta = aRetiro ? origenDe(p) : destinoDe(p);
  const desde = aRetiro ? (v.etapa === "HACIA_RETIRO" ? ultima : null) ?? (await baseDe(v.vehiculo)) ?? origenDe(p) : v.etapa === "HACIA_DESTINO" && ultima ? ultima : origenDe(p);
  const ruta = v.etapa === "FINALIZADO" ? null : await rutaSegura(desde, hasta);
  const enCursoOtro = v.etapa === "PROGRAMADO" ? await db.viaje.count({ where: { choferId: u.id, etapa: { in: ETAPAS_EN_CURSO } } }) : 0;
  const siguiente =
    v.etapa === "FINALIZADO"
      ? await db.pedidoViaje.findFirst({
          where: conAlcance(u, { tomadoPorId: u.id, estado: "TOMADO", OR: [{ viaje: { salidaEstimada: { lte: finDelDia() } } }, { paraCuando: { lte: finDelDia() } }] }),
          orderBy: [{ viaje: { ordenRuta: { sort: "asc", nulls: "last" } } }, { paraCuando: "asc" }],
          select: seleccion,
        })
      : null;
  return {
    pedidoId: p.id, numero: p.numero, pidio: p.solicitante.nombre, pesoKg: p.pesoKg,
    que: p.esRetiroMaterial && p.materialesListos.length ? p.materialesListos.map((m) => m.descripcion).join(" + ") : p.descripcion,
    retiro: p.esRetiroMaterial
      ? { horario: juntar(p.materialesListos.map((m) => m.horarioRetiro)), contacto: juntar(p.materialesListos.map((m) => m.contactoRetiro)), oc: juntar(p.materialesListos.map((m) => m.ordenCompraNumero?.replace(/^\s*(OC)?\s*#?\s*/i, "") ?? null)) ?? p.ordenCompraLebane }
      : null,
    etapa: v.etapa, vehiculo: v.vehiculo.nombre, patente: v.vehiculo.patente, kmActual: v.vehiculo.kmActual, kmSalida: v.kmSalida,
    salidaEstimada: v.salidaEstimada, etaRetiro: v.etaRetiro, etaDestino: v.etaDestino,
    retirar: { nombre: p.origenNombre, direccion: p.origenDireccion, ...origenDe(p) },
    entregar: { nombre: p.destinoNombre, direccion: p.destinoDireccion, ...destinoDe(p) },
    tramo: ruta && { hacia: aRetiro ? "retiro" as const : "destino" as const, desde, hasta, distanciaM: ruta.distanciaM, duracionS: ruta.duracionS, geometria: ruta.geometria, estimada: ruta.fuente === "estimada" },
    otroEnCurso: enCursoOtro > 0,
    kmRecorridos: v.kmLlegada != null && v.kmSalida != null ? v.kmLlegada - v.kmSalida : null,
    siguiente: siguiente ? tarjeta(siguiente) : null,
    hoy: inicioDelDia().toISOString(),
  };
}

export type PantallaViaje = NonNullable<Awaited<ReturnType<typeof pantallaViaje>>>;
