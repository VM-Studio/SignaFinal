import "server-only";
import { db } from "@/lib/db";
import { aFecha, diaISO, finDelDia } from "@/lib/formato";
import { notificar } from "@/lib/notificaciones";
import { aCombinable, seleccionCombinable } from "./combinar";
import { sugerir } from "./sugerencias";

/**
 * "PIDIERON ALGO MÁS PARA DARWIN": mientras un viaje está aceptado y todavía no salió, si entra un pedido nuevo
 * para una obra del viaje o del mismo lugar de retiro, se le ofrece al chofer (push con "Sí, lo llevo" / "No" y
 * una tarjeta arriba de Hoy). Si ya salió pero todavía no llegó a la primera parada, solo los del mismo lugar de
 * retiro. En cualquier otro momento no se lo interrumpe. Solo pedidos para el día del viaje o antes y que entren
 * en el vehículo. Los que contestó "No" quedan en Viaje.descartados y no se vuelven a ofrecer.
 */

export type Oferta = { viajeId: string; viajePedidoId: string; pedidoId: string; numero: number; titulo: string; detalle: string; obra: string; solicitante: string; grupo: "mismaObra" | "mismoLugar"; lugar: string };

const incluirViaje = {
  pedidos: { select: seleccionCombinable },
  paradas: { select: { estado: true } },
  vehiculo: { select: { nombre: true, capacidadCargaKg: true } },
} as const;

async function ofertasDe(viajeIds: string[], soloPedido?: string): Promise<Oferta[]> {
  const viajes = await db.viaje.findMany({ where: { id: { in: viajeIds } }, include: incluirViaje });
  const out: Oferta[] = [];
  for (const v of viajes) {
    if (!v.pedidos.length) continue;
    const empezo = v.paradas.some((p) => p.estado === "LLEGO" || p.estado === "COMPLETADA");
    if (!(v.estado === "PROGRAMADO" || (v.estado === "EN_CURSO" && !empezo))) continue;
    const dia = [diaISO(), ...v.pedidos.map((p) => diaISO(p.paraCuando))].sort().pop()!;
    const candidatos = await db.pedidoViaje.findMany({
      where: { estado: "PENDIENTE", id: soloPedido ? soloPedido : { notIn: v.descartados }, paraCuando: { lte: finDelDia(aFecha(dia, "12:00")) } },
      select: seleccionCombinable, take: 40, orderBy: { creadoEn: "desc" },
    });
    if (soloPedido && v.descartados.includes(soloPedido)) continue;
    const bases = v.pedidos.map((p) => aCombinable(p));
    const peso = bases.reduce((t, p) => t + (p.pesoKg ?? 0), 0);
    const grupos = v.estado === "EN_CURSO" ? ["mismoLugar"] : ["mismaObra", "mismoLugar"];
    for (const s of sugerir(bases, candidatos.map((c) => aCombinable(c)), { dia })) {
      if (s.gris || !grupos.includes(s.grupo)) continue;
      if (v.vehiculo.capacidadCargaKg > 0 && peso + (s.pedido.pesoKg ?? 0) > v.vehiculo.capacidadCargaKg) continue;
      out.push({ viajeId: v.id, viajePedidoId: v.pedidoId, pedidoId: s.pedido.id, numero: s.pedido.numero, titulo: s.titulo, detalle: s.detalle, obra: s.pedido.destino.obra, solicitante: s.pedido.solicitante, grupo: s.grupo as Oferta["grupo"], lugar: s.lugar });
    }
  }
  return out;
}

/** Hoy del chofer: las tarjetas "Pidieron algo más para Darwin". */
export async function ofertasDelChofer(choferId: string) {
  const viajes = await db.viaje.findMany({ where: { choferId, estado: { in: ["PROGRAMADO", "EN_CURSO"] } }, select: { id: true } });
  return viajes.length ? ofertasDe(viajes.map((v) => v.id)) : [];
}

/** Al crearse un pedido: a qué choferes ofrecérselo (push con "Sí, lo llevo" / "No"). Nunca lanza. */
export async function ofrecerPedidoNuevo(pedidoId: string) {
  try {
    const viajes = await db.viaje.findMany({ where: { estado: { in: ["PROGRAMADO", "EN_CURSO"] } }, select: { id: true } });
    if (!viajes.length) return;
    const ofertas = await ofertasDe(viajes.map((v) => v.id), pedidoId);
    for (const o of ofertas) {
      const v = await db.viaje.findUnique({ where: { id: o.viajeId }, select: { choferId: true, paradas: { orderBy: { orden: "asc" }, select: { id: true }, take: 1 } } });
      if (!v?.paradas[0]) continue;
      const titulo = o.grupo === "mismaObra" ? `Pidieron algo más para ${o.lugar}` : `Hay algo más para retirar en ${o.lugar}`;
      await notificar(v.choferId, "NUEVA_SOLICITUD", {
        titulo,
        cuerpo: `${o.titulo} · ${o.detalle}. Pidió ${o.solicitante}. ¿Lo llevás?`,
        enlace: "/hoy",
        datos: {
          entidad: `oferta:${o.viajeId}:${o.pedidoId}`,
          push: { acciones: [{ action: "si_lo_llevo", title: "Sí, lo llevo" }, { action: "no_lo_llevo", title: "No" }], token: { pedidoId: o.pedidoId, viajeId: o.viajeId, paradaId: v.paradas[0].id, tipo: "SUMAR" } },
        },
      });
    }
  } catch (e) {
    console.error("No se pudo ofrecer el pedido a los choferes", e);
  }
}

/** "No" (en la tarjeta o en la push): no se le vuelve a ofrecer en este viaje. */
export async function descartarOferta(viajeId: string, pedidoId: string) {
  const v = await db.viaje.findUnique({ where: { id: viajeId }, select: { descartados: true } });
  if (v && !v.descartados.includes(pedidoId)) await db.viaje.update({ where: { id: viajeId }, data: { descartados: { push: pedidoId } } });
}
