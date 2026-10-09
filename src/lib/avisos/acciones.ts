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

/** "Enviarme una prueba": una push al propio usuario, a todos sus celulares activados. */
export async function enviarmePrueba(): Promise<Resultado<{ enviadas: number; telefonos: number }>> {
  return ejecutar(async () => {
    const u = await exigirPermiso("avisos.ver");
    const r = await pushA(u.id, { titulo: "Prueba de avisos de SIGNA", cuerpo: `Hola ${u.nombre}: si ves esto, los avisos llegan a este celular.`, enlace: "/cuenta", tag: `prueba-${Date.now()}` });
    if (r.sinClaves) throw new ErrorNegocio("El servidor no tiene las claves de avisos (VAPID). Avisale a la oficina.");
    if (!r.telefonos) throw new ErrorNegocio("Todavía no activaste los avisos en ningún celular. Tocá “Activar avisos en este celular”.");
    if (!r.enviadas) throw new ErrorNegocio("No se pudo mandar. Desactivá y volvé a activar los avisos en este celular.");
    await auditar(db, { usuarioId: u.id, accion: "push.prueba", entidad: "Usuario", entidadId: u.id, resumen: `${u.nombre} se mandó una prueba de avisos (${r.enviadas} de ${r.telefonos} celulares)` });
    return { enviadas: r.enviadas, telefonos: r.telefonos };
  });
}
