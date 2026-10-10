"use server";

import { revalidar } from "@/lib/revalidar";
import { reevaluar } from "@/lib/alertas/reevaluar";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { auditar, describirPedido, validarChoferYVehiculo } from "@/lib/pedidos/reglas";
import { responsablePrincipal } from "@/lib/alcance";
import { conEtapa } from "./etapas";
import { baseDe, rutaSegura } from "./tramos";
import { distancia } from "@/lib/geo";
import { repartirCostos } from "./reparto";
import { llegadaCon } from "@/lib/rutas";
import { bloqueoPorFecha, diasEntre, previstoPara } from "./fecha";
import { cancelarRecordatorios } from "./recordatorios-agenda";
import { baseViaje, notificarEvento } from "@/lib/notificaciones/enviar";
import { EVENTO } from "@/lib/notificaciones/eventos";
import { finDelDia, hora } from "@/lib/formato";
import { guardarArchivo } from "@/lib/archivos";
import { km as fmtKm } from "@/lib/formato";
import { alLlegarElViaje } from "@/lib/herramientas/servicio";
import { alCambiarElViaje } from "@/lib/materiales/circuito";
import { arrancarParadas, llegarAParada, metrosEntre, pendientes, puntoDeParada, responderLlegada as responderLlegadaMotor, salirDeParada } from "./motor";

/** Refresca pantallas y reevalúa las alertas del módulo (resuelve solas las que ya no aplican). */
const refrescar = () => {
  revalidar("pedidos", "flota", "herramientas", "materiales");
  reevaluar("pedidos", "flota", "herramientas", "materiales");
};
const vacio = (v: unknown) => (v === "" || v === null ? undefined : v);

/** Hora real del evento: la del teléfono si se guardó sin señal (nunca en el futuro). */
function momento(ocurridoEn: Date | undefined, noAntesDe?: Date | null) {
  const ahora = new Date();
  if (!ocurridoEn || ocurridoEn > ahora) return ahora;
  if (noAntesDe && ocurridoEn < noAntesDe) return noAntesDe;
  return ocurridoEn;
}

// ═══════════════════════════ Iniciar ═══════════════════════════

/** Dónde estaba el teléfono al tocar el botón (si dio permiso de ubicación). */
const posicion = {
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  precisionM: z.coerce.number().min(0).optional(),
};

const esquemaInicio = z.object({
  clientId: z.string().uuid(),
  pedidoId: z.string().min(1),
  kmSalida: z.coerce.number({ error: "Poné los km del tablero." }).int("Los km van sin decimales.").min(0),
  ocurridoEn: z.coerce.date().optional(),
  ...posicion,
});
export type DatosInicio = z.input<typeof esquemaInicio>;

const incluirInicio = {
  pedido: true,
  pedidos: { select: { id: true, paraCuando: true } },
  vehiculo: { select: { baseId: true, ultimaLat: true, ultimaLng: true } },
  paradas: { orderBy: { orden: "asc" as const } },
  viajePedidos: { select: { pedidoViajeId: true, paradaRetiroId: true, paradaEntregaId: true } },
} satisfies Prisma.ViajeInclude;

