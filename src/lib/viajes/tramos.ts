import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { calcularRuta, hayTransito, llegadaCon, rutaEstimada, type Ruta } from "@/lib/rutas";
import { baseViaje, notificarEvento } from "@/lib/notificaciones/enviar";
import { EVENTO } from "@/lib/notificaciones/eventos";
import type { Punto } from "@/lib/geo";

/** Con Google, la hora estimada se recalcula como mucho cada 5 minutos por viaje. */
const RECALCULAR_ETA_MS = 5 * 60_000;

/** Lo que se tarda en cargar en el punto de retiro (para estimar la llegada a la obra). */
export const CARGA_S = 20 * 60;

export const origenDe = (p: { origenLat: number; origenLng: number }): Punto => ({ lat: p.origenLat, lng: p.origenLng });
export const destinoDe = (p: { destinoLat: number; destinoLng: number }): Punto => ({ lat: p.destinoLat, lng: p.destinoLng });

/** De dónde sale el vehículo si no hay GPS: su base, o la base general. */
export async function baseDe(vehiculo: { baseId: string | null }): Promise<Punto | null> {
  const b = vehiculo.baseId ? await db.ubicacion.findUnique({ where: { id: vehiculo.baseId } }) : await db.ubicacion.findFirst({ where: { tipo: "BASE_VEHICULOS" } });
  return b ? { lat: b.latitud, lng: b.longitud } : null;
}

/** Ruta sin que nada la pueda trabar: si el ruteo falla, la estimada. */
export async function rutaSegura(desde: Punto, hasta: Punto, o: { transito?: boolean } = {}): Promise<Ruta> {
  try {
    return await calcularRuta(desde, hasta, o);
  } catch {
    return rutaEstimada(desde, hasta);
  }
}


// ─────────────────────── Posición, hora estimada y demora ───────────────────────

const DEMORA_AVISO_MS = 15 * 60_000;

type ViajeConPedido = Prisma.ViajeGetPayload<{ include: { pedido: true; chofer: { select: { nombre: true } } } }>;

/**
 * La hora estimada que ya le dijimos al que pidió (la del último aviso del viaje). Si la nueva se
 * corre más de 15 minutos, se le avisa UNA vez: "Claudio viene con demora, ahora llega 10:05". Solo con tránsito real (Google).
 */
export async function avisarSiHayDemora(v: ViajeConPedido, nuevaEta: Date) {
  const avisos = await db.notificacion.findMany({
    where: { usuarioId: v.pedido.solicitanteId, datos: { path: ["pedidoId"], equals: v.pedido.id } },
    orderBy: { creadaEn: "desc" },
    select: { datos: true },
    take: 10,
  });
  if (avisos.some((a) => (a.datos as { demora?: boolean } | null)?.demora)) return false;
  const dicho = avisos.map((a) => (a.datos as { eta?: string } | null)?.eta).find(Boolean);
  if (!dicho || nuevaEta.getTime() - new Date(dicho).getTime() <= DEMORA_AVISO_MS) return false;
  await notificarEvento(EVENTO.viajeDemora({ ...(await baseViaje(db, v.pedido.id, v.chofer.nombre)), eta: nuevaEta }));
  return true;
}

/**
 * Una posición nueva del viaje (teléfono, Cusat o simulador): la guarda, pasa a "en camino" si se
 * alejó del retiro, recalcula la hora estimada del tramo y avisa si hay demora.
 */
