"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { evaluarAlertas } from "./index";
import { auditar } from "@/lib/auditoria";

/** "Ya la vi": deja de contar en la campana, pero sigue abierta hasta que se resuelva sola. */
export async function marcarVista(id: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("alertas.ver");
    const r = await db.alerta.updateMany({ where: { id, estado: "ABIERTA" }, data: { estado: "VISTA" } });
    if (r.count) {
      const a = await db.alerta.findUnique({ where: { id }, select: { titulo: true } });
      await auditar(db, { usuarioId: yo.id, accion: "alerta.vista", entidad: "Alerta", entidadId: id, resumen: `${yo.nombre} vio la alerta "${a?.titulo ?? ""}"` });
    }
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
