"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { evaluarAlertas } from "./index";

/** "Ya la vi": deja de contar en la campana, pero sigue abierta hasta que se resuelva sola. */
export async function marcarVista(id: string): Promise<Resultado> {
  return ejecutar(async () => {
    await exigirPermiso("alertas.ver");
    await db.alerta.updateMany({ where: { id, estado: "ABIERTA" }, data: { estado: "VISTA" } });
    revalidatePath("/", "layout");
    return null;
  });
}

export async function revisarAhora(): Promise<Resultado<{ activas: number }>> {
  return ejecutar(async () => {
    const u = await exigirPermiso("alertas.ver");
    if (!puede(u.rol, "costos.ver")) throw new ErrorNegocio("Solo Dirección y Administración.");
    const r = await evaluarAlertas();
    revalidatePath("/", "layout");
    return { activas: r.activas };
  });
}
