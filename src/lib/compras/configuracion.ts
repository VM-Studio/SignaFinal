"use server";

import { z } from "zod";
import type { TipoOrden } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { auditar } from "@/lib/auditoria";
import { revalidar } from "@/lib/revalidar";
import { subirNumerador } from "./numerar";

/**
 * Configuración de Compras según Alejandra: razones sociales (hoja NOTOCAR: obras y CUITs), la razón
 * social que compra por defecto en cada obra, los numeradores de OC y PE (solo el dueño, solo hacia
 * arriba) y los "Solicitado por" sin usuario (hoja SolicitadoPor).
 */

/** "30717042812" o "30-71704281-2" → "30-71704281-2" */
function normalizarCuit(c: string) {
  const d = c.replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : c.trim();
}

const esquemaRazon = z.object({
  id: z.string().optional(),
  nombre: z.string().trim().min(2, "Poné la razón social.").max(120),
  cuit: z.string().trim().refine((c) => c.replace(/\D/g, "").length === 11, "El CUIT tiene 11 números (30-71704281-2)."),
  activa: z.boolean().default(true),
  orden: z.coerce.number().int().min(0).max(999).default(0),
});

export async function guardarRazonSocial(entrada: z.input<typeof esquemaRazon>): Promise<Resultado<{ id: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("razonesSociales.editar");
    const d = esquemaRazon.parse(entrada);
    const cuit = normalizarCuit(d.cuit);
    const otra = await db.razonSocial.findUnique({ where: { cuit } });
    if (otra && otra.id !== d.id) throw new ErrorNegocio(`Ese CUIT ya es de ${otra.nombre}.`);
    const r = await db.$transaction(async (tx) => {
      const antes = d.id ? await tx.razonSocial.findUnique({ where: { id: d.id } }) : null;
      if (d.id && !antes) throw new ErrorNegocio("No existe esa razón social.");
      const x = d.id
        ? await tx.razonSocial.update({ where: { id: d.id }, data: { nombre: d.nombre, cuit, activa: d.activa, orden: d.orden } })
        : await tx.razonSocial.create({ data: { nombre: d.nombre, cuit, activa: true, orden: d.orden || (await tx.razonSocial.count()) + 1 } });
      await auditar(tx, {
        usuarioId: yo.id, accion: d.id ? "razonSocial.editar" : "razonSocial.crear", entidad: "RazonSocial", entidadId: x.id,
        resumen: d.id ? `${yo.nombre} actualizó la razón social ${x.nombre} (${cuit})${antes!.activa && !d.activa ? ": quedó inactiva" : ""}` : `${yo.nombre} cargó la razón social ${x.nombre} (${cuit})`,
        antes: antes ? { nombre: antes.nombre, cuit: antes.cuit, activa: antes.activa } : undefined, despues: { nombre: x.nombre, cuit, activa: x.activa },
      });
      return x;
    });
    revalidar("materiales");
    return { id: r.id };
  });
}

/** La razón social que compra por defecto para una obra (null: Signa Desarrollos). */
export async function asignarRazonAObra(obraId: string, razonSocialId: string | null): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("razonesSociales.editar");
    await db.$transaction(async (tx) => {
      const obra = await tx.obra.findUnique({ where: { id: obraId }, select: { nombre: true, razonSocialId: true } });
      if (!obra) throw new ErrorNegocio("No existe esa obra.");
      const razon = razonSocialId ? await tx.razonSocial.findUnique({ where: { id: razonSocialId } }) : null;
      if (razonSocialId && !razon?.activa) throw new ErrorNegocio("Esa razón social no está activa.");
      await tx.obra.update({ where: { id: obraId }, data: { razonSocialId } });
      await auditar(tx, { usuarioId: yo.id, accion: "obra.razonSocial", entidad: "Obra", entidadId: obraId, resumen: `${yo.nombre} indicó que la Obra ${obra.nombre} compra con ${razon?.nombre ?? "la razón social por defecto"}`, antes: { razonSocialId: obra.razonSocialId }, despues: { razonSocialId } });
    });
    revalidar("materiales");
    return null;
  });
}

/**
 * "Próximo número de OC" y "de PE": solo el dueño, solo hacia arriba (un número usado nunca se repite).
 * Se guarda el último usado (próximo − 1).
 */
export async function cambiarProximoNumero(tipo: TipoOrden, proximo: number): Promise<Resultado<{ ultimo: number }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("compras.numeradores");
    if (!["OC", "PE"].includes(tipo)) throw new ErrorNegocio("Tipo de orden inválido.");
    if (!Number.isInteger(proximo) || proximo < 1 || proximo > 999_999) throw new ErrorNegocio("Poné un número entero.");
    const ultimo = await db.$transaction(async (tx) => {
      const actual = (await tx.numeradorOC.findUnique({ where: { tipo } }))?.ultimo ?? 0;
      if (proximo - 1 < actual) throw new ErrorNegocio(`El próximo ${tipo} no puede ser menor que ${actual + 1}: ese número ya se usó o ya está reservado.`);
      const u = await subirNumerador(tx, tipo, proximo - 1);
      await auditar(tx, { usuarioId: yo.id, accion: "compras.numerador", entidad: "NumeradorOC", entidadId: tipo, resumen: `${yo.nombre} fijó el próximo número de ${tipo} en ${proximo}`, antes: { ultimo: actual }, despues: { ultimo: u } });
      return u;
    });
    revalidar("materiales");
    return { ultimo };
  });
}

const nombreExterno = z.string().trim().min(2, "Poné el nombre.").max(60);

/** "+ otro nombre" en Solicitado por: nombres que no son usuarios (no se crean usuarios). */
export async function crearSolicitanteExterno(nombre: string): Promise<Resultado<{ id: string; nombre: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    const n = nombreExterno.parse(nombre);
    const limpio = n.charAt(0).toUpperCase() + n.slice(1);
    const ya = await db.solicitanteExterno.findFirst({ where: { nombre: { equals: limpio, mode: "insensitive" } } });
    if (ya) {
      if (!ya.activo) await db.solicitanteExterno.update({ where: { id: ya.id }, data: { activo: true } });
      return { id: ya.id, nombre: ya.nombre };
    }
    const usuario = await db.usuario.findFirst({ where: { nombre: { equals: limpio, mode: "insensitive" }, activo: true }, select: { nombre: true } });
    if (usuario) throw new ErrorNegocio(`${usuario.nombre} ya está en la lista como usuario.`);
    const e = await db.$transaction(async (tx) => {
      const x = await tx.solicitanteExterno.create({ data: { nombre: limpio } });
      await auditar(tx, { usuarioId: yo.id, accion: "solicitante.crear", entidad: "SolicitanteExterno", entidadId: x.id, resumen: `${yo.nombre} agregó a ${limpio} a "Solicitado por"` });
      return x;
    });
    revalidar("materiales");
    return { id: e.id, nombre: e.nombre };
  });
}

export async function cambiarSolicitanteExterno(id: string, activo: boolean): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    await db.$transaction(async (tx) => {
      const e = await tx.solicitanteExterno.findUnique({ where: { id } });
      if (!e) throw new ErrorNegocio("No existe ese nombre.");
      await tx.solicitanteExterno.update({ where: { id }, data: { activo } });
      await auditar(tx, { usuarioId: yo.id, accion: "solicitante.editar", entidad: "SolicitanteExterno", entidadId: id, resumen: `${yo.nombre} ${activo ? "volvió a activar" : "sacó de la lista"} a ${e.nombre} en "Solicitado por"` });
    });
    revalidar("materiales");
    return null;
  });
}
