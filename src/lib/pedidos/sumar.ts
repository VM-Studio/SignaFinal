import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { diaISO } from "@/lib/formato";
import { ErrorNegocio } from "@/lib/resultado";
import { auditar, describirPedido } from "./reglas";
import { aPedidoParaParadas, armarParadas, quitarDelViaje, rearmarParadas, selectPedidoParadas } from "@/lib/viajes/paradas";
import { validarCombinacion } from "@/lib/viajes/sugerencias";
import { planificarOrden } from "@/lib/viajes/combinar";
import { arrancarParadas } from "@/lib/viajes/motor";
import { programarRecordatorios } from "@/lib/viajes/recordatorios-agenda";
import { diaSemana } from "@/lib/viajes/fecha";
import { baseViaje, notificarEvento } from "@/lib/notificaciones/enviar";
import { EVENTO } from "@/lib/notificaciones/eventos";
import { alCambiarElViaje } from "@/lib/materiales/circuito";

/**
 * SUMAR PEDIDOS A UN VIAJE (solo servidor; NO es una Server Action: recibe al chofer ya verificado). Lo usan
 * aceptar, "Agregar parada", la tarjeta "Pidieron algo más…" de Hoy y el botón "Sí, lo llevo" de la push.
 */

/**
 * Suma pedidos a un viaje (al aceptar o con "Agregar parada"): los pendientes pasan a ser del chofer y
 * los suyos de otro viaje programado se mudan a este. Valida capacidad, paradas y fechas. Devuelve los
 * que sumó (para los avisos).
 */
export async function sumarAlViaje(tx: Prisma.TransactionClient, yo: { id: string }, base: { id: string; paraCuando: Date }[], extras: string[]) {
  if (!extras.length) return [];
  const dia = [diaISO(), ...base.map((p) => diaISO(p.paraCuando))].sort().pop()!;
  const filas = await tx.pedidoViaje.findMany({ where: { id: { in: extras } }, select: { id: true, estado: true, tomadoPorId: true, paraCuando: true, descripcion: true, tipo: true, pesoKg: true, tomadoPor: { select: { nombre: true } }, obra: { select: { nombre: true } }, viaje: { select: { estado: true } } } });
  for (const id of extras) {
    const p = filas.find((x) => x.id === id);
    if (!p) throw new ErrorNegocio("Uno de los pedidos ya no existe.");
    if (diaISO(p.paraCuando) > dia) throw new ErrorNegocio(`El pedido de ${p.descripcion} es para otro día: no se puede combinar.`);
    if (p.estado === "PENDIENTE") {
      const r = await tx.pedidoViaje.updateMany({ where: { id, estado: "PENDIENTE" }, data: { estado: "TOMADO", tomadoPorId: yo.id, tomadoEn: new Date() } });
      if (!r.count) {
        const ahora = await tx.pedidoViaje.findUniqueOrThrow({ where: { id }, select: { tomadoPor: { select: { nombre: true } } } });
        throw new ErrorNegocio(`Ya lo aceptó ${ahora.tomadoPor?.nombre ?? "otro chofer"}: ${p.descripcion} para ${p.obra.nombre}. Volvé a mirar las sugerencias.`);
      }
    } else if (p.estado === "TOMADO" && p.tomadoPorId === yo.id && p.viaje?.estado === "PROGRAMADO") {
      await quitarDelViaje(tx, id); // se muda a este viaje
    } else {
      throw new ErrorNegocio(p.tomadoPor ? `Ya lo aceptó ${p.tomadoPor.nombre}: ${p.descripcion}.` : `El pedido de ${p.descripcion} ya no está disponible.`);
    }
  }
  return filas;
}

/** Valida la combinación completa (capacidad del vehículo, máximo de paradas, personas con escombros). */
export async function validarViajeCombinado(tx: Prisma.TransactionClient, pedidoIds: string[], vehiculo: { nombre: string; capacidadCargaKg: number }) {
  const pedidos = await tx.pedidoViaje.findMany({ where: { id: { in: pedidoIds } }, select: { ...selectPedidoParadas, tipo: true, pesoKg: true } });
  const paradas = armarParadas(pedidos.map((p) => aPedidoParaParadas(p))).paradas.length;
  const error = validarCombinacion(pedidos, vehiculo, paradas);
  if (error) throw new ErrorNegocio(error);
}

/**
 * Lo de "Agregar parada" para un chofer ya identificado (la pantalla, la tarjeta "Pidieron algo más…" o el
 * botón "Sí, lo llevo" de la notificación). A cada solicitante sumado le llega "Claudio lo suma al viaje de hoy".
 */
export async function sumarPedidosComo(yo: { id: string; nombre: string }, pedidoId: string, extrasPedidos: string[]) {
  const r = await db.$transaction(async (tx) => {
    const v = await tx.viaje.findFirst({
      where: { pedidos: { some: { id: pedidoId } } },
      include: { pedidos: { select: { id: true, paraCuando: true } }, paradas: { select: { estado: true } }, vehiculo: { select: { nombre: true, capacidadCargaKg: true } } },
    });
    if (!v || v.choferId !== yo.id) throw new ErrorNegocio("Este viaje no es tuyo.");
    const empezo = v.paradas.some((p) => p.estado === "LLEGO" || p.estado === "COMPLETADA");
    if (!(v.estado === "PROGRAMADO" || (v.estado === "EN_CURSO" && !empezo))) throw new ErrorNegocio("Ya llegaste a la primera parada: no se pueden sumar más.");
    const extras = [...new Set(extrasPedidos)].filter((id) => !v.pedidos.some((p) => p.id === id));
    if (!extras.length) return { viajeId: v.id, agregados: 0 };
    await sumarAlViaje(tx, yo, v.pedidos, extras);
    const ids = [...v.pedidos.map((p) => p.id), ...extras];
    await validarViajeCombinado(tx, ids, v.vehiculo);
    await tx.pedidoViaje.updateMany({ where: { id: { in: extras } }, data: { viajeId: v.id } });
    await rearmarParadas(tx, v.id, ids);
    if (v.estado === "EN_CURSO") {
      await arrancarParadas(tx, v.id, null, new Date());
      await tx.pedidoViaje.updateMany({ where: { id: { in: extras } }, data: { estado: "EN_VIAJE" } });
    } else {
      await programarRecordatorios(tx, extras);
    }
    const salida = v.salidaEstimada ?? new Date();
    const suma = diaISO(salida) === diaISO() ? "lo suma al viaje de hoy" : `lo suma a su viaje del ${diaSemana(salida)}`;
    for (const id of extras) {
      await alCambiarElViaje(tx, id, v.estado === "EN_CURSO" ? "EN_VIAJE" : "TOMADO", yo.id);
      await auditar(tx, { usuarioId: yo.id, accion: "pedido.tomar", entidadId: id, resumen: `${yo.nombre} sumó ${await describirPedido(tx, id)} a su viaje con ${v.vehiculo.nombre} (${ids.length} pedidos)`, antes: { estado: "PENDIENTE" }, despues: { estado: "TOMADO", chofer: yo.nombre } });
      await notificarEvento(EVENTO.pedidoAceptado({ ...(await baseViaje(tx, id, yo.nombre)), choferId: yo.id, salida, vehiculo: v.vehiculo.nombre, combinado: suma }), { tx, actor: yo.id });
    }
    return { viajeId: v.id, agregados: extras.length };
  });
  if (r.agregados) await planificarOrden(r.viajeId);
  return { agregados: r.agregados };
}