export async function iniciarViaje(entrada: DatosInicio): Promise<Resultado<{ vehiculo: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("viajes.ejecutar");
    const d = esquemaInicio.parse(entrada);

    // Idempotente: si el teléfono lo reenvía, no pasa nada.
    const ya = await db.viaje.findUnique({ where: { clientIdInicio: d.clientId }, select: { vehiculo: { select: { nombre: true } } } });
    if (ya) return { vehiculo: ya.vehiculo.nombre };

    // Ruta a la primera parada desde donde está el teléfono (o la base del vehículo). Nunca traba: hay respaldo.
    const previo = await db.viaje.findFirst({ where: { pedidos: { some: { id: d.pedidoId } } }, include: incluirInicio });
    if (!previo) throw new ErrorNegocio("No existe ese viaje.");
    const gps = d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : null;
    const satelite = previo.vehiculo.ultimaLat != null && previo.vehiculo.ultimaLng != null ? { lat: previo.vehiculo.ultimaLat, lng: previo.vehiculo.ultimaLng } : null;
    const conocido = gps ?? satelite ?? (await baseDe(previo.vehiculo));
    const primera = previo.paradas[0];
    const aPrimera = primera ? await rutaSegura(conocido ?? puntoDeParada(primera), puntoDeParada(primera)) : null;

    const r = await db.$transaction(async (tx) => {
      const viaje = await tx.viaje.findFirst({ where: { pedidos: { some: { id: d.pedidoId } } }, include: incluirInicio });
      if (!viaje || viaje.pedido.tomadoPorId !== yo.id || viaje.estado !== "PROGRAMADO" || !viaje.pedidos.length) {
        throw new ErrorNegocio("Este viaje no está listo para salir.");
      }
      // Bloqueo por fecha: solo se inicia el día del pedido (o después, atrasado). Aunque se fuerce desde el teléfono.
      const paraCuando = new Date(Math.min(...viaje.pedidos.map((p) => p.paraCuando.getTime())));
      const bloqueo = bloqueoPorFecha(paraCuando);
      if (bloqueo) throw new ErrorNegocio(`${bloqueo}. Si lo necesitás hacer antes, tocá "Pedir que lo adelanten".`);
      const atrasado = diasEntre(paraCuando) < 0 ? previstoPara(paraCuando) : null;
      const enCurso = await tx.viaje.findFirst({ where: { estado: "EN_CURSO", OR: [{ choferId: yo.id }, { vehiculoId: viaje.vehiculoId }] }, select: { choferId: true } });
      if (enCurso) throw new ErrorNegocio(enCurso.choferId === yo.id ? "Ya tenés un viaje en curso. Terminalo antes de salir de nuevo." : "Ese vehículo está en otro viaje.");

      const { vehiculo } = await validarChoferYVehiculo(tx, yo.id, viaje.vehiculoId, viaje.pedido);
      if (d.kmSalida < vehiculo.kmActual) throw new ErrorNegocio(`${vehiculo.nombre} tiene registrados ${fmtKm(vehiculo.kmActual)}. Los km de salida no pueden ser menos.`);
      if (d.kmSalida > vehiculo.kmActual + 3000) throw new ErrorNegocio(`Son ${fmtKm(d.kmSalida - vehiculo.kmActual)} más que los registrados. Revisá el número.`);

      const salidaReal = momento(d.ocurridoEn);
      // La primera parada queda en camino (o "llegó" si arranca ahí mismo: carga en el galpón).
      const etapa = await arrancarParadas(tx, viaje.id, conocido, salidaReal);
      // Hora de llegada solo con tránsito real (Google); sin eso, null y la app muestra solo distancia.
      const eta = etapa === "HACIA_RETIRO" || etapa === "HACIA_DESTINO" ? llegadaCon(aPrimera, salidaReal) : null;
      await tx.viaje.update({
        where: { id: viaje.id },
        data: {
          ...conEtapa(etapa), salidaReal, inicioEn: salidaReal, kmSalida: d.kmSalida, clientIdInicio: d.clientId, motor: {},
          distanciaRetiroM: aPrimera?.distanciaM ?? null, duracionRetiroS: aPrimera?.duracionS ?? null,
          etaRetiro: etapa === "HACIA_RETIRO" ? eta : null, etaDestino: etapa === "HACIA_DESTINO" ? eta : null,
          ...(etapa === "EN_RETIRO" ? { llegadaRetiroEn: salidaReal } : {}),
        },
      });
      if (gps) {
        await tx.posicionVehiculo.create({ data: { vehiculoId: viaje.vehiculoId, viajeId: viaje.id, usuarioId: yo.id, fuente: "TELEFONO", latitud: gps.lat, longitud: gps.lng, precisionM: d.precisionM ?? null, motorEncendido: true, fecha: salidaReal } });
      }
      // Todos los pedidos del viaje salen; a cada solicitante, dónde está su retiro.
      for (const vp of viaje.viajePedidos) {
        await tx.pedidoViaje.update({ where: { id: vp.pedidoViajeId }, data: { estado: "EN_VIAJE" } });
        await alCambiarElViaje(tx, vp.pedidoViajeId, "EN_VIAJE", yo.id);
        const retiro = viaje.paradas.find((p) => p.id === vp.paradaRetiroId);
        const entrega = viaje.paradas.find((p) => p.id === vp.paradaEntregaId);
        const hasta = retiro ?? entrega;
        const distanciaM = (aPrimera?.distanciaM ?? 0) + (hasta && primera ? metrosEntre(viaje.paradas, primera.orden, hasta.orden) : 0);
        await notificarEvento(EVENTO.viajeSalio({
          ...(await baseViaje(tx, vp.pedidoViajeId, yo.nombre)), origen: retiro?.nombre ?? "", distanciaM,
          etaRetiro: retiro && retiro.id === primera?.id ? eta : null, etaDestino: !retiro && entrega?.id === primera?.id ? eta : null, directo: !retiro, atrasado,
        }), { tx, actor: yo.id });
      }
      // Salió: los recordatorios que faltaban ("Todavía no iniciaste…") ya no van.
      await cancelarRecordatorios(tx, viaje.pedidos.map((p) => p.id));
      await tx.vehiculo.update({ where: { id: vehiculo.id }, data: { estado: "EN_VIAJE", kmActual: d.kmSalida } });
      const varios = viaje.pedidos.length > 1 ? ` (${viaje.pedidos.length} pedidos, ${viaje.paradas.length} paradas)` : "";
      await auditar(tx, { usuarioId: yo.id, accion: "viaje.iniciar", entidadId: d.pedidoId, resumen: `${yo.nombre} salió con ${vehiculo.nombre} para ${await describirPedido(tx, d.pedidoId)}${varios}${atrasado ? ` (estaba previsto para ${atrasado})` : ""}`, antes: { estado: "TOMADO" }, despues: { estado: "EN_VIAJE", kmSalida: d.kmSalida, vehiculo: vehiculo.nombre } });
      return { vehiculo: vehiculo.nombre };
    });
    refrescar();
    return r;
  });
}

