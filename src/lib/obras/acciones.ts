"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { auditar } from "@/lib/auditoria";
import { revalidar } from "@/lib/revalidar";
import { lugarEsquema, ubicarLugar } from "@/lib/geo/lugar";

const esquemaObra = lugarEsquema.extend({
  nombre: z.string().trim().min(2, "Poné el nombre de la obra.").max(80),
  responsables: z.array(z.string()).max(20).default([]),
  radioGeocercaM: z.coerce.number().int().min(50, "El radio mínimo es 50 m.").max(2000, "El radio máximo es 2.000 m.").default(200),
});
export type DatosObra = z.input<typeof esquemaObra>;

const ROLES_RESPONSABLE = ["RESPONSABLE_OBRA", "CAPATAZ"] as const;

/** Los responsables, en orden: el primero es el principal. Solo responsables de obra y capataz activos. */
async function responsablesValidos(ids: string[]) {
  const us = await db.usuario.findMany({ where: { id: { in: ids }, rol: { in: [...ROLES_RESPONSABLE] }, activo: true }, select: { id: true, nombre: true } });
  return ids.map((id) => us.find((u) => u.id === id)).filter((u): u is { id: string; nombre: string } => !!u);
}

/**
 * Alta de obra (también la alta rápida de "Pedir materiales"): nombre, dirección confirmada en el mapa
 * (SelectorDireccion), localidad, responsables y radio de la geocerca. Devuelve la obra creada.
 */
export async function crearObra(entrada: DatosObra): Promise<Resultado<{ id: string; nombre: string; localidad: string; direccion: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("obras.cargar");
    const d = esquemaObra.parse(entrada);
    if (await db.obra.findFirst({ where: { nombre: { equals: d.nombre, mode: "insensitive" } }, select: { id: true } })) throw new ErrorNegocio(`Ya hay una obra que se llama ${d.nombre}.`);
    const punto = await ubicarLugar(d);
    const responsables = await responsablesValidos(d.responsables);
    const obra = await db.$transaction(async (tx) => {
      const n = (await tx.obra.count()) + 1;
      const o = await tx.obra.create({
        data: { nombre: d.nombre, codigo: `OB-${String(n).padStart(3, "0")}-${Date.now().toString(36).slice(-3)}`, direccion: d.direccion, localidad: d.localidad, latitud: punto.lat, longitud: punto.lng, radioGeocercaM: d.radioGeocercaM },
      });
      for (const [i, r] of responsables.entries()) await tx.responsableObra.create({ data: { obraId: o.id, usuarioId: r.id, principal: i === 0 } });
      await auditar(tx, {
        usuarioId: yo.id, accion: "obra.crear", entidad: "Obra", entidadId: o.id,
        resumen: `${yo.nombre} cargó la Obra ${d.nombre} (${d.direccion}, ${d.localidad})${responsables.length ? `, a cargo de ${responsables.map((r) => r.nombre).join(" y ")}` : ""}`,
      });
      return o;
    });
    revalidar("pedidos", "usuarios", "herramientas", "materiales");
    return { id: obra.id, nombre: obra.nombre, localidad: obra.localidad, direccion: obra.direccion };
  });
}

const esquemaEditar = esquemaObra.extend({ id: z.string().min(1), estado: z.enum(["ACTIVA", "PAUSADA", "FINALIZADA"]) });
export type DatosEditarObra = z.input<typeof esquemaEditar>;

/** Edición de obra: datos, dirección, estado y responsables (los que salen quedan inactivos: nada se borra). */
export async function editarObra(entrada: DatosEditarObra): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("obras.cargar");
    const d = esquemaEditar.parse(entrada);
    const antes = await db.obra.findUnique({ where: { id: d.id }, include: { responsables: { where: { activo: true }, select: { usuarioId: true, principal: true } } } });
    if (!antes) throw new ErrorNegocio("Esa obra no existe.");
    if (await db.obra.findFirst({ where: { id: { not: d.id }, nombre: { equals: d.nombre, mode: "insensitive" } }, select: { id: true } })) throw new ErrorNegocio(`Ya hay otra obra que se llama ${d.nombre}.`);
    const punto = await ubicarLugar(d);
    const responsables = await responsablesValidos(d.responsables);
    await db.$transaction(async (tx) => {
      await tx.obra.update({ where: { id: d.id }, data: { nombre: d.nombre, direccion: d.direccion, localidad: d.localidad, latitud: punto.lat, longitud: punto.lng, radioGeocercaM: d.radioGeocercaM, estado: d.estado } });
      const ids = responsables.map((r) => r.id);
      await tx.responsableObra.updateMany({ where: { obraId: d.id, activo: true, usuarioId: { notIn: ids } }, data: { activo: false, hastaEn: new Date(), principal: false } });
      for (const [i, r] of responsables.entries()) {
        await tx.responsableObra.upsert({
          where: { obraId_usuarioId: { obraId: d.id, usuarioId: r.id } },
          create: { obraId: d.id, usuarioId: r.id, principal: i === 0 },
          update: { activo: true, hastaEn: null, principal: i === 0 },
        });
      }
      await auditar(tx, {
        usuarioId: yo.id, accion: "obra.editar", entidad: "Obra", entidadId: d.id,
        resumen: `${yo.nombre} actualizó la Obra ${d.nombre}`,
        antes: { nombre: antes.nombre, direccion: antes.direccion, estado: antes.estado, responsables: antes.responsables.map((r) => r.usuarioId) },
        despues: { nombre: d.nombre, direccion: d.direccion, estado: d.estado, responsables: ids },
      });
    });
    revalidar("pedidos", "usuarios", "herramientas", "materiales");
    return null;
  });
}

const esquemaSede = lugarEsquema.extend({ obraId: z.string().min(1), id: z.string().optional(), nombre: z.string().trim().min(2, "Poné el nombre de la sede.").max(80), activa: z.boolean().default(true) });
export type DatosSede = z.input<typeof esquemaSede>;

/** Alta o edición de una sede (obra con más de un frente). */
export async function guardarSede(entrada: DatosSede): Promise<Resultado<{ id: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("obras.cargar");
    const d = esquemaSede.parse(entrada);
    const obra = await db.obra.findUnique({ where: { id: d.obraId }, select: { nombre: true } });
    if (!obra) throw new ErrorNegocio("Esa obra no existe.");
    const punto = await ubicarLugar(d);
    const datos = { nombre: d.nombre, direccion: d.direccion, localidad: d.localidad, latitud: punto.lat, longitud: punto.lng, activa: d.activa };
    const s = d.id ? await db.obraSede.update({ where: { id: d.id }, data: datos }) : await db.obraSede.create({ data: { ...datos, obraId: d.obraId } });
    await auditar(db, { usuarioId: yo.id, accion: d.id ? "obra.sede.editar" : "obra.sede.crear", entidad: "Obra", entidadId: d.obraId, resumen: `${yo.nombre} ${d.id ? "actualizó" : "agregó"} la sede ${d.nombre} de Obra ${obra.nombre} (${d.direccion})` });
    revalidar("pedidos", "materiales");
    return { id: s.id };
  });
}
