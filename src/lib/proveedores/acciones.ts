"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { auditar } from "@/lib/auditoria";
import { lugarEsquema, ubicarLugar } from "@/lib/geo/lugar";
import { revalidar } from "@/lib/revalidar";

const vacio = (v: unknown) => (v === "" || v == null ? undefined : v);
const opcional = (max: number) => z.preprocess(vacio, z.string().trim().max(max).optional());

const esquemaProveedor = z.object({
  nombre: z.string().trim().min(2, "Poné el nombre del proveedor.").max(80),
  cuit: z.preprocess(vacio, z.string().trim().regex(/^\d{2}-?\d{8}-?\d$/, "El CUIT tiene 11 números (30-12345678-9).").optional()),
  telefono: opcional(40),
  email: z.preprocess(vacio, z.string().trim().email("Revisá el email.").max(120).optional()),
  rubro: opcional(60),
  notas: opcional(500),
});

const esquemaSucursal = lugarEsquema.extend({
  nombre: z.string().trim().min(2, "Poné el nombre de la sucursal (ej. \"Casa central\", \"Sucursal Pilar\").").max(60),
  horarioRetiro: opcional(120),
  contacto: opcional(120),
  telefono: opcional(40),
  principal: z.boolean().default(false),
});

export type DatosProveedor = z.input<typeof esquemaProveedor>;
export type DatosSucursal = z.input<typeof esquemaSucursal>;

/** Lo que vuelve a la pantalla: el proveedor con sus sucursales, para seleccionarlo en el acto. */
export type ProveedorConSucursales = {
  id: string; nombre: string; cuit: string | null; telefono: string | null;
  sucursales: { id: string; nombre: string; direccion: string; localidad: string; lat: number; lng: number; horarioRetiro: string | null; contacto: string | null; telefono: string | null; principal: boolean }[];
};

async function conSucursales(id: string): Promise<ProveedorConSucursales> {
  const p = await db.proveedor.findUniqueOrThrow({ where: { id }, include: { sucursales: { where: { activa: true }, orderBy: [{ principal: "desc" }, { nombre: "asc" }] } } });
  return {
    id: p.id, nombre: p.nombre, cuit: p.cuit, telefono: p.telefono,
    sucursales: p.sucursales.map((s) => ({ id: s.id, nombre: s.nombre, direccion: s.direccion, localidad: s.localidad, lat: s.latitud, lng: s.longitud, horarioRetiro: s.horarioRetiro, contacto: s.contacto, telefono: s.telefono, principal: s.principal })),
  };
}

function refrescar(id?: string) {
  revalidatePath("/proveedores");
  if (id) revalidatePath(`/proveedores/${id}`);
  revalidar("materiales");
}

/**
 * Alta de proveedor con su primera sucursal (la "Casa central" salvo que se le ponga otro nombre),
 * dirección confirmada en el mapa. Es también la alta rápida del selector de proveedor.
 */
export async function crearProveedor(entrada: { proveedor: DatosProveedor; sucursal: DatosSucursal }): Promise<Resultado<ProveedorConSucursales>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("proveedores.cargar");
    const p = esquemaProveedor.parse(entrada.proveedor);
    const s = esquemaSucursal.parse({ ...entrada.sucursal, nombre: entrada.sucursal.nombre || "Casa central" });
    if (await db.proveedor.findFirst({ where: { nombre: { equals: p.nombre, mode: "insensitive" } }, select: { id: true } })) throw new ErrorNegocio(`Ya hay un proveedor que se llama ${p.nombre}. Buscalo y agregale la sucursal.`);
    if (p.cuit && (await db.proveedor.findFirst({ where: { cuit: p.cuit }, select: { nombre: true } }))) throw new ErrorNegocio("Ya hay un proveedor con ese CUIT.");
    const punto = await ubicarLugar(s);
    const creado = await db.proveedor.create({
      data: {
        nombre: p.nombre, cuit: p.cuit ?? null, telefono: p.telefono ?? null, email: p.email ?? null, rubro: p.rubro ?? null, notas: p.notas ?? null,
        sucursales: { create: { nombre: s.nombre, direccion: s.direccion, localidad: s.localidad, latitud: punto.lat, longitud: punto.lng, horarioRetiro: s.horarioRetiro ?? null, contacto: s.contacto ?? null, telefono: s.telefono ?? p.telefono ?? null, principal: true } },
      },
    });
    await auditar(db, { usuarioId: yo.id, accion: "proveedor.crear", entidad: "Proveedor", entidadId: creado.id, resumen: `${yo.nombre} cargó el proveedor ${p.nombre} (${s.nombre}: ${s.direccion}, ${s.localidad})` });
    refrescar();
    return conSucursales(creado.id);
  });
}

