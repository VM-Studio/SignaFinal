"use server";

import { revalidar } from "@/lib/revalidar";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ejecutar, type Resultado } from "@/lib/resultado";
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
