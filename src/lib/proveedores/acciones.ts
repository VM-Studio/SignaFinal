"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { auditar } from "@/lib/auditoria";
import { geocodificar } from "@/lib/geo/geocodificar";

const vacio = (v: unknown) => (v === "" || v == null ? undefined : v);
const esquema = z.object({
  nombre: z.string().trim().min(2, "Poné el nombre del proveedor.").max(80),
  direccion: z.string().trim().min(4, "Poné la dirección (calle y número).").max(120),
  localidad: z.string().trim().min(2, "Poné la localidad.").max(80),
  telefono: z.preprocess(vacio, z.string().trim().max(40).optional()),
});
export type DatosProveedor = z.input<typeof esquema>;

/** Carga a mano un proveedor (mientras no haya API de Lebane), con sus coordenadas por la dirección. */
export async function crearProveedor(entrada: DatosProveedor): Promise<Resultado<{ id: string; encontrada: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("proveedores.cargar");
    const d = esquema.parse(entrada);
    if (await db.proveedor.findFirst({ where: { nombre: { equals: d.nombre, mode: "insensitive" } }, select: { id: true } })) throw new ErrorNegocio(`Ya hay un proveedor que se llama ${d.nombre}.`);
    const punto = await geocodificar(d.direccion, d.localidad);
    if (!punto) throw new ErrorNegocio("No encontramos esa dirección en esa localidad. Revisá la calle y el número, y poné la localidad como figura en el mapa (ej. “Florida”, “Villa Crespo”).");
    const p = await db.proveedor.create({
      data: {
        nombre: d.nombre, telefono: d.telefono ?? null,
        // Toda dirección vive en una sucursal: la primera es la "Casa central".
        sucursales: { create: { nombre: "Casa central", direccion: d.direccion, localidad: d.localidad, telefono: d.telefono ?? null, latitud: punto.lat, longitud: punto.lng, principal: true } },
      },
    });
    await auditar(db, { usuarioId: yo.id, accion: "proveedor.crear", entidad: "Proveedor", entidadId: p.id, resumen: `${yo.nombre} cargó el proveedor ${d.nombre} (${d.direccion}, ${d.localidad})` });
    revalidatePath("/proveedores");
    return { id: p.id, encontrada: punto.encontrada };
  });
}
