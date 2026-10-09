import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { notificar } from "./index";
import { resolverDestinatarios, type Persona } from "./destinatarios";
import type { Evento, V } from "./eventos";

type Cliente = Prisma.TransactionClient | PrismaClient;

/** Usuarios activos con su rol y las obras donde son responsables (para la matriz). */
async function personas(cliente: Cliente): Promise<Persona[]> {
  const us = await cliente.usuario.findMany({
    where: { activo: true },
    select: { id: true, rol: true, obrasACargo: { where: { activo: true }, select: { obraId: true } } },
  });
  return us.map((u) => ({ id: u.id, rol: u.rol, obras: u.obrasACargo.map((o) => o.obraId) }));
}

/**
 * Manda un evento de la matriz (eventos.ts): resuelve a quién le llega, con qué enlace y si va
 * con push; nadie recibe algo que no puede abrir (queda en el log). Dentro de una transacción,
 * el aviso se guarda con ella y la push sale recién después de responder.
 */
export async function notificarEvento(evento: Evento | null, o: { tx?: Cliente; actor?: string | null } = {}) {
  if (!evento) return [];
  const cliente = o.tx ?? db;
  const { entregas, descartes } = resolverDestinatarios(evento.para, await personas(cliente), { enlace: evento.enlace, obraId: evento.obraId, actor: o.actor });
  for (const d of descartes) console.info(`Aviso ${evento.nombre} no enviado a ${d.usuarioId}: ${d.motivo}`);
  const ids: string[] = [];
  for (const e of entregas) {
    const id = await notificar(e.usuarioId, evento.tipo, { titulo: evento.titulo, cuerpo: evento.cuerpo, enlace: e.enlace ?? undefined, datos: { ...evento.datos, entidad: evento.entidad, evento: evento.nombre } }, { tx: cliente, push: e.push });
    if (id) ids.push(id);
  }
  return ids;
}

/** Lo común de los avisos de un pedido de viaje (quién pidió, obra, chofer, material de Compras). */
export async function baseViaje(cliente: Cliente, pedidoId: string, chofer?: string): Promise<V> {
  const p = await cliente.pedidoViaje.findUniqueOrThrow({
    where: { id: pedidoId },
    select: { id: true, numero: true, solicitanteId: true, obraId: true, descripcion: true, destinoNombre: true, tomadoPor: { select: { nombre: true } }, materialesListos: { take: 1, select: { pedidoMaterialId: true } } },
  });
  return {
    pedidoId: p.id, numero: p.numero, solicitanteId: p.solicitanteId, obraId: p.obraId, descripcion: p.descripcion, destino: p.destinoNombre,
    chofer: chofer ?? p.tomadoPor?.nombre ?? "El chofer", pedidoMaterialId: p.materialesListos[0]?.pedidoMaterialId ?? null,
  };
}
