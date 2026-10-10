"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { auditar } from "@/lib/auditoria";
import { lugarEsquema, ubicarLugar } from "@/lib/geo/lugar";
import { revalidar } from "@/lib/revalidar";

const esquema = lugarEsquema.extend({
  id: z.string().optional(),
  nombre: z.string().trim().min(2, "Poné el nombre (ej. \"Terreno Humboldt 2417\").").max(80),
  tipo: z.enum(["DEPOSITO", "BASE_VEHICULOS"]),
  etiqueta: z.enum(["Galpón", "Terreno", "Base"], { error: "Elegí cómo le dice la gente: galpón, terreno o base." }),
  activa: z.boolean().default(true),
});
export type DatosUbicacion = z.input<typeof esquema>;

/** Alta o edición de un depósito, terreno o base (dirección confirmada en el mapa). Nada se borra: se desactiva. */
export async function guardarUbicacion(entrada: DatosUbicacion): Promise<Resultado<{ id: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("ubicaciones.cargar");
    const d = esquema.parse(entrada);
    if (await db.ubicacion.findFirst({ where: { nombre: { equals: d.nombre, mode: "insensitive" }, ...(d.id ? { id: { not: d.id } } : {}) }, select: { id: true } })) throw new ErrorNegocio(`Ya hay un lugar que se llama ${d.nombre}.`);
    if (d.id && !d.activa) {
      const herramientas = await db.herramienta.count({ where: { ubicacionId: d.id, activo: true } });
      const stock = await db.existenciaHerramienta.count({ where: { ubicacionId: d.id, cantidad: { gt: 0 } } });
      if (herramientas + stock) throw new ErrorNegocio(`No se puede desactivar: tiene ${herramientas + stock} herramientas. Pasalas a otro depósito primero.`);
    }
    const punto = await ubicarLugar(d);
    const datos = { nombre: d.nombre, tipo: d.tipo, etiqueta: d.etiqueta, direccion: d.direccion, localidad: d.localidad, latitud: punto.lat, longitud: punto.lng, activa: d.activa };
    const u = d.id ? await db.ubicacion.update({ where: { id: d.id }, data: datos }) : await db.ubicacion.create({ data: datos });
    await auditar(db, { usuarioId: yo.id, accion: d.id ? "ubicacion.editar" : "ubicacion.crear", entidad: "Ubicacion", entidadId: u.id, resumen: `${yo.nombre} ${d.id ? "actualizó" : "cargó"} ${d.etiqueta.toLowerCase()} ${d.nombre} (${d.direccion}, ${d.localidad})${d.activa ? "" : " · desactivado"}` });
    revalidatePath("/configuracion/ubicaciones");
    revalidar("pedidos", "herramientas");
    return { id: u.id };
  });
}
