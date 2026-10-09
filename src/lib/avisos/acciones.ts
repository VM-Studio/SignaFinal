"use server";

import { revalidar } from "@/lib/revalidar";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { pushA } from "@/lib/notificaciones";
import { auditar } from "@/lib/auditoria";

/** Al abrir un aviso: deja de contar en la campana. */
export async function marcarLeida(id: string): Promise<Resultado> {
  return ejecutar(async () => {
    const u = await exigirPermiso("avisos.ver");
    await db.notificacion.updateMany({ where: { id, usuarioId: u.id, leidaEn: null }, data: { leidaEn: new Date() } });
    revalidar("avisos");
    return null;
  });
}

export async function marcarTodasLeidas(): Promise<Resultado<{ cantidad: number }>> {
  return ejecutar(async () => {
    const u = await exigirPermiso("avisos.ver");
    const r = await db.notificacion.updateMany({ where: { usuarioId: u.id, leidaEn: null }, data: { leidaEn: new Date() } });
    if (r.count) await auditar(db, { usuarioId: u.id, accion: "avisos.marcarTodas", entidad: "Usuario", entidadId: u.id, resumen: `${u.nombre} marcó ${r.count} avisos como leídos` });
    revalidar("avisos");
    return { cantidad: r.count };
  });
}

export type ResultadoPrueba = { hora: string; enviadas: number; telefonos: number; resultados: { equipo: string; servicio: string; ok: boolean; codigo: number | null; motivo: string | null }[] };

/** "Enviarme una prueba": push a los dispositivos activos del propio usuario, con la hora en el cuerpo. */
export async function enviarmePrueba(): Promise<Resultado<ResultadoPrueba>> {
  return ejecutar(async () => {
    const u = await exigirPermiso("avisos.ver");
    const hora = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
    const r = await pushA(u.id, { titulo: "Prueba de avisos de SIGNA", cuerpo: `Para ${u.nombre}, enviada a las ${hora}. Si la ves, los avisos llegan a este dispositivo.`, enlace: "/cuenta", tag: `prueba-${Date.now()}` }, "PRUEBA");
    if (r.sinClaves) throw new ErrorNegocio("El servidor no tiene las claves de avisos (VAPID). Avisale a la oficina.");
    if (!r.telefonos) throw new ErrorNegocio("No tenés ningún dispositivo con avisos activados a tu nombre. Tocá “Activar avisos”.");
    await auditar(db, { usuarioId: u.id, accion: "push.prueba", entidad: "Usuario", entidadId: u.id, resumen: `${u.nombre} se mandó una prueba de avisos (${r.enviadas} de ${r.telefonos} dispositivos)` });
    return {
      hora, enviadas: r.enviadas, telefonos: r.telefonos,
      resultados: r.resultados.map((x) => ({ equipo: equipo(x.userAgent), servicio: x.servicio, ok: x.ok, codigo: x.codigo, motivo: x.motivo })),
    };
  });
}

export type Dispositivo = { id: string; usuario: string; equipo: string; activadoEn: string; envio: string | null; estado: string | null; recibido: string | null };

/** "iPhone · Safari", "Mac · Chrome", "Android · Chrome". */
function equipo(ua: string | null) {
  if (!ua) return "Dispositivo";
  const so = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Otro";
  const nav = /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "";
  return nav ? `${so} · ${nav}` : so;
}

/**
 * Diagnóstico de avisos: los dispositivos activados a nombre del usuario,
 * con el último envío, qué respondió Apple/Google y si el teléfono confirmó que la recibió.
 */
export async function estadoDispositivos(): Promise<Resultado<Dispositivo[]>> {
  return ejecutar(async () => {
    const u = await exigirPermiso("avisos.ver");
    const subs = await db.suscripcionPush.findMany({
      where: { activa: true, usuarioId: u.id },
      orderBy: { creadaEn: "desc" },
      include: { usuario: { select: { nombre: true } } },
    });
    return subs.map((s) => ({
      id: s.id, usuario: s.usuario.nombre, equipo: equipo(s.userAgent), activadoEn: s.creadaEn.toISOString(),
      envio: s.ultimoEnvioEn?.toISOString() ?? null, estado: s.ultimoEnvioEstado, recibido: s.ultimaRecepcionEn?.toISOString() ?? null,
    }));
  });
}
