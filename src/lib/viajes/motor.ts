import "server-only";
import type { EtapaViaje, FuentePosicion, Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { auditar } from "@/lib/auditoria";
import { baseViaje, notificarEvento } from "@/lib/notificaciones/enviar";
import { EVENTO } from "@/lib/notificaciones/eventos";
import { distancia, type Punto } from "@/lib/geo";
import { hayTransito, llegadaCon } from "@/lib/rutas";
import { alCambiarElViaje } from "@/lib/materiales/circuito";
import { alLlegarElViaje } from "@/lib/herramientas/servicio";
import { responsablePrincipal } from "@/lib/alcance";
import { conEtapa } from "./etapas";
import { CARGA_S, rutaSegura } from "./tramos";
import { decidir, type EstadoMotor, type ParadaMotor, type Transicion } from "./motor-reglas";
import { PARAMETROS_MOTOR as P } from "./parametros";
import { cancelarRecordatorios } from "./recordatorios-agenda";

type Cliente = Prisma.TransactionClient | PrismaClient;

/**
 * MOTOR DE VIAJES, POR PARADAS. El chofer toca "Iniciar viaje" y "Viaje terminado"; lo del medio lo
 * detecta el motor con cada posición del vehículo (Cusat primero, teléfono de respaldo) sobre la
 * PARADA ACTUAL: llegó (geocerca, quieto, 2 lecturas) → LLEGO; se fue (más de 300 m) → COMPLETADA y
 * la siguiente pasa a EN_CAMINO. Los botones manuales hacen exactamente lo mismo (llegarAParada /
 * salirDeParada). Los avisos van SOLO a los que pidieron algo de esa parada.
 *
 * La etapa del viaje (Viaje.etapa) se deriva de la parada actual: retiro en camino → HACIA_RETIRO,
 * retiro con llegada → EN_RETIRO, entrega en camino → HACIA_DESTINO, entrega con llegada (o todas
 * hechas, esperando "Viaje terminado") → EN_DESTINO. Reglas puras en motor-reglas.ts; parámetros en parametros.ts.
 */

const incluir = {
  pedido: { select: { id: true, numero: true } },
  chofer: { select: { nombre: true } },
  vehiculo: { select: { nombre: true } },
  paradas: { orderBy: { orden: "asc" } },
  viajePedidos: { select: { pedidoViajeId: true, paradaRetiroId: true, paradaEntregaId: true, pedido: { select: { id: true, obraId: true, herramientaId: true, estado: true, destinoNombre: true, obra: { select: { nombre: true } } } } } },
} satisfies Prisma.ViajeInclude;
type ViajeMotor = Prisma.ViajeGetPayload<{ include: typeof incluir }>;
type Parada = ViajeMotor["paradas"][number];

export const estadoMotor = (v: { motor: Prisma.JsonValue | null }) => (v.motor ?? {}) as EstadoMotor;
const json = (e: EstadoMotor) => e as Prisma.InputJsonValue;
const hecha = (p: { estado: string }) => p.estado === "COMPLETADA" || p.estado === "SALTEADA";
export const puntoDeParada = (p: { latitud: number; longitud: number }): Punto => ({ lat: p.latitud, lng: p.longitud });

/** Las paradas que faltan, en orden (la primera es la actual). */
export const pendientes = <T extends { orden: number; estado: string }>(paradas: T[]) => [...paradas].sort((a, b) => a.orden - b.orden).filter((p) => !hecha(p));

/** Etapa del viaje en curso según su parada actual (todas hechas: EN_DESTINO, falta "Viaje terminado"). */
export function etapaDe(paradas: { orden: number; tipo: string; estado: string }[]): EtapaViaje {
  const actual = pendientes(paradas)[0];
  if (!actual) return "EN_DESTINO";
  if (actual.tipo === "RETIRO") return actual.estado === "LLEGO" ? "EN_RETIRO" : "HACIA_RETIRO";
  return actual.estado === "LLEGO" ? "EN_DESTINO" : "HACIA_DESTINO";
}

/** Pedidos de una parada: los que se cargan ahí (retiro) o se entregan ahí (entrega). */
export const pedidosDeParada = (v: Pick<ViajeMotor, "viajePedidos">, p: { id: string; tipo: string }) =>
  v.viajePedidos.filter((x) => (p.tipo === "RETIRO" ? x.paradaRetiroId === p.id : x.paradaEntregaId === p.id));

/** ¿Se puede hacer ya? Una entrega, solo si los retiros de sus pedidos están completos. */
function habilitada(v: ViajeMotor, p: Parada) {
  if (p.tipo === "RETIRO") return true;
  const retiros = pedidosDeParada(v, p).map((x) => x.paradaRetiroId).filter((id): id is string => !!id);
  return retiros.every((id) => v.paradas.find((q) => q.id === id)?.estado === "COMPLETADA");
}

/** Radio de llegada de cada parada: el de la geocerca si es una obra (o sede); si no, 150 m. */
async function radios(v: ViajeMotor): Promise<Map<string, number>> {
  const obras = v.paradas.filter((p) => p.lugarTipo === "OBRA" || p.lugarTipo === "OBRA_SEDE");
  const ids = new Set(obras.flatMap((p) => pedidosDeParada(v, p).map((x) => x.pedido.obraId)));
  const radio = new Map((await db.obra.findMany({ where: { id: { in: [...ids] } }, select: { id: true, radioGeocercaM: true } })).map((o) => [o.id, o.radioGeocercaM]));
  return new Map(v.paradas.map((p) => [p.id, (p.lugarTipo === "OBRA" || p.lugarTipo === "OBRA_SEDE" ? radio.get(pedidosDeParada(v, p)[0]?.pedido.obraId ?? "") : null) ?? P.radioLlegadaM]));
}

/** Metros por el recorrido planeado desde la parada "desde" hasta "hasta" (sumando los tramos). */
export function metrosEntre(paradas: Parada[], desdeOrden: number, hastaOrden: number) {
  const orden = [...paradas].sort((a, b) => a.orden - b.orden);
  let m = 0;
  for (let i = 1; i < orden.length; i++) {
    if (orden[i].orden <= desdeOrden || orden[i].orden > hastaOrden) continue;
    m += orden[i].distanciaDesdeAnteriorM ?? Math.round(distancia(puntoDeParada(orden[i - 1]), puntoDeParada(orden[i])) * 1.3);
  }
  return m;
}

/** "Chubut", "Darwin": el nombre corto de una obra para las frases. */
export const obraCorta = (s: string) => s.replace(/^Obra\s+/i, "").replace(/\s+\d+.*$/, "").trim() || s;

/** Campos de compatibilidad del viaje (los usan el seguimiento y los informes viejos). */
function compat(paradas: Parada[], fecha: Date, viaje: Pick<ViajeMotor, "llegadaRetiroEn" | "salidaRetiroEn" | "llegadaDestinoEn" | "llegadaReal">): Prisma.ViajeUpdateInput {
  const retiros = paradas.filter((p) => p.tipo === "RETIRO");
  const entregas = paradas.filter((p) => p.tipo === "ENTREGA");
  const primerRetiro = retiros.map((p) => p.llegadaEn).filter(Boolean).sort((a, b) => a!.getTime() - b!.getTime())[0] ?? null;
  const retirosHechos = retiros.length > 0 && retiros.every(hecha);
  const ultimaEntrega = entregas.length && entregas.every((p) => p.estado === "LLEGO" || hecha(p)) ? fecha : null;
  return {
    llegadaRetiroEn: viaje.llegadaRetiroEn ?? primerRetiro,
    salidaRetiroEn: retirosHechos ? viaje.salidaRetiroEn ?? fecha : null,
    ...(ultimaEntrega ? { llegadaDestinoEn: viaje.llegadaDestinoEn ?? ultimaEntrega, llegadaReal: viaje.llegadaReal ?? ultimaEntrega } : { llegadaDestinoEn: null, llegadaReal: null }),
  };
}

export type Origen = { porGps: true; distanciaM: number; velocidadKmh: number; fuente: FuentePosicion; adelantada?: boolean } | { porGps: false; usuarioId: string };

const cargar = (cliente: Cliente, viajeId: string) => cliente.viaje.findUnique({ where: { id: viajeId }, include: incluir });

// ─────────────────────────────── Llegar ───────────────────────────────

/**
 * Llegó a una parada (GPS o botón manual). Si no es la que seguía (el chofer cambió el orden), esa pasa
 * a ser la actual y la pantalla pregunta "Llegaste a Chubut antes que a Darwin, ¿seguimos así?".
 * Avisa SOLO a los solicitantes de los pedidos de esa parada. Idempotente.
 */
export async function llegarAParada(viajeId: string, paradaId: string, fecha: Date, origen: Origen): Promise<boolean> {
  const previo = await cargar(db, viajeId);
  if (!previo || previo.estado !== "EN_CURSO") return false;
  const parada = previo.paradas.find((p) => p.id === paradaId);
  if (!parada || parada.estado === "LLEGO" || hecha(parada) || !habilitada(previo, parada)) return false;
  // Para el aviso: cuánto falta hasta la obra de cada pedido que se carga acá (con tránsito, solo con Google).
  const conGoogle = parada.tipo === "RETIRO" && hayTransito() && previo.viajePedidos.length === 1;
  const aObra = conGoogle ? await rutaSegura(puntoDeParada(parada), puntoDeParada(previo.paradas.find((p) => p.tipo === "ENTREGA") ?? parada)) : null;

  return db.$transaction(async (tx) => {
    let v = (await cargar(tx, viajeId))!;
    let actual = pendientes(v.paradas)[0];
    if (!actual || v.paradas.find((p) => p.id === paradaId)?.estado === "LLEGO") return false;
    // Si estaba en otra parada y no tocó "salgo", esa queda hecha.
    if (actual.estado === "LLEGO" && actual.id !== paradaId) {
      await completar(tx, v, actual, fecha, origen);
      v = (await cargar(tx, viajeId))!;
      actual = pendientes(v.paradas)[0];
      if (!actual) return false;
    }
    const ordenAnterior = pendientes(v.paradas).map((p) => p.id);
    const adelantada = actual.id !== paradaId ? actual : null;
    if (adelantada) {
      // Reordenar: lo hecho queda igual; esta parada pasa adelante y el resto mantiene su orden.
      const hechas = [...v.paradas].sort((a, b) => a.orden - b.orden).filter(hecha);
      const resto = pendientes(v.paradas).filter((p) => p.id !== paradaId);
      const nuevo = [...hechas, v.paradas.find((p) => p.id === paradaId)!, ...resto];
      for (const [i, p] of nuevo.entries()) await tx.viajeParada.update({ where: { id: p.id }, data: { orden: i + 1 } });
    }
    const r = await tx.viajeParada.updateMany({ where: { id: paradaId, estado: { in: ["PENDIENTE", "EN_CAMINO"] } }, data: { estado: "LLEGO", llegadaEn: fecha } });
    if (!r.count) return false;
    await tx.viajeParada.updateMany({ where: { viajeId, id: { not: paradaId }, estado: "EN_CAMINO" }, data: { estado: "PENDIENTE" } });

    const despues = (await cargar(tx, viajeId))!;
    const p = despues.paradas.find((x) => x.id === paradaId)!;
    const estado = estadoMotor(despues);
    const pendiente: EstadoMotor["pendiente"] = origen.porGps ? { clave: paradaId, hasta: new Date(Date.now() + P.confirmarLlegadaMs).toISOString(), adelantadaDe: adelantada?.nombre ?? null, ordenAnterior } : undefined;
    const etaDestino = p.tipo === "RETIRO" ? llegadaCon(aObra, fecha, CARGA_S) : null;
    await tx.viaje.update({
      where: { id: viajeId },
      data: { ...conEtapa(etapaDe(despues.paradas)), ...compat(despues.paradas, fecha, despues), etaRetiro: null, etaDestino, motor: json({ ...estado, pendiente, ...(origen.porGps ? {} : { rechazo: undefined }) }) },
    });

    // Avisos: solo a los de esta parada.
    const deAca = pedidosDeParada(despues, p);
    for (const x of deAca) {
      const base = await baseViaje(tx, x.pedidoViajeId, despues.chofer.nombre);
      if (p.tipo === "RETIRO") {
        const otros = [...new Set(deAca.filter((y) => y.pedido.obraId !== x.pedido.obraId).map((y) => obraCorta(y.pedido.obra.nombre)))];
        const suEntrega = despues.paradas.find((q) => q.id === x.paradaEntregaId);
        const distanciaM = suEntrega ? metrosEntre(despues.paradas, p.orden, suEntrega.orden) : 0;
        await notificarEvento(EVENTO.viajeEnRetiro({ ...base, origen: p.nombre, distanciaM, etaDestino, tambien: otros }), { tx });
      } else {
        await notificarEvento(EVENTO.viajeEnDestino({ ...base, destino: p.nombre, llego: fecha }), { tx });
      }
    }
    const lugar = `${p.nombre}${adelantada ? ` (antes que ${adelantada.nombre})` : ""}`;
    const resumen = origen.porGps
      ? `GPS: ${despues.vehiculo.nombre} llegó a ${lugar} (a ${origen.distanciaM} m, ${Math.round(origen.velocidadKmh)} km/h, ${origen.fuente === "CUSAT" ? "Cusat" : origen.fuente === "TELEFONO" ? "teléfono" : "simulador"}) · pedido #${despues.pedido.numero}`
      : `${despues.chofer.nombre} marcó a mano que llegó a ${lugar} · pedido #${despues.pedido.numero}`;
    await auditar(tx, {
      usuarioId: origen.porGps ? null : origen.usuarioId, accion: `viaje.${p.tipo === "RETIRO" ? "llegadaRetiro" : "llegadaDestino"}.${origen.porGps ? "gps" : "manual"}`,
      entidad: "PedidoViaje", entidadId: despues.pedido.id, resumen, antes: { etapa: v.etapa, parada: actual.nombre }, despues: { etapa: etapaDe(despues.paradas), parada: p.nombre, fecha: fecha.toISOString() },
    });
    return true;
  });
}

// ─────────────────────────────── Salir / completar ───────────────────────────────

/**
 * Completa una parada (se fue, "Cargué todo, salgo" o "Entregado acá"): queda COMPLETADA con los ítems
 * que no se marcaron como faltantes tildados, y la siguiente pasa a EN_CAMINO. En una entrega, esos
 * pedidos quedan ENTREGADOS (con su material y su herramienta).
 */
async function completar(tx: Prisma.TransactionClient, v: ViajeMotor, p: Parada, fecha: Date, origen: Origen, remitoUrl?: string | null) {
  await tx.viajeParada.update({ where: { id: p.id }, data: { estado: "COMPLETADA", llegadaEn: p.llegadaEn ?? fecha, salidaEn: fecha, ...(remitoUrl ? { remitoUrl } : {}) } });
  await tx.itemParada.updateMany({ where: { paradaId: p.id, marcado: false, faltante: false }, data: { marcado: true, marcadoEn: fecha } });
  if (p.tipo !== "ENTREGA") return;
  const usuarioId = origen.porGps ? null : origen.usuarioId;
  for (const x of pedidosDeParada(v, p)) {
    if (x.pedido.estado === "ENTREGADO") continue;
    await tx.pedidoViaje.update({ where: { id: x.pedidoViajeId }, data: { estado: "ENTREGADO" } });
    await alCambiarElViaje(tx, x.pedidoViajeId, "ENTREGADO", usuarioId);
    if (x.pedido.herramientaId) {
      await alLlegarElViaje(tx, { usuarioId: usuarioId ?? v.choferId, viajeId: v.id, herramientaId: x.pedido.herramientaId, obraId: x.pedido.obraId, recibidoPorId: (await responsablePrincipal(tx, x.pedido.obraId))?.id ?? null });
    }
  }
}

export async function salirDeParada(viajeId: string, paradaId: string, fecha: Date, origen: Origen, o: { remitoUrl?: string | null } = {}): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const v = await cargar(tx, viajeId);
    if (!v || v.estado !== "EN_CURSO") return false;
    const p = v.paradas.find((x) => x.id === paradaId);
    const actual = pendientes(v.paradas)[0];
    // Solo la parada actual (nunca una que no es la que sigue). Reenvío o doble toque: no hace nada.
    if (!p || !actual || actual.id !== paradaId || hecha(p)) return false;
    await completar(tx, v, p, fecha, origen, o.remitoUrl);
    const resto = pendientes(v.paradas).filter((x) => x.id !== paradaId);
    if (resto[0]) await tx.viajeParada.update({ where: { id: resto[0].id }, data: { estado: "EN_CAMINO" } });

    const despues = (await cargar(tx, viajeId))!;
    await tx.viaje.update({ where: { id: viajeId }, data: { ...conEtapa(etapaDe(despues.paradas)), ...compat(despues.paradas, fecha, despues), motor: json({ ...estadoMotor(despues), pendiente: undefined, candidato: undefined, rechazo: undefined }) } });

    // Avisos: a los que se cargaron acá, que el chofer salió hacia su obra (y por dónde pasa antes).
    const deAca = pedidosDeParada(despues, p);
    for (const x of deAca) {
      const base = await baseViaje(tx, x.pedidoViajeId, despues.chofer.nombre);
      if (p.tipo === "RETIRO") {
        const suEntrega = despues.paradas.find((q) => q.id === x.paradaEntregaId);
        // Todo lo que hace antes de su entrega (otros retiros y otras entregas): "antes pasa por Terreno Humboldt y Darwin".
        const antes = suEntrega ? pendientes(despues.paradas).filter((q) => q.orden < suEntrega.orden).map((q) => obraCorta(q.nombre.split(" · ")[0])) : [];
        const distanciaM = suEntrega ? metrosEntre(despues.paradas, p.orden, suEntrega.orden) : 0;
        await notificarEvento(EVENTO.viajeSalioRetiro({ ...base, distanciaM, etaDestino: null, antes: [...new Set(antes)] }), { tx });
      } else {
        await notificarEvento(EVENTO.pedidoEntregado({ ...base, destino: p.nombre, llego: p.llegadaEn ?? fecha }), { tx });
      }
    }
    await auditar(tx, {
      usuarioId: origen.porGps ? null : origen.usuarioId, accion: `viaje.${p.tipo === "RETIRO" ? "salidaRetiro" : "entregaParada"}.${origen.porGps ? "gps" : "manual"}`,
      entidad: "PedidoViaje", entidadId: despues.pedido.id,
      resumen: origen.porGps ? `GPS: ${despues.vehiculo.nombre} salió de ${p.nombre} · pedido #${despues.pedido.numero}` : `${despues.chofer.nombre} marcó ${p.tipo === "RETIRO" ? `"Cargué todo, salgo" en ${p.nombre}` : `"Entregado acá" en ${p.nombre}`} · pedido #${despues.pedido.numero}`,
      antes: { parada: p.nombre, estado: p.estado }, despues: { parada: p.nombre, estado: "COMPLETADA", siguiente: resto[0]?.nombre ?? null },
    });
    return true;
  });
}