// ═══════════════════════════ Botones manuales (parada actual) ═══════════════════════════

const esquemaTramo = z.object({
  clientId: z.string().uuid(), pedidoId: z.string().min(1), paradaId: z.string().optional(), ocurridoEn: z.coerce.date().optional(),
  foto: z.preprocess(vacio, z.string().optional()), // remito de la parada (data URL), opcional
  ...posicion,
});
export type DatosTramo = z.input<typeof esquemaTramo>;

/**
 * El botón manual marca SIEMPRE la parada actual del viaje: si la que manda el teléfono ya no es la que
 * sigue (reenvío sin señal, doble toque, o el GPS ya la marcó), no se toca nada.
 */
async function paradaDelBoton(pedidoId: string, paradaId: string | undefined, choferId: string) {
  const v = await db.viaje.findFirst({ where: { pedidos: { some: { id: pedidoId } } }, select: { id: true, choferId: true, etapa: true, estado: true, inicioEn: true, paradas: { select: { id: true, orden: true, estado: true, tipo: true, nombre: true, llegadaEn: true } } } });
  if (!v || v.choferId !== choferId) throw new ErrorNegocio("Este viaje no es tuyo.");
  if (v.etapa === "PROGRAMADO") throw new ErrorNegocio("Primero iniciá el viaje.");
  const actual = pendientes(v.paradas)[0] ?? null;
  return { v, actual: actual && (!paradaId || actual.id === paradaId) ? actual : null };
}
const etapaActual = async (viajeId: string) => (await db.viaje.findUniqueOrThrow({ where: { id: viajeId }, select: { etapa: true } })).etapa;

