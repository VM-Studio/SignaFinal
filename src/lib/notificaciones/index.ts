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
};

/** Dos avisos iguales (mismo usuario, tipo y entidad) dentro de este tiempo se colapsan en uno. */
const DEDUPLICAR_MS = 60_000;
/** Ninguna push espera más que esto. */
const TIMEOUT_PUSH_MS = 5_000;

let vapidListo: boolean | null = null;
function vapid() {
  if (vapidListo !== null) return vapidListo;
  const publica = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) return (vapidListo = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "https://signa-final.vercel.app", publica, privada);
  return (vapidListo = true);
}

/**
 * Manda una push a cada teléfono activo del usuario, en paralelo y con 5 s de límite cada una.
 * 404/410: la suscripción murió y se desactiva sola. Devuelve a cuántos teléfonos llegó.
 */
export async function pushA(usuarioId: string, contenido: { titulo: string; cuerpo: string; enlace: string | null; tag: string }) {
  if (!vapid()) return { enviadas: 0, telefonos: 0, sinClaves: true };
  const subs = await db.suscripcionPush.findMany({ where: { usuarioId, activa: true } });
  const cuerpo = JSON.stringify({ ...contenido, enlace: contenido.enlace ?? "/avisos" });
  const r = await Promise.allSettled(
    subs.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, cuerpo, { TTL: 3600, urgency: "high", timeout: TIMEOUT_PUSH_MS })),
  );
  await Promise.all(
    r.map(async (x, i) => {
      if (x.status === "fulfilled") return;
      const codigo = (x.reason as { statusCode?: number }).statusCode;
      if (codigo === 404 || codigo === 410) await db.suscripcionPush.update({ where: { id: subs[i].id }, data: { activa: false } });
      else console.error("Push falló", codigo ?? x.reason);
    }),
  );
  return { enviadas: r.filter((x) => x.status === "fulfilled").length, telefonos: subs.length, sinClaves: false };
}

async function enviarPush(notificacionId: string) {
  const n = await db.notificacion.findUnique({ where: { id: notificacionId } });
  if (!n) return; // la transacción no se confirmó
  const { enviadas } = await pushA(n.usuarioId, { titulo: n.titulo, cuerpo: n.cuerpo, enlace: n.enlace, tag: n.id });
  if (enviadas) await db.notificacion.update({ where: { id: n.id }, data: { enviadaPushEn: new Date() } });
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
 * Le avisa algo a UNA persona: queda en su bandeja (/avisos), suma en la campana y, con push, le
 * llega al teléfono. Las actions no la llaman directo: usan notificarEvento (la matriz de eventos.ts).
 * Dos avisos iguales (mismo usuario, tipo y datos.entidad) en 60 s se colapsan: devuelve null.
 * Nunca hace fallar a quien llama por la push.
 */
export async function notificar(usuarioId: string, tipo: TipoNotificacion, c: Contenido, o: Opciones = {}) {
  const cliente = o.tx ?? db;
  const entidad = c.datos?.entidad;
  if (typeof entidad === "string") {
    const igual = await cliente.notificacion.findFirst({
      where: { usuarioId, tipo, creadaEn: { gte: new Date(Date.now() - DEDUPLICAR_MS) }, datos: { path: ["entidad"], equals: entidad } },
      select: { id: true },
    });
    if (igual) return null;
  }
  const n = await cliente.notificacion.create({
    data: { usuarioId, tipo, titulo: c.titulo, cuerpo: c.cuerpo, enlace: c.enlace ?? null, datos: (c.datos ?? undefined) as Prisma.InputJsonValue | undefined },
    select: { id: true },
  });
  if (o.push !== false) despues(() => enviarPush(n.id));
  return n.id;
}
