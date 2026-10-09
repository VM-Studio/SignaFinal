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

/** Qué claves VAPID faltan en el servidor (sin mostrarlas). Vacío = todo bien. */
export function vapidFaltantes() {
  return [
    !(process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) && "VAPID_PUBLIC_KEY",
    !process.env.VAPID_PRIVATE_KEY && "VAPID_PRIVATE_KEY",
    !process.env.VAPID_SUBJECT && "VAPID_SUBJECT",
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  ].filter((x): x is string => !!x);
}

let vapidListo: boolean | null = null;
function vapid() {
  if (vapidListo !== null) return vapidListo;
  const publica = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) {
    console.error(`AVISOS PUSH APAGADOS: faltan ${vapidFaltantes().join(", ")} en el entorno.`);
    return (vapidListo = false);
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "https://signa-final.vercel.app", publica, privada);
  return (vapidListo = true);
}

/**
 * Modo prueba de avisos: SOLO con AVISOS_A_TODOS=true. Cada aviso de cualquier usuario llega con
 * push a TODOS los dispositivos activados, diciendo para quién es. Apagado, cada push va solo a los
 * dispositivos activos del usuario al que le corresponde (lo normal).
 */
export const avisosATodos = () => process.env.AVISOS_A_TODOS === "true";

/** Por qué falló una push, en palabras (Mi cuenta → diagnóstico). */
export function motivoPush(codigo: number | undefined, error: string) {
  if (codigo === 404 || codigo === 410) return `La suscripción de este dispositivo venció (${codigo}). Tocá "Activar avisos" de nuevo.`;
  if (codigo === 401 || codigo === 403) return `El servicio de push rechazó las claves del servidor (${codigo}): revisar VAPID.`;
  if (codigo === 413) return "El aviso era demasiado largo (413).";
  if (codigo === 429) return "El servicio de push pidió esperar (429): demasiados envíos seguidos.";
  if (!codigo) return `Sin respuesta del servicio de push: ${error || "tiempo agotado"}.`;
  return `El servicio de push respondió ${codigo}: ${error}`.trim();
}

export type ResultadoPush = { suscripcionId: string; userAgent: string | null; servicio: string; ok: boolean; codigo: number | null; motivo: string | null };

/** "Apple", "Google", "Mozilla" según quién entrega la push en ese dispositivo. */
export const servicioPush = (endpoint: string) => (/apple\.com/.test(endpoint) ? "Apple" : /googleapis|google\.com/.test(endpoint) ? "Google" : /mozilla|mozaws/.test(endpoint) ? "Mozilla" : new URL(endpoint).host);

/**
 * Manda una push a cada dispositivo ACTIVO del usuario (o a todos, con usuarioId null en modo
 * prueba), en paralelo y con 5 s de límite cada una. Cada intento queda en EnvioPush. 404/410: la
 * suscripción murió y se desactiva sola. Nunca lanza.
 */
