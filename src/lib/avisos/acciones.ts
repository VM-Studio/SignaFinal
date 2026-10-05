"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ejecutar, type Resultado } from "@/lib/resultado";

/** Al abrir /avisos: lo que se vio deja de contar en la campana. */
export async function marcarAvisosLeidos(): Promise<Resultado> {
  return ejecutar(async () => {
    const u = await exigirPermiso("avisos.ver");
    const r = await db.notificacion.updateMany({ where: { usuarioId: u.id, leidaEn: null }, data: { leidaEn: new Date() } });
    if (r.count) revalidatePath("/", "layout");
    return null;
  });
}
