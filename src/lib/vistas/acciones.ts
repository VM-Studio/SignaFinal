"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { exigirSesion } from "@/lib/auth/sesion";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";

/**
 * VISTAS GUARDADAS de la barra de filtros: cada usuario guarda sus filtros con un nombre ("Pendientes
 * de retiro", "Pinares") por pantalla. Los parámetros son los de la URL (sin la página).
 */
const PANTALLAS = ["tablero", "compras", "solicitudes", "ordenes", "pedidos", "coordinar"] as const;
const esquema = z.object({
  pantalla: z.enum(PANTALLAS),
  nombre: z.string().trim().min(2, "Ponele un nombre a la vista.").max(40),
  parametros: z.record(z.string(), z.string().max(400)).refine((p) => Object.keys(p).length <= 20),
});

export async function guardarVista(entrada: z.input<typeof esquema>): Promise<Resultado<{ id: string }>> {
  return ejecutar(async () => {
    const u = await exigirSesion();
    const d = esquema.parse(entrada);
    const parametros = Object.fromEntries(Object.entries(d.parametros).filter(([k]) => k !== "pagina" && k !== "ver"));
    if (!Object.keys(parametros).length) throw new ErrorNegocio("Elegí algún filtro antes de guardar la vista.");
    const v = await db.vistaGuardada.upsert({
      where: { usuarioId_pantalla_nombre: { usuarioId: u.id, pantalla: d.pantalla, nombre: d.nombre } },
      create: { usuarioId: u.id, pantalla: d.pantalla, nombre: d.nombre, parametros },
      update: { parametros },
    });
    return { id: v.id };
  });
}

export async function borrarVista(id: string): Promise<Resultado> {
  return ejecutar(async () => {
    const u = await exigirSesion();
    const v = await db.vistaGuardada.findUnique({ where: { id } });
    if (!v || v.usuarioId !== u.id) throw new ErrorNegocio("Esa vista no es tuya.");
    // Una vista es una preferencia del usuario, no un dato del negocio: se borra.
    await db.vistaGuardada.delete({ where: { id } });
    return null;
  });
}