/** A mano: "Llegué al proveedor / al galpón / a la obra" (la parada actual). Misma transición que el GPS. */
async function llegueAParada(entrada: DatosTramo): Promise<Resultado<{ etapa: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("viajes.ejecutar");
    const d = esquemaTramo.parse(entrada);
    const { v, actual } = await paradaDelBoton(d.pedidoId, d.paradaId, yo.id);
    if (actual && actual.estado !== "LLEGO") await llegarAParada(v.id, actual.id, momento(d.ocurridoEn, v.inicioEn), { porGps: false, usuarioId: yo.id });
    refrescar();
    return { etapa: await etapaActual(v.id) };
  });
}
export async function llegueAlRetiro(entrada: DatosTramo) {
  return llegueAParada(entrada);
}
export async function llegueAlDestino(entrada: DatosTramo) {
  return llegueAParada(entrada);
}

/** "Cargué todo, salgo" (retiro) o "Entregado acá" (entrega): completa la parada actual, con foto del remito opcional. */
export async function salgoHaciaDestino(entrada: DatosTramo): Promise<Resultado<{ etapa: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("viajes.ejecutar");
    const d = esquemaTramo.parse(entrada);
    const { v, actual } = await paradaDelBoton(d.pedidoId, d.paradaId, yo.id);
    if (actual) {
      const fecha = momento(d.ocurridoEn, actual.llegadaEn ?? v.inicioEn);
      if (actual.estado !== "LLEGO") await llegarAParada(v.id, actual.id, fecha, { porGps: false, usuarioId: yo.id });
      const remitoUrl = d.foto ? await guardarArchivo(db, d.foto, yo.id, `remito-${actual.nombre}`) : null;
      await salirDeParada(v.id, actual.id, fecha, { porGps: false, usuarioId: yo.id }, { remitoUrl });
    }
    refrescar();
    return { etapa: await etapaActual(v.id) };
  });
}

/** "Sí, estoy acá" / "No, todavía no" (o "¿seguimos así?") ante una llegada que detectó el GPS. */
export async function responderLlegada(pedidoId: string, si: boolean): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("viajes.ejecutar");
    const v = await db.viaje.findFirst({ where: { pedidos: { some: { id: pedidoId } } }, select: { id: true, choferId: true } });
    if (!v || v.choferId !== yo.id) throw new ErrorNegocio("Este viaje no es tuyo.");
    await responderLlegadaMotor(v.id, si, yo.id, yo.nombre);
    refrescar();
    return null;
  });
}

// ═══════════════════════════ Lista de verificación ═══════════════════════════

async function itemDelChofer(itemId: string, choferId: string) {
  const it = await db.itemParada.findUnique({ where: { id: itemId }, include: { parada: { select: { id: true, nombre: true, tipo: true, estado: true, viaje: { select: { id: true, choferId: true, estado: true } } } } } });
  if (!it || it.parada.viaje.choferId !== choferId) throw new ErrorNegocio("Ese ítem no es de tu viaje.");
  if (it.parada.viaje.estado !== "EN_CURSO") throw new ErrorNegocio("El viaje no está en curso.");
  return it;
}

/** Tildar (o destildar) un ítem de la parada: "→ Darwin: 40 bolsas cemento (OC-2026-0012)". */
export async function marcarItem(itemId: string, marcado: boolean): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("viajes.ejecutar");
    const it = await itemDelChofer(itemId, yo.id);
    await db.itemParada.update({ where: { id: it.id }, data: { marcado, marcadoEn: marcado ? new Date() : null, ...(marcado ? { faltante: false, cantidadReal: null } : {}) } });
    revalidar("pedidos");
    return null;
  });
}

