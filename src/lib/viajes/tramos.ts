import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { calcularRuta, rutaEstimada, type Ruta } from "@/lib/rutas";
import { baseViaje, notificarEvento } from "@/lib/notificaciones/enviar";
import { EVENTO } from "@/lib/notificaciones/eventos";
import type { Punto } from "@/lib/geo";

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
export async function rutaSegura(desde: Punto, hasta: Punto): Promise<Ruta> {
  try {
    return await calcularRuta(desde, hasta);
  } catch {
    return rutaEstimada(desde, hasta);
  }
}


// ─────────────────────── Posición, hora estimada y demora ───────────────────────

const DEMORA_AVISO_MS = 15 * 60_000;

type ViajeConPedido = Prisma.ViajeGetPayload<{ include: { pedido: true; chofer: { select: { nombre: true } } } }>;

/**
 * La hora estimada que ya le dijimos al que pidió (la del último aviso del viaje). Si la nueva se
 * corre más de 15 minutos, se le avisa UNA vez: "Claudio viene con demora, ahora llega 10:05 aprox".
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

/** Recalcula la hora estimada del tramo desde una posición (y avisa si se corrió más de 15 min). */
export async function recalcularEta(v: ViajeConPedido, aqui: Punto, ahora = new Date()) {
  let eta: Date | null = null;
  if (v.etapa === "HACIA_RETIRO") {
    const [aRetiro, aDestino] = await Promise.all([rutaSegura(aqui, origenDe(v.pedido)), rutaSegura(origenDe(v.pedido), destinoDe(v.pedido))]);
    eta = new Date(ahora.getTime() + aRetiro.duracionS * 1000);
    const etaDestino = new Date(eta.getTime() + (CARGA_S + aDestino.duracionS) * 1000);
    await db.viaje.update({ where: { id: v.id }, data: { etaRetiro: eta, etaDestino } });
    await avisarSiHayDemora(v, etaDestino);
  } else if (v.etapa === "HACIA_DESTINO") {
    const aDestino = await rutaSegura(aqui, destinoDe(v.pedido));
    eta = new Date(ahora.getTime() + aDestino.duracionS * 1000);
    await db.viaje.update({ where: { id: v.id }, data: { etaDestino: eta } });
    await avisarSiHayDemora(v, eta);
  }
  return eta;
}
