import "server-only";
import type { EtapaViaje, FuentePosicion, Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { auditar } from "@/lib/auditoria";
import { baseViaje, notificarEvento } from "@/lib/notificaciones/enviar";
import { EVENTO } from "@/lib/notificaciones/eventos";
import { distancia, type Punto } from "@/lib/geo";
import { conEtapa } from "./etapas";
import { sincronizarParadas } from "./paradas";
import { CARGA_S, destinoDe, origenDe, rutaSegura } from "./tramos";
import { decidir, type EstadoMotor, type Llegada, type Transicion } from "./motor-reglas";
import { PARAMETROS_MOTOR as P } from "./parametros";

type Cliente = Prisma.TransactionClient | PrismaClient;

/**
 * MOTOR DE VIAJES. El chofer toca "Iniciar viaje" y "Viaje terminado"; lo del medio (llegó al retiro,
 * salió, llegó a la obra) lo detecta el motor con cada posición nueva del vehículo (Cusat primero,
 * teléfono de respaldo). Las reglas están en motor-reglas.ts y los parámetros en parametros.ts.
 * Los botones manuales del chofer hacen exactamente la misma transición (transicionar).
 */

const incluir = {
  pedido: { include: { obra: { select: { nombre: true, radioGeocercaM: true } } } },
  chofer: { select: { nombre: true } },
  vehiculo: { select: { nombre: true } },
} satisfies Prisma.ViajeInclude;
type ViajeMotor = Prisma.ViajeGetPayload<{ include: typeof incluir }>;

export const estadoMotor = (v: { motor: Prisma.JsonValue | null }) => (v.motor ?? {}) as EstadoMotor;
const json = (e: EstadoMotor) => e as Prisma.InputJsonValue;

/** El viaje no tiene punto de retiro distinto de donde arranca (lo que lleva ya está arriba): va directo a la obra. */
export function sinRetiro(pedido: { origenTipo: string; origenLat: number; origenLng: number }, desde: Punto | null) {
  if (pedido.origenTipo === "BASE") return true;
  return !!desde && distancia(desde, origenDe(pedido)) <= P.mismoLugarM;
}

/** Radio de llegada al retiro: el de la geocerca si el retiro es una obra; si no, 150 m. */
async function radioRetiro(v: ViajeMotor) {
  if (v.pedido.origenTipo !== "OBRA") return P.radioLlegadaM;
  const o = await db.obra.findUnique({ where: { id: v.pedido.origenId }, select: { radioGeocercaM: true } });
  return o?.radioGeocercaM ?? P.radioLlegadaM;
}

const sumar = (d: Date, s: number) => new Date(d.getTime() + s * 1000);

type Origen = { porGps: true; distanciaM: number; velocidadKmh: number; fuente: FuentePosicion } | { porGps: false; usuarioId: string };

/**
 * Pasa el viaje a la etapa "a" (desde el motor o desde un botón del chofer). Solo avanza: si el viaje
 * ya está en esa etapa o más adelante, no hace nada. Avisa al que pidió y deja auditoría.
 */
export async function transicionar(viajeId: string, a: Transicion["a"], fecha: Date, origen: Origen): Promise<boolean> {
  const v = await db.viaje.findUnique({ where: { id: viajeId }, include: incluir });
  if (!v) return false;
  const desde: Record<Transicion["a"], EtapaViaje[]> = {
    EN_RETIRO: ["HACIA_RETIRO"],
    HACIA_DESTINO: ["HACIA_RETIRO", "EN_RETIRO"],
    EN_DESTINO: ["HACIA_RETIRO", "EN_RETIRO", "HACIA_DESTINO"],
  };
  if (!desde[a].includes(v.etapa)) return false;

  // El ruteo va antes de la transacción (es una llamada externa).
  const aDestino = a !== "EN_DESTINO" && !v.duracionDestinoS ? await rutaSegura(origenDe(v.pedido), destinoDe(v.pedido)) : null;
  const durDestino = aDestino?.duracionS ?? v.duracionDestinoS ?? 0;
  const distDestino = aDestino?.distanciaM ?? v.distanciaDestinoM ?? 0;
  const estado = estadoMotor(v);
  const pendiente: EstadoMotor["pendiente"] = origen.porGps && a !== "HACIA_DESTINO" ? { etapa: a, hasta: new Date(Date.now() + P.confirmarLlegadaMs).toISOString() } : undefined;
  const motor = json({ ...estado, pendiente, ...(origen.porGps ? {} : { rechazo: undefined }) });

  const datos: Prisma.ViajeUpdateManyMutationInput =
    a === "EN_RETIRO"
      ? { ...conEtapa("EN_RETIRO"), llegadaRetiroEn: fecha, distanciaDestinoM: distDestino, duracionDestinoS: durDestino, etaDestino: sumar(fecha, CARGA_S + durDestino), etaRetiro: null, motor }
      : a === "HACIA_DESTINO"
        ? {
            ...conEtapa("HACIA_DESTINO"), salidaRetiroEn: fecha, llegadaRetiroEn: v.llegadaRetiroEn ?? fecha, distanciaDestinoM: distDestino, duracionDestinoS: durDestino,
            etaDestino: sumar(fecha, durDestino), etaRetiro: null, motor,
          }
        : { ...conEtapa("EN_DESTINO"), llegadaDestinoEn: fecha, llegadaReal: v.llegadaReal ?? fecha, salidaRetiroEn: v.salidaRetiroEn ?? v.llegadaRetiroEn ?? fecha, etaDestino: null, etaRetiro: null, motor };

  const lugar = a === "EN_RETIRO" ? v.pedido.origenNombre : a === "EN_DESTINO" ? v.pedido.destinoNombre : `hacia ${v.pedido.destinoNombre}`;
  const verbo = a === "EN_RETIRO" ? "llegó a" : a === "EN_DESTINO" ? "llegó a" : "salió";
  const resumen = origen.porGps
    ? `GPS: ${v.vehiculo.nombre} ${verbo} ${lugar} (a ${origen.distanciaM} m, ${Math.round(origen.velocidadKmh)} km/h, ${origen.fuente === "CUSAT" ? "Cusat" : origen.fuente === "TELEFONO" ? "teléfono" : "simulador"}) · pedido #${v.pedido.numero}`
    : `${v.chofer.nombre} marcó a mano que ${verbo} ${lugar} · pedido #${v.pedido.numero}`;

  const hecho = await db.$transaction(async (tx) => {
    const r = await tx.viaje.updateMany({ where: { id: v.id, etapa: { in: desde[a] } }, data: datos });
    if (!r.count) return false;
    await sincronizarParadas(tx, v.id, a, fecha);
    const base = await baseViaje(tx, v.pedido.id, v.chofer.nombre);
    if (a === "EN_RETIRO") {
      await notificarEvento(EVENTO.viajeEnRetiro({ ...base, origen: v.pedido.origenNombre, distanciaM: distDestino, etaDestino: sumar(fecha, CARGA_S + durDestino) }), { tx });
    } else if (a === "HACIA_DESTINO") {
      await notificarEvento(EVENTO.viajeSalioRetiro({ ...base, distanciaM: distDestino, etaDestino: sumar(fecha, durDestino) }), { tx });
    } else {
      await notificarEvento(EVENTO.viajeEnDestino({ ...base, llego: fecha }), { tx });
    }
    await auditar(tx, {
      usuarioId: origen.porGps ? null : origen.usuarioId,
      accion: `viaje.${a === "EN_RETIRO" ? "llegadaRetiro" : a === "HACIA_DESTINO" ? "salidaRetiro" : "llegadaDestino"}.${origen.porGps ? "gps" : "manual"}`,
      entidad: "PedidoViaje", entidadId: v.pedido.id, resumen,
      antes: { etapa: v.etapa }, despues: { etapa: a, fecha: fecha.toISOString() },
    });
    return true;
  });
  return hecho;
}

export type LecturaMotor = Punto & { velocidadKmh: number; fecha: Date; fuente: FuentePosicion; demo?: boolean };

/**
 * Una posición nueva del vehículo de un viaje en curso. Prioridad de fuentes: si Cusat (o el
 * simulador) reportó en los últimos 3 minutos, el teléfono se ignora. Devuelve la transición, si hubo.
 */
export async function evaluarViaje(viajeId: string, l: LecturaMotor): Promise<{ transicion: Transicion | null; descartada?: string }> {
  const v = await db.viaje.findUnique({ where: { id: viajeId }, include: incluir });
  if (!v || !["HACIA_RETIRO", "EN_RETIRO", "HACIA_DESTINO"].includes(v.etapa)) return { transicion: null, descartada: "fuera de etapa" };

  if (estadoMotor(v).demo && !l.demo) return { transicion: null, descartada: "viaje en demo" };
  if (l.fuente === "TELEFONO") {
    const cusat = await db.posicionVehiculo.count({ where: { vehiculoId: v.vehiculoId, fuente: { in: ["CUSAT", "MOCK"] }, fecha: { gte: new Date(Date.now() - P.cusatVigenteMs) } } });
    if (cusat) return { transicion: null, descartada: "cusat vigente" };
  }

  const estado = estadoMotor(v);
  const retiro = origenDe(v.pedido);
  // La demo "teletransporta" el vehículo: sus lecturas no se comparan con la anterior (no son saltos).
  const d = decidir({ ...estado, sinSenalAvisado: undefined, ...(l.demo ? { ultima: undefined, demo: true } : {}) }, l, {
    etapa: v.etapa, retiro, destino: destinoDe(v.pedido), radioRetiroM: await radioRetiro(v), radioDestinoM: v.pedido.obra.radioGeocercaM, ahora: new Date(),
  });
  // Volvió la señal: si se había avisado "sin señal", se puede volver a avisar más adelante.
  await db.viaje.update({ where: { id: v.id }, data: { motor: json(d.estado) } });
  if (!d.transicion) return { transicion: null, descartada: d.descartada };
  const t = d.transicion;
  const ok = await transicionar(v.id, t.a, t.fecha, { porGps: true, distanciaM: t.distanciaM, velocidadKmh: t.velocidadKmh, fuente: l.fuente });
  return { transicion: ok ? t : null };
}

/**
 * "Sí, estoy acá" / "No, todavía no" ante una llegada detectada. "No" vuelve el viaje a la etapa
 * anterior y el motor no vuelve a disparar esa llegada hasta que el vehículo salga del radio y vuelva a entrar.
 */
export async function responderLlegada(viajeId: string, si: boolean, usuarioId: string, nombre: string) {
  const v = await db.viaje.findUnique({ where: { id: viajeId }, include: incluir });
  if (!v) return false;
  const estado = estadoMotor(v);
  const p = estado.pendiente;
  if (!p || p.etapa !== v.etapa || new Date(p.hasta) < new Date()) {
    await db.viaje.update({ where: { id: v.id }, data: { motor: json({ ...estado, pendiente: undefined }) } });
    return false;
  }
  if (si) {
    await db.viaje.update({ where: { id: v.id }, data: { motor: json({ ...estado, pendiente: undefined }) } });
    return true;
  }
  const etapa: Llegada = p.etapa;
  const anterior = etapa === "EN_RETIRO" ? "HACIA_RETIRO" : "HACIA_DESTINO";
  await db.$transaction(async (tx) => {
    await tx.viaje.update({
      where: { id: v.id },
      data: {
        ...conEtapa(anterior),
        ...(etapa === "EN_RETIRO" ? { llegadaRetiroEn: null } : { llegadaDestinoEn: null, llegadaReal: null }),
        motor: json({ ...estado, pendiente: undefined, candidato: undefined, rechazo: { etapa, fuera: false } }),
      },
    });
    await sincronizarParadas(tx, v.id, anterior, new Date());
    await auditar(tx, {
      usuarioId, accion: "viaje.llegada.rechazada", entidad: "PedidoViaje", entidadId: v.pedido.id,
      resumen: `${nombre} dijo que todavía no llegó a ${etapa === "EN_RETIRO" ? v.pedido.origenNombre : v.pedido.destinoNombre} (el GPS lo había detectado) · pedido #${v.pedido.numero}`,
      antes: { etapa }, despues: { etapa: anterior },
    });
  });
  return true;
}

export type Senal = { fuente: "CUSAT" | "TELEFONO" | "MOCK" | null; fecha: string | null; sinSenal: boolean };

/** Estado de la señal del viaje: la última posición del vehículo y de qué fuente. */
export async function senalDe(vehiculoId: string, desde: Date | null, cliente: Cliente = db): Promise<Senal> {
  const ult = await cliente.posicionVehiculo.findFirst({ where: { vehiculoId, ...(desde ? { fecha: { gte: new Date(desde.getTime() - P.sinSenalMs) } } : {}) }, orderBy: { fecha: "desc" }, select: { fuente: true, fecha: true } });
  const fecha = ult?.fecha ?? null;
  return { fuente: ult?.fuente ?? null, fecha: fecha?.toISOString() ?? null, sinSenal: !fecha || Date.now() - fecha.getTime() > P.sinSenalMs };
}

/** Cada minuto (job): viajes en curso sin ninguna posición en 10 minutos → aviso UNA vez al que pidió. */
export async function avisarSinSenal() {
  const viajes = await db.viaje.findMany({ where: { etapa: { in: ["HACIA_RETIRO", "EN_RETIRO", "HACIA_DESTINO"] } }, include: incluir });
  let avisados = 0;
  for (const v of viajes) {
    const estado = estadoMotor(v);
    const s = await senalDe(v.vehiculoId, null);
    const desde = s.fecha ? new Date(s.fecha) : v.inicioEn;
    if (!desde || Date.now() - desde.getTime() < P.avisoSinSenalMs) continue;
    if (estado.sinSenalAvisado && new Date(estado.sinSenalAvisado) >= desde) continue;
    await notificarEvento(EVENTO.viajeSinSenal({ ...(await baseViaje(db, v.pedido.id, v.chofer.nombre)), vehiculo: v.vehiculo.nombre, desde }));
    await db.viaje.update({ where: { id: v.id }, data: { motor: json({ ...estado, sinSenalAvisado: new Date().toISOString() }) } });
    avisados++;
  }
  return avisados;
}
