import type { Prisma, PrismaClient } from "@prisma/client";
import { claveRecordatorio, planRecordatorios } from "./recordatorios-plan";

type Cliente = Prisma.TransactionClient | PrismaClient;

/**
 * Agenda de recordatorios (sin server-only: la usan crearViaje y la carga de datos de prueba).
 * El envío está en recordatorios.ts (job de cada minuto).
 */
export const DEL_VIAJE = ["VIAJE_MANANA", "VIAJE_HOY", "VIAJE_SIN_INICIAR"] as const;

/**
 * Programa los recordatorios de estos pedidos para el chofer que los tiene (al aceptar, al reasignar,
 * al reprogramar). Idempotente por claveUnica; si alguno se había cancelado (soltó y lo volvió a
 * aceptar), vuelve a valer.
 */
export async function programarRecordatorios(cliente: Cliente, pedidoIds: string[], o: { choferId?: string; ahora?: Date } = {}) {
  const ahora = o.ahora ?? new Date();
  const pedidos = await cliente.pedidoViaje.findMany({ where: { id: { in: pedidoIds } }, select: { id: true, paraCuando: true, tomadoPorId: true } });
  for (const p of pedidos) {
    const usuarioId = p.tomadoPorId ?? o.choferId;
    if (!usuarioId) continue;
    for (const r of planRecordatorios(p.paraCuando, ahora)) {
      const claveUnica = claveRecordatorio(usuarioId, p.id, r);
      await cliente.recordatorio.upsert({
        where: { claveUnica },
        create: { usuarioId, tipo: r.tipo, entidadId: p.id, programadoPara: r.programadoPara, claveUnica },
        update: { canceladoEn: null },
      });
    }
  }
}

/** Cancela los que todavía no salieron (al iniciar, soltar, cancelar o reprogramar). */
export async function cancelarRecordatorios(cliente: Cliente, pedidoIds: string[], ahora = new Date()) {
  if (!pedidoIds.length) return 0;
  const r = await cliente.recordatorio.updateMany({ where: { entidadId: { in: pedidoIds }, tipo: { in: [...DEL_VIAJE] }, enviadoEn: null, canceladoEn: null }, data: { canceladoEn: ahora } });
  return r.count;
}
