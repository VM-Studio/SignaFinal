"use server";

import { revalidar } from "@/lib/revalidar";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { avisosATodos, pushA } from "@/lib/notificaciones";
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

/** "Enviarme una prueba": una push al propio usuario, a todos sus celulares activados. */
export async function enviarmePrueba(): Promise<Resultado<{ enviadas: number; telefonos: number }>> {
  return ejecutar(async () => {
    const u = await exigirPermiso("avisos.ver");
    // En modo prueba de avisos va a todos los dispositivos activados.
    const r = await pushA(avisosATodos() ? null : u.id, { titulo: "Prueba de avisos de SIGNA", cuerpo: `${u.nombre} mandó una prueba: si ves esto, los avisos llegan a este dispositivo.`, enlace: "/cuenta", tag: `prueba-${Date.now()}` });
    if (r.sinClaves) throw new ErrorNegocio("El servidor no tiene las claves de avisos (VAPID). Avisale a la oficina.");
    if (!r.telefonos) throw new ErrorNegocio("Todavía no activaste los avisos en ningún celular. Tocá “Activar avisos en este celular”.");
    if (!r.enviadas) throw new ErrorNegocio("No se pudo mandar. Desactivá y volvé a activar los avisos en este celular.");
    await auditar(db, { usuarioId: u.id, accion: "push.prueba", entidad: "Usuario", entidadId: u.id, resumen: `${u.nombre} se mandó una prueba de avisos (${r.enviadas} de ${r.telefonos} celulares)` });
    return { enviadas: r.enviadas, telefonos: r.telefonos };
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
 * Diagnóstico de avisos: los dispositivos activados (en modo prueba, todos; si no, los propios),
 * con el último envío, qué respondió Apple/Google y si el teléfono confirmó que la recibió.
 */
export async function estadoDispositivos(): Promise<Resultado<Dispositivo[]>> {
  return ejecutar(async () => {
    const u = await exigirPermiso("avisos.ver");
    const subs = await db.suscripcionPush.findMany({
      where: { activa: true, ...(avisosATodos() ? {} : { usuarioId: u.id }) },
      orderBy: { creadaEn: "desc" },
      include: { usuario: { select: { nombre: true } } },
    });
    return subs.map((s) => ({
      id: s.id, usuario: s.usuario.nombre, equipo: equipo(s.userAgent), activadoEn: s.creadaEn.toISOString(),
      envio: s.ultimoEnvioEn?.toISOString() ?? null, estado: s.ultimoEnvioEstado, recibido: s.ultimaRecepcionEn?.toISOString() ?? null,
    }));
  });
}