const esquemaFaltante = z.object({
  itemId: z.string().min(1),
  cantidadReal: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0, "No puede ser negativo.").nullable()),
  nota: z.preprocess(vacio, z.string().trim().max(300).optional()),
});

/** "Faltó": cuánto se retiró de verdad y por qué. Avisa al que pidió y a Compras ("Retiraron 30 de 40 bolsas"). */
export async function marcarFaltante(entrada: z.input<typeof esquemaFaltante>): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("viajes.ejecutar");
    const d = esquemaFaltante.parse(entrada);
    const it = await itemDelChofer(d.itemId, yo.id);
    const total = it.cantidad?.toNumber() ?? null;
    if (d.cantidadReal != null && total != null && d.cantidadReal >= total) throw new ErrorNegocio(`Si retiraron ${total} o más, no faltó nada: tildalo.`);
    await db.$transaction(async (tx) => {
      await tx.itemParada.update({ where: { id: it.id }, data: { faltante: true, marcado: true, marcadoEn: new Date(), cantidadReal: d.cantidadReal, nota: d.nota ?? null } });
      await notificarEvento(EVENTO.faltante({ ...(await baseViaje(tx, it.pedidoViajeId, yo.nombre)), item: it.descripcion, real: d.cantidadReal, total, unidad: it.unidad, nota: d.nota ?? null, lugar: it.parada.nombre }), { tx, actor: yo.id });
      await auditar(tx, { usuarioId: yo.id, accion: "viaje.faltante", entidadId: it.pedidoViajeId, resumen: `${yo.nombre} marcó que faltó ${it.descripcion} en ${it.parada.nombre}: ${d.cantidadReal ?? "?"} de ${total ?? "?"}${it.unidad ? ` ${it.unidad}` : ""}${d.nota ? ` (${d.nota})` : ""}` });
    });
    revalidar("pedidos", "materiales");
    return null;
  });
}

// ═══════════════════════════ Finalizar ═══════════════════════════

const esquemaFin = z.object({
  clientId: z.string().uuid(),
  pedidoId: z.string().min(1),
  kmLlegada: z.coerce.number({ error: "Poné los km del tablero." }).int("Los km van sin decimales.").min(0),
  peajes: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().min(0, "Los peajes no pueden ser negativos.").max(1_000_000)),
  observaciones: z.preprocess(vacio, z.string().trim().max(500).optional()),
  foto: z.preprocess(vacio, z.string().optional()), // data URL del remito
  ocurridoEn: z.coerce.date().optional(),
});
export type DatosFin = z.input<typeof esquemaFin>;

export type ResultadoFin = {
  km: number;
  costo: number;
  obra: string;
  /** Quién pidió: "Daniela ya sabe que llegó". */
  solicitante: string;
  siguiente: { pedidoId: string; descripcion: string; obra: string; origen: string; salida: string | null } | null;
};

/**
 * "Viaje terminado": km de llegada y peajes UNA vez para todo el viaje. Completa la última parada,
 * deja todos los pedidos ENTREGADOS y reparte el costo entre ellos por tramo (reparto.ts; fórmula en CLAUDE.md).
 */