/** Compatibilidad: la transición de etapas de antes, sobre la parada actual. */
export async function transicionar(viajeId: string, a: "EN_RETIRO" | "HACIA_DESTINO" | "EN_DESTINO", fecha: Date, origen: Origen): Promise<boolean> {
  const v = await cargar(db, viajeId);
  const actual = v && pendientes(v.paradas)[0];
  if (!actual) return false;
  if (a === "HACIA_DESTINO") return actual.estado === "LLEGO" ? salirDeParada(viajeId, actual.id, fecha, origen) : false;
  return actual.estado === "LLEGO" ? false : llegarAParada(viajeId, actual.id, fecha, origen);
}

// ─────────────────────────────── GPS ───────────────────────────────

export type LecturaMotor = Punto & { velocidadKmh: number; fecha: Date; fuente: FuentePosicion; demo?: boolean };

/**
 * Una posición nueva del vehículo de un viaje en curso. Prioridad de fuentes: si Cusat (o el
 * simulador) reportó en los últimos 3 minutos, el teléfono se ignora. Devuelve la transición, si hubo.
 */
export async function evaluarViaje(viajeId: string, l: LecturaMotor): Promise<{ transicion: Transicion | null; descartada?: string }> {
  const v = await cargar(db, viajeId);
  if (!v || v.estado !== "EN_CURSO" || !["HACIA_RETIRO", "EN_RETIRO", "HACIA_DESTINO", "EN_DESTINO"].includes(v.etapa)) return { transicion: null, descartada: "fuera de etapa" };
  if (estadoMotor(v).demo && !l.demo) return { transicion: null, descartada: "viaje en demo" };
  if (l.fuente === "TELEFONO") {
    const cusat = await db.posicionVehiculo.count({ where: { vehiculoId: v.vehiculoId, fuente: { in: ["CUSAT", "MOCK"] }, fecha: { gte: new Date(Date.now() - P.cusatVigenteMs) } } });
    if (cusat) return { transicion: null, descartada: "cusat vigente" };
  }
  const r = await radios(v);
  const paradas: ParadaMotor[] = pendientes(v.paradas).map((p) => ({
    clave: p.id, punto: puntoDeParada(p), radioM: r.get(p.id) ?? P.radioLlegadaM, estado: p.estado === "LLEGO" ? "LLEGO" : p.estado === "EN_CAMINO" ? "EN_CAMINO" : "PENDIENTE", habilitada: habilitada(v, p),
  }));
  const estado = estadoMotor(v);
  // La demo "teletransporta" el vehículo: sus lecturas no se comparan con la anterior (no son saltos).
  const d = decidir({ ...estado, sinSenalAvisado: undefined, ...(l.demo ? { ultima: undefined, demo: true } : {}) }, l, { paradas, ahora: new Date() });
  await db.viaje.update({ where: { id: v.id }, data: { motor: json({ ...d.estado, pendiente: estado.pendiente, etaEn: estado.etaEn }) } });
  if (!d.transicion) return { transicion: null, descartada: d.descartada };
  const t = d.transicion;
  const origen: Origen = { porGps: true, distanciaM: t.distanciaM, velocidadKmh: t.velocidadKmh, fuente: l.fuente, adelantada: t.adelantada };
  const ok = t.tipo === "llegada" ? await llegarAParada(v.id, t.clave, t.fecha, origen) : await salirDeParada(v.id, t.clave, t.fecha, origen);
  return { transicion: ok ? t : null };
}

