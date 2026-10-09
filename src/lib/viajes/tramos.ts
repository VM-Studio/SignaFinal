import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { calcularRuta, rutaEstimada, type Ruta } from "@/lib/rutas";
import { auditar } from "@/lib/auditoria";
import { notificar } from "@/lib/notificaciones";
import { TEXTO } from "@/lib/notificaciones/textos";
import { conEtapa } from "./etapas";
import { distancia, type Punto } from "@/lib/geo";

/** Lo que se tarda en cargar en el punto de retiro (para estimar la llegada a la obra). */
export const CARGA_S = 20 * 60;
/** El GPS da por salido del retiro cuando se aleja más que esto. */
export const SALIDA_RETIRO_M = 300;

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

const sumar = (d: Date, s: number) => new Date(d.getTime() + s * 1000);

/** Pasa el viaje de "cargando" a "en camino a la obra" (botón "Salgo" o el GPS al alejarse). */
export async function salirDelRetiro(cliente: Prisma.TransactionClient, viajeId: string, cuando: Date, porGps: boolean, usuarioId: string | null) {
  const v = await cliente.viaje.findUnique({ where: { id: viajeId }, include: { chofer: { select: { nombre: true } }, pedido: { select: { id: true, numero: true, origenNombre: true } } } });
  if (!v || v.etapa !== "EN_RETIRO") return false;
  await cliente.viaje.update({
    where: { id: viajeId },
    data: { ...conEtapa("HACIA_DESTINO"), salidaRetiroEn: cuando, etaDestino: v.duracionDestinoS ? sumar(cuando, v.duracionDestinoS) : v.etaDestino },
  });
  await auditar(cliente, {
    usuarioId, accion: porGps ? "viaje.salidaRetiro.gps" : "viaje.salidaRetiro", entidad: "PedidoViaje", entidadId: v.pedido.id,
    resumen: `${porGps ? "GPS: " : ""}${v.chofer.nombre} salió de ${v.pedido.origenNombre} hacia la obra (pedido #${v.pedido.numero})`,
  });
  return true;
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
  await notificar(v.pedido.solicitanteId, "GENERAL", {
    ...TEXTO.demora(v.chofer.nombre, nuevaEta),
    enlace: `/mis-pedidos/${v.pedido.id}`,
    datos: { pedidoId: v.pedido.id, eta: nuevaEta.toISOString(), demora: true },
  }, { copiaDireccion: true });
  return true;
}

/**
 * Una posición nueva del viaje (teléfono, Cusat o simulador): la guarda, pasa a "en camino" si se
 * alejó del retiro, recalcula la hora estimada del tramo y avisa si hay demora.
 */
export async function registrarPosicion(
  viajeId: string,
  aqui: Punto,
  o: { fuente: "TELEFONO" | "CUSAT" | "MOCK"; usuarioId?: string | null; precisionM?: number | null; velocidadKmh?: number; rumbo?: number },
) {
  const v = await db.viaje.findUnique({ where: { id: viajeId }, include: { pedido: true, chofer: { select: { nombre: true } } } });
  if (!v || !["HACIA_RETIRO", "EN_RETIRO", "HACIA_DESTINO"].includes(v.etapa)) return null;
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
  let etapa = v.etapa;
  // Se fue del punto de retiro sin tocar "Salgo": lo hace el GPS.
  if (etapa === "EN_RETIRO" && distancia(aqui, origenDe(v.pedido)) > SALIDA_RETIRO_M) {
    await db.$transaction((tx) => salirDelRetiro(tx, v.id, ahora, true, null));
    etapa = "HACIA_DESTINO";
  }
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