export async function pushA(usuarioId: string | null, contenido: { titulo: string; cuerpo: string; enlace: string | null; tag: string }, tipo = "GENERAL") {
  if (!vapid()) return { enviadas: 0, telefonos: 0, sinClaves: true, resultados: [] as ResultadoPush[] };
  const subs = await db.suscripcionPush.findMany({ where: { activa: true, ...(usuarioId ? { usuarioId } : {}) } });
  // "url" para el service worker; "enlace" por compatibilidad con la versión anterior.
  const cuerpo = JSON.stringify({ ...contenido, url: contenido.enlace ?? "/avisos", enlace: contenido.enlace ?? "/avisos" });
  const mandar = (s: (typeof subs)[number]) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, cuerpo, { TTL: 3600, urgency: "high", timeout: TIMEOUT_PUSH_MS });
  const r = await Promise.allSettled(
    // Si no hubo respuesta (red, primera conexión lenta), se reintenta UNA vez; si el servicio contestó un error, no.
    subs.map((s) => mandar(s).catch((e: { statusCode?: number }) => (e?.statusCode ? Promise.reject(e) : mandar(s)))),
  );
  const ahora = new Date();
  const resultados = await Promise.all(
    r.map(async (x, i): Promise<ResultadoPush> => {
      const s = subs[i];
      const base = { suscripcionId: s.id, userAgent: s.userAgent, servicio: servicioPush(s.endpoint) };
      if (x.status === "fulfilled") {
        await db.$transaction([
          db.suscripcionPush.update({ where: { id: s.id }, data: { ultimoEnvioEn: ahora, ultimoEnvioEstado: `aceptada (${x.value.statusCode})` } }),
          db.envioPush.create({ data: { usuarioId: s.usuarioId, suscripcionId: s.id, tipo, estado: "ENVIADA", codigoRespuesta: x.value.statusCode } }),
        ]);
        return { ...base, ok: true, codigo: x.value.statusCode, motivo: null };
      }
      const codigo = (x.reason as { statusCode?: number }).statusCode;
      const error = String((x.reason as { body?: string }).body || (x.reason as Error).message || "").trim().slice(0, 200);
      const motivo = motivoPush(codigo, error);
      await db.$transaction([
        db.suscripcionPush.update({ where: { id: s.id }, data: { ultimoEnvioEn: ahora, ultimoEnvioEstado: `rechazada (${codigo ?? "sin respuesta"})`, ...(codigo === 404 || codigo === 410 ? { activa: false } : {}) } }),
        db.envioPush.create({ data: { usuarioId: s.usuarioId, suscripcionId: s.id, tipo, estado: "FALLIDA", codigoRespuesta: codigo ?? null, error: error || null } }),
      ]);
      console.error("Push falló", codigo ?? "sin respuesta", error);
      return { ...base, ok: false, codigo: codigo ?? null, motivo };
    }),
  );
  return { enviadas: resultados.filter((x) => x.ok).length, telefonos: subs.length, sinClaves: false, resultados };
}

/** Modo prueba: eventos ya mandados (una sola push por evento aunque sea para varios). */
const yaMandados = new Map<string, number>();

async function enviarPush(notificacionId: string) {
  const n = await db.notificacion.findUnique({ where: { id: notificacionId }, include: { usuario: { select: { nombre: true } } } });
  if (!n) return; // la transacción no se confirmó
  const entidad = (n.datos as { entidad?: string } | null)?.entidad;
  // Tag = la clave del aviso: el mismo evento repetido reemplaza al anterior en vez de apilarse.
  const clave = entidad ? `${n.tipo}:${entidad}` : n.id;
  if (!avisosATodos()) {
    const { enviadas } = await pushA(n.usuarioId, { titulo: n.titulo, cuerpo: n.cuerpo, enlace: n.enlace, tag: clave }, n.tipo);
    if (enviadas) await db.notificacion.update({ where: { id: n.id }, data: { enviadaPushEn: new Date() } });
    return;
  }
  // Modo prueba: a TODOS los dispositivos, una vez por evento, diciendo para quiénes es.
  const ahora = Date.now();
  for (const [k, t] of yaMandados) if (ahora - t > 60_000) yaMandados.delete(k);
  if (yaMandados.has(clave)) return;
  yaMandados.set(clave, ahora);
  const para = entidad
    ? await db.notificacion.findMany({
        where: { tipo: n.tipo, creadaEn: { gte: new Date(n.creadaEn.getTime() - 5_000) }, datos: { path: ["entidad"], equals: entidad } },
        select: { usuario: { select: { nombre: true } } },
      })
    : [{ usuario: n.usuario }];
  const nombres = [...new Set(para.map((x) => x.usuario.nombre))];
  const quienes = nombres.length <= 1 ? nombres.join("") : `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
  const { enviadas } = await pushA(null, { titulo: `Para ${quienes} · ${n.titulo}`, cuerpo: n.cuerpo, enlace: n.enlace, tag: clave }, n.tipo);
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
  if (o.push !== false || avisosATodos()) despues(() => enviarPush(n.id));
  return n.id;
}