/**
 * "Sí, estoy acá" / "No, todavía no" ante una llegada que detectó el GPS (o "¿seguimos así?" si llegó
 * a otra parada antes). "No" vuelve la parada a EN_CAMINO, restaura el orden y el motor no vuelve a
 * disparar esa llegada hasta que el vehículo salga del radio y vuelva a entrar.
 */
export async function responderLlegada(viajeId: string, si: boolean, usuarioId: string, nombre: string) {
  const v = await cargar(db, viajeId);
  if (!v) return false;
  const estado = estadoMotor(v);
  const p = estado.pendiente;
  const parada = p && v.paradas.find((x) => x.id === p.clave);
  if (!p || !parada || parada.estado !== "LLEGO" || new Date(p.hasta) < new Date()) {
    await db.viaje.update({ where: { id: v.id }, data: { motor: json({ ...estado, pendiente: undefined }) } });
    return false;
  }
  if (si) {
    await db.viaje.update({ where: { id: v.id }, data: { motor: json({ ...estado, pendiente: undefined }) } });
    return true;
  }
  await db.$transaction(async (tx) => {
    // El orden de antes (si la llegada había sido "adelantada").
    if (p.ordenAnterior?.length) {
      const hechas = [...v.paradas].sort((a, b) => a.orden - b.orden).filter(hecha);
      const resto = p.ordenAnterior.map((id) => v.paradas.find((x) => x.id === id)).filter((x): x is Parada => !!x && !hecha(x));
      for (const [i, x] of [...hechas, ...resto].entries()) await tx.viajeParada.update({ where: { id: x.id }, data: { orden: i + 1 } });
    }
    await tx.viajeParada.update({ where: { id: parada.id }, data: { estado: "PENDIENTE", llegadaEn: null } });
    const primera = pendientes((await tx.viajeParada.findMany({ where: { viajeId: v.id } })))[0];
    if (primera) await tx.viajeParada.update({ where: { id: primera.id }, data: { estado: "EN_CAMINO" } });
    const paradas = await tx.viajeParada.findMany({ where: { viajeId: v.id } });
    await tx.viaje.update({
      where: { id: v.id },
      data: { ...conEtapa(etapaDe(paradas)), ...compat(paradas as Parada[], new Date(), { llegadaRetiroEn: parada.tipo === "RETIRO" ? null : v.llegadaRetiroEn, salidaRetiroEn: v.salidaRetiroEn, llegadaDestinoEn: null, llegadaReal: null }), motor: json({ ...estado, pendiente: undefined, candidato: undefined, rechazo: { clave: parada.id, fuera: false } }) },
    });
    await auditar(tx, {
      usuarioId, accion: "viaje.llegada.rechazada", entidad: "PedidoViaje", entidadId: v.pedido.id,
      resumen: `${nombre} dijo que todavía no llegó a ${parada.nombre} (el GPS lo había detectado) · pedido #${v.pedido.numero}`,
      antes: { parada: parada.nombre, estado: "LLEGO" }, despues: { parada: parada.nombre, estado: "PENDIENTE" },
    });
  });
  return true;
}