/** Edición de los datos del proveedor (sin sucursales). */
export async function editarProveedor(id: string, entrada: DatosProveedor & { activo?: boolean }): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("proveedores.cargar");
    const p = esquemaProveedor.parse(entrada);
    const antes = await db.proveedor.findUnique({ where: { id } });
    if (!antes) throw new ErrorNegocio("Ese proveedor no existe.");
    if (await db.proveedor.findFirst({ where: { id: { not: id }, nombre: { equals: p.nombre, mode: "insensitive" } }, select: { id: true } })) throw new ErrorNegocio(`Ya hay otro proveedor que se llama ${p.nombre}.`);
    await db.proveedor.update({ where: { id }, data: { nombre: p.nombre, cuit: p.cuit ?? null, telefono: p.telefono ?? null, email: p.email ?? null, rubro: p.rubro ?? null, notas: p.notas ?? null, ...(entrada.activo != null ? { activo: entrada.activo } : {}) } });
    await auditar(db, { usuarioId: yo.id, accion: "proveedor.editar", entidad: "Proveedor", entidadId: id, resumen: `${yo.nombre} actualizó el proveedor ${p.nombre}`, antes: { nombre: antes.nombre, cuit: antes.cuit, telefono: antes.telefono }, despues: p });
    refrescar(id);
    return null;
  });
}

/** Alta o edición de una sucursal. "Principal" deja a las demás como no principales. */
export async function guardarSucursal(proveedorId: string, entrada: DatosSucursal & { id?: string; activa?: boolean }): Promise<Resultado<ProveedorConSucursales & { sucursalId: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("proveedores.cargar");
    const s = esquemaSucursal.parse(entrada);
    const prov = await db.proveedor.findUnique({ where: { id: proveedorId }, include: { _count: { select: { sucursales: { where: { activa: true } } } } } });
    if (!prov) throw new ErrorNegocio("Ese proveedor no existe.");
    const punto = await ubicarLugar(s);
    const principal = s.principal || prov._count.sucursales === 0;
    const datos = { nombre: s.nombre, direccion: s.direccion, localidad: s.localidad, latitud: punto.lat, longitud: punto.lng, horarioRetiro: s.horarioRetiro ?? null, contacto: s.contacto ?? null, telefono: s.telefono ?? null, principal, ...(entrada.activa != null ? { activa: entrada.activa } : {}) };
    const suc = await db.$transaction(async (tx) => {
      if (principal) await tx.sucursalProveedor.updateMany({ where: { proveedorId, principal: true, ...(entrada.id ? { id: { not: entrada.id } } : {}) }, data: { principal: false } });
      const x = entrada.id ? await tx.sucursalProveedor.update({ where: { id: entrada.id }, data: datos }) : await tx.sucursalProveedor.create({ data: { ...datos, proveedorId } });
      await auditar(tx, { usuarioId: yo.id, accion: entrada.id ? "proveedor.sucursal.editar" : "proveedor.sucursal.crear", entidad: "Proveedor", entidadId: proveedorId, resumen: `${yo.nombre} ${entrada.id ? "actualizó" : "agregó"} la sucursal ${s.nombre} de ${prov.nombre} (${s.direccion}, ${s.localidad})` });
      return x;
    });
    refrescar(proveedorId);
    return { ...(await conSucursales(proveedorId)), sucursalId: suc.id };
  });
}

/** "Marcar como principal". */
export async function marcarPrincipal(sucursalId: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("proveedores.cargar");
    const s = await db.sucursalProveedor.findUnique({ where: { id: sucursalId }, include: { proveedor: { select: { nombre: true } } } });
    if (!s) throw new ErrorNegocio("Esa sucursal no existe.");
    await db.$transaction([
      db.sucursalProveedor.updateMany({ where: { proveedorId: s.proveedorId }, data: { principal: false } }),
      db.sucursalProveedor.update({ where: { id: sucursalId }, data: { principal: true, activa: true } }),
    ]);
    await auditar(db, { usuarioId: yo.id, accion: "proveedor.sucursal.principal", entidad: "Proveedor", entidadId: s.proveedorId, resumen: `${yo.nombre} marcó ${s.nombre} como sucursal principal de ${s.proveedor.nombre}` });
    refrescar(s.proveedorId);
    return null;
  });
}
