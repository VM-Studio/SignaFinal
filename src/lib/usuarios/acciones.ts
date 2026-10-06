"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { auditar } from "@/lib/auditoria";
import { revalidar } from "@/lib/revalidar";
import { reevaluar } from "@/lib/alertas/reevaluar";
import { ROL } from "@/lib/etiquetas";
import { aFecha } from "@/lib/formato";

const vacio = (v: unknown) => (v === "" || v === null ? undefined : v);
const ROLES = ["DIRECCION", "RESPONSABLE_OBRA", "CAPATAZ", "CHOFER", "DEPOSITO", "ADMINISTRACION"] as const;

const esquema = z.object({
  id: z.preprocess(vacio, z.string().optional()),
  nombre: z.string().trim().min(2, "Poné el nombre.").max(60),
  email: z.string().trim().toLowerCase().email("Revisá el email."),
  rol: z.enum(ROLES, { error: "Elegí el rol." }),
  telefono: z.preprocess(vacio, z.string().trim().max(30).optional()),
  licenciaCategoria: z.preprocess(vacio, z.string().trim().max(10).optional()),
  licenciaVencimiento: z.preprocess(vacio, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Revisá la fecha de la licencia.").optional()),
  // Solo responsables de obra: qué obras tiene y cuál es la principal.
  obras: z.array(z.string()).default([]),
  obraPrincipal: z.preprocess(vacio, z.string().optional()),
  // Al dar de alta (y para cambiarla): mínimo 8 caracteres.
  password: z.preprocess(vacio, z.string().min(8, "La contraseña tiene que tener al menos 8 caracteres.").max(100).optional()),
});
export type DatosUsuario = z.input<typeof esquema>;

/** Alta o edición de una persona. Nada se borra: para sacar a alguien se lo desactiva. */
export async function guardarUsuario(entrada: DatosUsuario): Promise<Resultado<{ id: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("usuarios.gestionar");
    const d = esquema.parse(entrada);
    if (!d.id && !d.password) throw new ErrorNegocio("Poné una contraseña inicial (mínimo 8 caracteres).");
    if (d.id === yo.id && d.rol !== yo.rol) throw new ErrorNegocio("No podés cambiarte el rol a vos mismo.");
    if (d.rol === "DIRECCION" && yo.rol !== "DIRECCION") throw new ErrorNegocio("Solo Dirección puede dar de alta a otra persona de Dirección.");
    const otro = await db.usuario.findUnique({ where: { email: d.email }, select: { id: true } });
    if (otro && otro.id !== d.id) throw new ErrorNegocio("Ese email ya lo usa otra persona.");
    if (d.rol === "RESPONSABLE_OBRA" && d.obras.length === 0) throw new ErrorNegocio("Elegí al menos una obra.");

    const chofer = d.rol === "CHOFER";
    const datos = {
      nombre: d.nombre, email: d.email, rol: d.rol, telefono: d.telefono ?? null,
      licenciaCategoria: chofer ? d.licenciaCategoria ?? null : null,
      licenciaVencimiento: chofer && d.licenciaVencimiento ? aFecha(d.licenciaVencimiento, "12:00") : null,
      ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 10) } : {}),
    };
    const r = await db.$transaction(async (tx) => {
      const antes = d.id ? await tx.usuario.findUniqueOrThrow({ where: { id: d.id }, select: { nombre: true, rol: true } }) : null;
      const u = d.id
        ? await tx.usuario.update({ where: { id: d.id }, data: datos, select: { id: true } })
        : await tx.usuario.create({ data: { ...datos, passwordHash: datos.passwordHash! }, select: { id: true } });
      // Obras a cargo (solo responsables): se reemplaza la asignación por la elegida.
      const obras = d.rol === "RESPONSABLE_OBRA" ? d.obras : [];
      // Nada se borra: las obras que se le sacan quedan inactivas con la fecha.
      await tx.responsableObra.updateMany({ where: { usuarioId: u.id, activo: true, obraId: { notIn: obras } }, data: { activo: false, hastaEn: new Date(), principal: false } });
      for (const obraId of obras) {
        const principal = (d.obraPrincipal ?? obras[0]) === obraId;
        await tx.responsableObra.upsert({
          where: { obraId_usuarioId: { obraId, usuarioId: u.id } },
          create: { obraId, usuarioId: u.id, principal },
          update: { principal, activo: true, hastaEn: null },
        });
      }
      const nombresObras = obras.length ? (await tx.obra.findMany({ where: { id: { in: obras } }, select: { nombre: true } })).map((o) => `Obra ${o.nombre}`).join(", ") : "";
      await auditar(tx, {
        usuarioId: yo.id, accion: d.id ? "usuario.editar" : "usuario.alta", entidad: "Usuario", entidadId: u.id,
        resumen: d.id
          ? `${yo.nombre} editó a ${d.nombre}${antes && antes.rol !== d.rol ? ` (de ${ROL[antes.rol]} a ${ROL[d.rol]})` : ""}${nombresObras ? `: ${nombresObras}` : ""}${d.password ? " y le cambió la contraseña" : ""}`
          : `${yo.nombre} dio de alta a ${d.nombre} como ${ROL[d.rol]}${nombresObras ? ` (${nombresObras})` : ""}`,
        despues: { rol: d.rol, obras },
      });
      return u;
    });
    revalidar("usuarios");
    reevaluar("flota"); // licencias
    return r;
  });
}

/** Desactivar o volver a activar: deja de entrar a la app en el acto (la sesión se valida contra la base). */
export async function cambiarActivo(id: string, activo: boolean): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("usuarios.gestionar");
    if (id === yo.id) throw new ErrorNegocio("No podés desactivarte a vos mismo.");
    const u = await db.usuario.findUniqueOrThrow({ where: { id }, select: { nombre: true, rol: true } });
    if (u.rol === "DIRECCION" && yo.rol !== "DIRECCION") throw new ErrorNegocio("Solo Dirección puede desactivar a alguien de Dirección.");
    if (!activo) {
      const enCurso = await db.viaje.count({ where: { choferId: id, estado: "EN_CURSO" } });
      if (enCurso) throw new ErrorNegocio(`${u.nombre} tiene un viaje en curso. Que lo termine antes.`);
    }
    await db.usuario.update({ where: { id }, data: { activo } });
    await auditar(db, { usuarioId: yo.id, accion: activo ? "usuario.activar" : "usuario.desactivar", entidad: "Usuario", entidadId: id, resumen: `${yo.nombre} ${activo ? "volvió a activar" : "desactivó"} a ${u.nombre}` });
    revalidar("usuarios");
    reevaluar("flota");
    return null;
  });
}
