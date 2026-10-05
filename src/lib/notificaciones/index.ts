import "server-only";
import { after } from "next/server";
import webpush from "web-push";
import type { Prisma, PrismaClient, TipoNotificacion } from "@prisma/client";
import { db } from "@/lib/db";

type Cliente = Prisma.TransactionClient | PrismaClient;

export type Contenido = { titulo: string; cuerpo: string; enlace?: string; datos?: Record<string, unknown> };

type Opciones = {
  /** Dentro de una transacción: el aviso se guarda con ella (y la push sale recién después). */
  tx?: Cliente;
  /** Mandar push a sus teléfonos (default sí). */
  push?: boolean;
  /** Copia en la bandeja de Dirección (sin push). */
  copiaDireccion?: boolean;
};

let vapidListo: boolean | null = null;
function vapid() {
  if (vapidListo !== null) return vapidListo;
  const publica = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) return (vapidListo = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "https://signa-final.vercel.app", publica, privada);
  return (vapidListo = true);
}

/** Manda la push de un aviso a cada teléfono activo del usuario. 404/410: la suscripción murió y se desactiva. */
async function enviarPush(notificacionId: string) {
  if (!vapid()) return;
  const n = await db.notificacion.findUnique({ where: { id: notificacionId } });
  if (!n) return; // la transacción no se confirmó
  const subs = await db.suscripcionPush.findMany({ where: { usuarioId: n.usuarioId, activa: true } });
  if (!subs.length) return;
  const cuerpo = JSON.stringify({ titulo: n.titulo, cuerpo: n.cuerpo, enlace: n.enlace ?? "/avisos", tag: n.id });
  let alguna = false;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, cuerpo, { TTL: 3600, urgency: "high" });
        alguna = true;
      } catch (e) {
        const codigo = (e as { statusCode?: number }).statusCode;
        if (codigo === 404 || codigo === 410) await db.suscripcionPush.update({ where: { id: s.id }, data: { activa: false } });
        else console.error("Push falló", codigo ?? e);
      }
    }),
  );
  if (alguna) await db.notificacion.update({ where: { id: n.id }, data: { enviadaPushEn: new Date() } });
}

/** Lo que tarde la push no demora ni rompe la acción: va después de responder. */
function despues(fn: () => Promise<void>) {
  const seguro = () => fn().catch((e) => console.error("Aviso: no se pudo mandar la push", e));
  try {
    after(seguro);
  } catch {
    void seguro(); // fuera de un request (cron, seed)
  }
}

/**
 * Le avisa algo a una persona: queda en su bandeja (/avisos), suma en la campana y, si tiene
 * avisos activados en el teléfono, le llega la push. Nunca hace fallar a quien llama por la push.
 */
export async function notificar(usuarioId: string, tipo: TipoNotificacion, c: Contenido, o: Opciones = {}) {
  const cliente = o.tx ?? db;
  const n = await cliente.notificacion.create({
    data: { usuarioId, tipo, titulo: c.titulo, cuerpo: c.cuerpo, enlace: c.enlace ?? null, datos: (c.datos ?? undefined) as Prisma.InputJsonValue | undefined },
    select: { id: true },
  });
  if (o.copiaDireccion) {
    const direccion = await cliente.usuario.findMany({ where: { rol: "DIRECCION", activo: true, id: { not: usuarioId } }, select: { id: true } });
    if (direccion.length) {
      await cliente.notificacion.createMany({
        data: direccion.map((d) => ({ usuarioId: d.id, tipo, titulo: c.titulo, cuerpo: c.cuerpo, enlace: c.enlace ? c.enlace.replace(/^\/mis-pedidos\//, "/solicitudes/") : null, datos: (c.datos ?? undefined) as Prisma.InputJsonValue | undefined })),
      });
    }
  }
  if (o.push !== false) despues(() => enviarPush(n.id));
  return n.id;
}

/** El mismo aviso a varios (ej.: solicitud urgente a todos los choferes). */
export async function notificarVarios(usuarioIds: string[], tipo: TipoNotificacion, c: Contenido, o: Omit<Opciones, "copiaDireccion"> = {}) {
  for (const id of usuarioIds) await notificar(id, tipo, c, o);
}