export async function finalizarViaje(entrada: DatosFin): Promise<Resultado<ResultadoFin>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("viajes.ejecutar");
    const d = esquemaFin.parse(entrada);

    const r = await db.$transaction(async (tx) => {
      const viaje = await tx.viaje.findFirst({
        where: { pedidos: { some: { id: d.pedidoId } } },
        include: {
          vehiculo: true, pedido: { include: { obra: true, solicitante: { select: { nombre: true } } } },
          paradas: { orderBy: { orden: "asc" } },
          viajePedidos: { include: { pedido: { select: { id: true, estado: true, herramientaId: true, obraId: true, obra: { select: { nombre: true } } } } } },
        },
      });
      if (!viaje) throw new ErrorNegocio("No existe ese viaje.");
      if (viaje.choferId !== yo.id) throw new ErrorNegocio("Este viaje no es tuyo.");

      // Reenvío del mismo cierre (sin señal): devolver lo ya calculado.
      if (viaje.clientIdFin === d.clientId) {
        return { km: (viaje.kmLlegada ?? 0) - (viaje.kmSalida ?? 0), costo: Number(viaje.costoCalculado ?? 0), obra: viaje.pedido.obra.nombre, solicitante: viaje.pedido.solicitante.nombre, siguiente: null };
      }
      if (viaje.estado !== "EN_CURSO") throw new ErrorNegocio(viaje.estado === "FINALIZADO" ? "Este viaje ya terminó." : "Este viaje todavía no salió.");
      // Solo cuando la última parada ya llegó (o está todo hecho).
      const faltan = pendientes(viaje.paradas);
      if (faltan.length > 1 || (faltan.length === 1 && faltan[0].estado !== "LLEGO")) {
        throw new ErrorNegocio(`Todavía falta ${faltan[0].tipo === "RETIRO" ? "retirar en" : "entregar en"} ${faltan[0].nombre}.`);
      }
      const kmSalida = viaje.kmSalida ?? viaje.vehiculo.kmActual;
      if (d.kmLlegada < kmSalida) throw new ErrorNegocio(`Los km de llegada no pueden ser menores que los de salida (${fmtKm(kmSalida)}).`);
      const recorridos = d.kmLlegada - kmSalida;
      if (recorridos > 2000) throw new ErrorNegocio("Son más de 2.000 km en un viaje. Revisá el número.");

      const fin = momento(d.ocurridoEn, viaje.salidaReal);
      const llego = viaje.llegadaDestinoEn ?? viaje.llegadaReal ?? faltan[0]?.llegadaEn ?? fin;
      const remitoUrl = d.foto ? await guardarArchivo(tx, d.foto, yo.id, `remito-pedido-${viaje.pedido.numero}`) : null;

      // La última parada: completa (con sus ítems) y sus pedidos entregados.
      const ultima = faltan[0];
      const entregadosAhora = ultima ? viaje.viajePedidos.filter((vp) => vp.paradaEntregaId === ultima.id && vp.pedido.estado !== "ENTREGADO") : [];
      if (ultima) {
        await tx.viajeParada.update({ where: { id: ultima.id }, data: { estado: "COMPLETADA", salidaEn: fin, ...(remitoUrl ? { remitoUrl } : {}) } });
        await tx.itemParada.updateMany({ where: { paradaId: ultima.id, marcado: false, faltante: false }, data: { marcado: true, marcadoEn: fin } });
      }
      for (const vp of viaje.viajePedidos.filter((x) => x.pedido.estado !== "ENTREGADO")) {
        await tx.pedidoViaje.update({ where: { id: vp.pedidoViajeId }, data: { estado: "ENTREGADO" } });
        await alCambiarElViaje(tx, vp.pedidoViajeId, "ENTREGADO", yo.id);
        if (vp.pedido.herramientaId) {
          await alLlegarElViaje(tx, { usuarioId: yo.id, viajeId: viaje.id, herramientaId: vp.pedido.herramientaId, obraId: vp.pedido.obraId, recibidoPorId: (await responsablePrincipal(tx, vp.pedido.obraId))?.id ?? null });
        }
      }

      // Costo = km recorridos × costoKm + peajes, repartido por tramo entre los pedidos (reparto.ts).
      const peajes = new Prisma.Decimal(d.peajes);
      const costo = viaje.vehiculo.costoKm.mul(recorridos).add(peajes);
      const partes = repartirCostos(tramosParaReparto(viaje.paradas, viaje.viajePedidos), { kmReales: recorridos, costoKm: viaje.vehiculo.costoKm.toNumber(), peajes: d.peajes, pedidos: viaje.viajePedidos.map((vp) => vp.pedidoViajeId) });
      for (const vp of viaje.viajePedidos) {
        const p = partes.get(vp.pedidoViajeId)!;
        await tx.viajePedido.update({ where: { id: vp.id }, data: { costoImputado: new Prisma.Decimal(p.costo), kmImputado: p.km, peajesImputado: new Prisma.Decimal(p.peajes) } });
      }

      await tx.viaje.update({
        where: { id: viaje.id },
        data: {
          ...conEtapa("FINALIZADO"), llegadaReal: viaje.llegadaReal ?? llego, kmLlegada: d.kmLlegada, peajes, costoCalculado: costo,
          llegadaDestinoEn: viaje.llegadaDestinoEn ?? llego, salidaRetiroEn: viaje.salidaRetiroEn ?? viaje.llegadaRetiroEn ?? viaje.salidaReal, etaDestino: null, etaRetiro: null,
          remitoUrl, observaciones: d.observaciones ?? null, clientIdFin: d.clientId,
        },
      });
      await tx.vehiculo.update({
        where: { id: viaje.vehiculoId },
        data: { kmActual: Math.max(viaje.vehiculo.kmActual, d.kmLlegada), ...(viaje.vehiculo.estado === "EN_VIAJE" ? { estado: "DISPONIBLE" } : {}) },
      });
      // Aviso de "entregado" a los de la última parada (los de antes ya lo recibieron en su parada).
      for (const vp of entregadosAhora) {
        await notificarEvento(EVENTO.viajeTerminado({ ...(await baseViaje(tx, vp.pedidoViajeId, yo.nombre)), llego, km: recorridos }), { tx, actor: yo.id });
      }
      const reparto = viaje.viajePedidos.length > 1 ? ` · costo repartido: ${viaje.viajePedidos.map((vp) => `${vp.pedido.obra.nombre} $${partes.get(vp.pedidoViajeId)!.costo.toLocaleString("es-AR")}`).join(", ")}` : "";
      await auditar(tx, {
        usuarioId: yo.id, accion: "viaje.finalizar", entidadId: d.pedidoId,
        resumen: `${yo.nombre} terminó el viaje de ${await describirPedido(tx, d.pedidoId)}: ${recorridos} km${reparto}`,
        antes: { estado: "EN_VIAJE" }, despues: { estado: "ENTREGADO", kmLlegada: d.kmLlegada, km: recorridos, peajes: d.peajes, costo: costo.toString(), obra: viaje.pedido.obra.nombre },
      });

      // Lo que sigue hoy en su ruta.
      const sig = await tx.viaje.findFirst({
        where: { choferId: yo.id, estado: "PROGRAMADO", pedido: { estado: "TOMADO", paraCuando: { lte: finDelDia() } } },
        orderBy: [{ ordenRuta: { sort: "asc", nulls: "last" } }, { salidaEstimada: "asc" }],
        include: { pedido: { include: { obra: { select: { nombre: true } } } } },
      });
      return {
        km: recorridos,
        costo: costo.toNumber(),
        obra: viaje.pedido.obra.nombre,
        solicitante: viaje.pedido.solicitante.nombre,
        siguiente: sig ? { pedidoId: sig.pedidoId, descripcion: sig.pedido.descripcion, obra: sig.pedido.obra.nombre, origen: sig.pedido.origenNombre, salida: sig.salidaEstimada ? hora(sig.salidaEstimada) : null } : null,
      };
    });
    refrescar();
    return r;
  });
}