export async function registrarPosicion(
  viajeId: string,
  aqui: Punto,
  o: { fuente: "TELEFONO" | "CUSAT" | "MOCK"; usuarioId?: string | null; precisionM?: number | null; velocidadKmh?: number; rumbo?: number; demo?: boolean },
) {
  const v = await db.viaje.findUnique({ where: { id: viajeId }, include: { pedido: true, chofer: { select: { nombre: true } } } });
  if (!v || !["HACIA_RETIRO", "EN_RETIRO", "HACIA_DESTINO", "EN_DESTINO"].includes(v.etapa)) return null;
  const ahora = new Date();
  await db.posicionVehiculo.create({
    data: {
      vehiculoId: v.vehiculoId, viajeId: v.id, usuarioId: o.usuarioId ?? null, fuente: o.fuente, latitud: aqui.lat, longitud: aqui.lng,
      precisionM: o.precisionM ?? null, velocidad: o.velocidadKmh ?? 0, rumbo: o.rumbo ?? 0, motorEncendido: true, fecha: ahora,
    },
  });
  // El mapa lee la última posición del vehículo. Cusat manda: el teléfono la pisa solo si Cusat no reportó en 2 minutos.
  if (o.fuente === "TELEFONO") {
    await db.vehiculo.updateMany({
      where: { id: v.vehiculoId, OR: [{ ultimaFechaGps: null }, { ultimaFechaGps: { lt: new Date(ahora.getTime() - 120_000) } }] },
      data: { ultimaLat: aqui.lat, ultimaLng: aqui.lng, ultimaFechaGps: ahora, ultimaVelocidad: o.velocidadKmh ?? 0, ultimaDireccionTexto: null },
    });
  }
  // El motor de viajes decide si llegó, salió o llegó a la obra (y le avisa al que pidió).
  const { evaluarViaje } = await import("./motor");
  const m = await evaluarViaje(v.id, { ...aqui, velocidadKmh: o.velocidadKmh ?? 0, fecha: ahora, fuente: o.fuente, demo: o.demo });
  const etapa = m.transicion ? (await db.viaje.findUniqueOrThrow({ where: { id: v.id }, select: { etapa: true } })).etapa : v.etapa;
  const eta = await recalcularEta({ ...v, etapa }, aqui, ahora);
  return { etapa, eta, cambioDeEtapa: etapa !== v.etapa };
}

/**
 * Recalcula la hora estimada del tramo desde una posición (y avisa si se corrió más de 15 min).
 * Solo con tránsito real (Google): sin eso la hora queda vacía y la app muestra solo distancia.
 */
export async function recalcularEta(v: ViajeConPedido, aqui: Punto, ahora = new Date()) {
  // Sin tránsito no hay hora que calcular. Con Google, como mucho cada 5 minutos por viaje (costo: docs/rutas.md).
  if (!hayTransito()) return null;
  // Se "toma el turno" de forma atómica (merge en el JSON del motor, sin pisar lo que escribió el motor).
  const limite = new Date(ahora.getTime() - RECALCULAR_ETA_MS).toISOString();
  const tomado = await db.$executeRaw`
    UPDATE "Viaje" SET "motor" = COALESCE("motor", '{}'::jsonb) || jsonb_build_object('etaEn', ${ahora.toISOString()}::text)
    WHERE "id" = ${v.id} AND (("motor"->>'etaEn') IS NULL OR ("motor"->>'etaEn') < ${limite})`;
  if (!tomado) return v.etapa === "HACIA_RETIRO" ? v.etaRetiro : v.etaDestino;
  // Hora de llegada a la PARADA ACTUAL (la primera que falta), si va en camino.
  const paradas = await db.viajeParada.findMany({ where: { viajeId: v.id }, orderBy: { orden: "asc" }, select: { tipo: true, estado: true, latitud: true, longitud: true } });
  const actual = paradas.find((p) => p.estado !== "COMPLETADA" && p.estado !== "SALTEADA");
  if (!actual || actual.estado === "LLEGO") return null;
  const ruta = await rutaSegura(aqui, { lat: actual.latitud, lng: actual.longitud });
  const eta = llegadaCon(ruta, ahora);
  await db.viaje.update({ where: { id: v.id }, data: actual.tipo === "RETIRO" ? { etaRetiro: eta } : { etaDestino: eta } });
  // Demora: solo en viajes de un pedido (con varias paradas cada uno recibe el aviso de su parada).
  const varios = paradas.filter((p) => p.tipo === "ENTREGA").length > 1 || paradas.filter((p) => p.tipo === "RETIRO").length > 1;
  if (eta && actual.tipo === "ENTREGA" && !varios) await avisarSiHayDemora(v, eta);
  return eta;
}
