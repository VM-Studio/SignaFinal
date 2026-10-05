import "server-only";
import type { Prisma, PrismaClient, TipoNotificacion } from "@prisma/client";
import { db } from "@/lib/db";

type Cliente = Prisma.TransactionClient | PrismaClient;

export type Aviso = {
  usuarioId: string;
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo: string;
  enlace?: string;
  datos?: Prisma.InputJsonValue;
};

/**
 * Le avisa algo a una persona: queda en /avisos y suma en la campana.
 * Punto único: el envío push (prompt 5) se engancha acá, sin tocar a quien llama.
 */
export async function notificar(a: Aviso, cliente: Cliente = db) {
  await cliente.notificacion.create({
    data: { usuarioId: a.usuarioId, tipo: a.tipo, titulo: a.titulo, cuerpo: a.cuerpo, enlace: a.enlace ?? null, datos: a.datos },
  });
}