/** Tramos del viaje para el reparto: cada parada con su distancia desde la anterior y los pedidos que se atienden ahí. */
function tramosParaReparto(paradas: { id: string; orden: number; tipo: string; latitud: number; longitud: number; distanciaDesdeAnteriorM: number | null }[], vps: { pedidoViajeId: string; paradaRetiroId: string | null; paradaEntregaId: string }[]) {
  const orden = [...paradas].sort((a, b) => a.orden - b.orden);
  return orden.map((p, i) => ({
    distanciaM: p.distanciaDesdeAnteriorM ?? (i === 0 ? null : Math.round(distancia(puntoDeParada(orden[i - 1]), puntoDeParada(p)) * 1.3)),
    pedidos: vps.filter((vp) => (p.tipo === "RETIRO" ? vp.paradaRetiroId === p.id : vp.paradaEntregaId === p.id)).map((vp) => vp.pedidoViajeId),
  }));
}

// ═══════════════════════════ Combustible ═══════════════════════════

const esquemaCarga = z.object({
  clientId: z.string().uuid(),
  vehiculoId: z.string().min(1, "Elegí el vehículo."),
  litros: z.coerce.number({ error: "Poné los litros." }).positive("Los litros tienen que ser más de cero.").max(600, "Revisá los litros."),
  monto: z.coerce.number({ error: "Poné cuánto pagaste." }).positive("Poné cuánto pagaste.").max(5_000_000),
  km: z.preprocess(vacio, z.coerce.number().int().min(0).optional()),
  foto: z.preprocess(vacio, z.string().optional()),
  ocurridoEn: z.coerce.date().optional(),
});
export type DatosCarga = z.input<typeof esquemaCarga>;