// ─────────────────────────────── Señal ───────────────────────────────

export type Senal = { fuente: "CUSAT" | "TELEFONO" | "MOCK" | null; fecha: string | null; sinSenal: boolean };

/** Estado de la señal del viaje: la última posición del vehículo y de qué fuente. */
export async function senalDe(vehiculoId: string, desde: Date | null, cliente: Cliente = db): Promise<Senal> {
  const ult = await cliente.posicionVehiculo.findFirst({ where: { vehiculoId, ...(desde ? { fecha: { gte: new Date(desde.getTime() - P.sinSenalMs) } } : {}) }, orderBy: { fecha: "desc" }, select: { fuente: true, fecha: true } });
  const fecha = ult?.fecha ?? null;
  return { fuente: ult?.fuente ?? null, fecha: fecha?.toISOString() ?? null, sinSenal: !fecha || Date.now() - fecha.getTime() > P.sinSenalMs };
}

/** Cada minuto (job): viajes en curso sin ninguna posición en 10 minutos → aviso UNA vez a los que pidieron. */
export async function avisarSinSenal() {
  const viajes = await db.viaje.findMany({ where: { estado: "EN_CURSO", etapa: { in: ["HACIA_RETIRO", "EN_RETIRO", "HACIA_DESTINO"] } }, include: incluir });
  let avisados = 0;
  for (const v of viajes) {
    const estado = estadoMotor(v);
    const s = await senalDe(v.vehiculoId, null);
    const desde = s.fecha ? new Date(s.fecha) : v.inicioEn;
    if (!desde || Date.now() - desde.getTime() < P.avisoSinSenalMs) continue;
    if (estado.sinSenalAvisado && new Date(estado.sinSenalAvisado) >= desde) continue;
    for (const x of v.viajePedidos.filter((y) => y.pedido.estado !== "ENTREGADO")) {
      await notificarEvento(EVENTO.viajeSinSenal({ ...(await baseViaje(db, x.pedidoViajeId, v.chofer.nombre)), vehiculo: v.vehiculo.nombre, desde }));
    }
    await db.viaje.update({ where: { id: v.id }, data: { motor: json({ ...estado, sinSenalAvisado: new Date().toISOString() }) } });
    avisados++;
  }
  return avisados;
}

