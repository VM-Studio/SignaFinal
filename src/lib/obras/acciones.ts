"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { auditar } from "@/lib/auditoria";
import { revalidar } from "@/lib/revalidar";
import { geocodificar } from "@/lib/geocodificar";

const esquema = z.object({
  nombre: z.string().trim().min(2, "Poné el nombre de la obra.").max(80),
  direccion: z.string().trim().min(4, "Poné la dirección (calle y número).").max(120),
  localidad: z.string().trim().min(2, "Poné la localidad.").max(80),
  responsables: z.array(z.string()).max(20).default([]),
});
export type DatosObra = z.input<typeof esquema>;

/**
 * Carga a mano una obra (mientras no haya API de Lebane). Busca sus coordenadas por la dirección
 * para el mapa, el ruteo y el GPS. El primer responsable elegido queda como principal.
 */
export async function crearObra(entrada: DatosObra): Promise<Resultado<{ id: string; encontrada: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("obras.cargar");
    const d = esquema.parse(entrada);
    if (await db.obra.findFirst({ where: { nombre: { equals: d.nombre, mode: "insensitive" } }, select: { id: true } })) throw new ErrorNegocio(`Ya hay una obra que se llama ${d.nombre}.`);
    const punto = await geocodificar(d.direccion, d.localidad);
    if (!punto) throw new ErrorNegocio("No encontramos esa dirección en esa localidad. Revisá la calle y el número, y poné la localidad como figura en el mapa (ej. “Florida”, “Villa Crespo”).");
    const responsables = await db.usuario.findMany({ where: { id: { in: d.responsables }, rol: "RESPONSABLE_OBRA", activo: true }, select: { id: true, nombre: true } });
    const obra = await db.$transaction(async (tx) => {
      const n = (await tx.obra.count()) + 1;
      const o = await tx.obra.create({ data: { nombre: d.nombre, codigo: `OB-${String(n).padStart(3, "0")}-${Date.now().toString(36).slice(-3)}`, direccion: d.direccion, localidad: d.localidad, latitud: punto.lat, longitud: punto.lng } });
      for (const [i, id] of d.responsables.filter((x) => responsables.some((r) => r.id === x)).entries()) {
        await tx.responsableObra.create({ data: { obraId: o.id, usuarioId: id, principal: i === 0 } });
      }
      await auditar(tx, {
        usuarioId: yo.id, accion: "obra.crear", entidad: "Obra", entidadId: o.id,
        resumen: `${yo.nombre} cargó la Obra ${d.nombre} (${d.direccion}, ${d.localidad})${responsables.length ? `, a cargo de ${responsables.map((r) => r.nombre).join(" y ")}` : ""}`,
      });
      return o;
    });
    revalidar("pedidos", "usuarios", "herramientas");
    return { id: obra.id, encontrada: punto.encontrada };
  });
}
