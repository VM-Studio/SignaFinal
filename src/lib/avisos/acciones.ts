"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ejecutar, type Resultado } from "@/lib/resultado";

/** Al abrir un aviso: deja de contar en la campana. */
export async function marcarLeida(id: string): Promise<Resultado> {
  return ejecutar(async () => {
    const u = await exigirPermiso("avisos.ver");
    await db.notificacion.updateMany({ where: { id, usuarioId: u.id, leidaEn: null }, data: { leidaEn: new Date() } });
    revalidatePath("/", "layout");
    return null;
  });
}

export async function marcarTodasLeidas(): Promise<Resultado<{ cantidad: number }>> {
  return ejecutar(async () => {
    const u = await exigirPermiso("avisos.ver");
    const r = await db.notificacion.updateMany({ where: { usuarioId: u.id, leidaEn: null }, data: { leidaEn: new Date() } });
    revalidatePath("/", "layout");
    return { cantidad: r.count };
  });
}