/** Al iniciar: la primera parada queda EN_CAMINO (o LLEGO si arranca ahí mismo, por ejemplo cargando en el galpón). */
export async function arrancarParadas(tx: Prisma.TransactionClient, viajeId: string, desde: Punto | null, fecha: Date) {
  const paradas = await tx.viajeParada.findMany({ where: { viajeId }, orderBy: { orden: "asc" } });
  await tx.viajeParada.updateMany({ where: { viajeId }, data: { estado: "PENDIENTE", llegadaEn: null, salidaEn: null } });
  const primera = paradas[0];
  if (!primera) return "HACIA_DESTINO" as EtapaViaje;
  const yaEsta = !!desde && primera.tipo === "RETIRO" && distancia(desde, puntoDeParada(primera)) <= P.mismoLugarM;
  await tx.viajeParada.update({ where: { id: primera.id }, data: yaEsta ? { estado: "LLEGO", llegadaEn: fecha } : { estado: "EN_CAMINO" } });
  return etapaDe(paradas.map((p) => (p.id === primera.id ? { ...p, estado: yaEsta ? "LLEGO" : "EN_CAMINO" } : { ...p, estado: "PENDIENTE" })));
}

/** Cancela los recordatorios de todos los pedidos de un viaje (al salir). */
export const cancelarRecordatoriosDelViaje = (tx: Prisma.TransactionClient, pedidoIds: string[]) => cancelarRecordatorios(tx, pedidoIds);