export async function registrarCarga(entrada: DatosCarga): Promise<Resultado<{ obra: string | null }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("combustible.cargar");
    const d = esquemaCarga.parse(entrada);
    const ya = await db.cargaCombustible.findUnique({ where: { clientId: d.clientId }, select: { obra: { select: { nombre: true } } } });
    if (ya) return { obra: ya.obra?.nombre ?? null };

    const r = await db.$transaction(async (tx) => {
      const v = await tx.vehiculo.findUnique({ where: { id: d.vehiculoId } });
      if (!v || !v.activo) throw new ErrorNegocio("Ese vehículo no está activo.");
      if (d.km != null && d.km < v.kmActual - 2000) throw new ErrorNegocio(`${v.nombre} tiene ${fmtKm(v.kmActual)}. Revisá el número.`);
      if (d.km != null && d.km > v.kmActual + 3000) throw new ErrorNegocio(`Son ${fmtKm(d.km - v.kmActual)} más que los registrados. Revisá el número.`);

      // Si el vehículo está en un viaje, la carga se imputa a esa obra.
      const enViaje = await tx.viaje.findFirst({ where: { vehiculoId: v.id, estado: "EN_CURSO" }, select: { pedido: { select: { obraId: true, obra: { select: { nombre: true } } } } } });
      const comprobanteUrl = d.foto ? await guardarArchivo(tx, d.foto, yo.id, `ticket-${v.patente}`) : null;
      const c = await tx.cargaCombustible.create({
        data: {
          clientId: d.clientId, vehiculoId: v.id, usuarioId: yo.id, fecha: momento(d.ocurridoEn),
          litros: new Prisma.Decimal(d.litros), monto: new Prisma.Decimal(d.monto), km: d.km ?? v.kmActual,
          comprobanteUrl, obraId: enViaje?.pedido.obraId ?? null,
        },
      });
      if (d.km != null && d.km > v.kmActual) await tx.vehiculo.update({ where: { id: v.id }, data: { kmActual: d.km } });
      await auditar(tx, { usuarioId: yo.id, accion: "combustible.cargar", entidad: "CargaCombustible", entidadId: c.id, resumen: `${yo.nombre} cargó ${d.litros} l en ${v.nombre}${enViaje ? ` (Obra ${enViaje.pedido.obra.nombre})` : ""}`, despues: { vehiculo: v.nombre, litros: d.litros, monto: d.monto, obra: enViaje?.pedido.obra.nombre ?? null } });
      return { obra: enViaje?.pedido.obra.nombre ?? null };
    });
    refrescar();
    return r;
  });
}
