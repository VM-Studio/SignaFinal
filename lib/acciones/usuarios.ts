"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { autorizar } from "@/lib/auth/usuario-actual";
import { auditar } from "@/lib/auditoria";
import { sincronizarLebane, type ResumenSincronizacion } from "@/lib/lebane/sincronizar";
import { evaluarAlertas } from "@/lib/alertas";
import { ejecutar, ErrorNegocio, type Resultado } from "./resultado";
import { despuesDeCambiar } from "./comun";

const vacioAUndef = (v: unknown) => (v === "" || v === null ? undefined : v);

const esquemaUsuario = z.object({
  id: z.preprocess(vacioAUndef, z.string().optional()),
  nombre: z.string().trim().min(2, "Poné el nombre.").max(60),
  usuario: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "El usuario tiene que tener al menos 3 letras.")
    .max(30)
    .regex(/^[a-z0-9._-]+$/, "El usuario va sin espacios ni acentos."),
  rol: z.enum(["DIRECCION", "RESPONSABLE_OBRA", "CAPATAZ", "CHOFER", "DEPOSITO", "ADMINISTRACION"], { error: "Elegí el rol." }),
  telefono: z.preprocess(vacioAUndef, z.string().trim().max(30).optional()),
  licenciaVence: z.preprocess(vacioAUndef, z.coerce.date().optional()),
  obraIds: z.array(z.string()).default([]),
  password: z.preprocess(vacioAUndef, z.string().min(8, "La contraseña tiene que tener al menos 8 caracteres.").optional()),
});

export type DatosUsuario = z.input<typeof esquemaUsuario>;

export async function guardarUsuario(entrada: DatosUsuario): Promise<Resultado<{ id: string }>> {
  return ejecutar(async () => {
    const yo = await autorizar("usuarios.gestionar");
    const { id, obraIds, password, ...d } = esquemaUsuario.parse(entrada);
    if (!id && !password) throw new ErrorNegocio("Poné una contraseña inicial.");
    const datos = {
      ...d,
      telefono: d.telefono ?? null,
      licenciaVence: d.rol === "CHOFER" ? d.licenciaVence ?? null : null,
      obras: { set: d.rol === "RESPONSABLE_OBRA" ? obraIds.map((o) => ({ id: o })) : [] },
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    };
    const u = id
      ? await db.usuario.update({ where: { id }, data: datos, select: { id: true } })
      : await db.usuario.create({
          data: { ...datos, passwordHash: datos.passwordHash!, obras: { connect: datos.obras.set } },
          select: { id: true },
        });
    await auditar(db, { usuarioId: yo.id, accion: id ? "usuario.editar" : "usuario.crear", entidad: "Usuario", entidadId: u.id, detalle: { rol: d.rol, cambioClave: !!password } });
    despuesDeCambiar();
    return u;
  });
}

export async function cambiarActivoUsuario(id: string, activo: boolean): Promise<Resultado<null>> {
  return ejecutar(async () => {
    const yo = await autorizar("usuarios.gestionar");
    if (id === yo.id) throw new ErrorNegocio("No podés desactivarte a vos mismo.");
    if (!activo) {
      const enViaje = await db.viaje.count({ where: { choferId: id, estado: "EN_VIAJE" } });
      if (enViaje) throw new ErrorNegocio("Tiene un viaje en curso. Esperá a que termine.");
      // Los pedidos que tenía tomados vuelven a la cola.
      await db.pedidoViaje.updateMany({ where: { choferId: id, estado: "TOMADO" }, data: { estado: "PENDIENTE", choferId: null, tomadoEn: null } });
    }
    await db.usuario.update({ where: { id }, data: { activo } });
    await auditar(db, { usuarioId: yo.id, accion: activo ? "usuario.activar" : "usuario.desactivar", entidad: "Usuario", entidadId: id });
    despuesDeCambiar();
    return null;
  });
}

export async function cambiarMiClave(actual: string, nueva: string): Promise<Resultado<null>> {
  return ejecutar(async () => {
    const yo = await autorizar();
    if (nueva.length < 8) throw new ErrorNegocio("La contraseña nueva tiene que tener al menos 8 caracteres.");
    const u = await db.usuario.findUniqueOrThrow({ where: { id: yo.id }, select: { passwordHash: true } });
    if (!(await bcrypt.compare(actual, u.passwordHash))) throw new ErrorNegocio("La contraseña actual no es correcta.");
    await db.usuario.update({ where: { id: yo.id }, data: { passwordHash: await bcrypt.hash(nueva, 10) } });
    await auditar(db, { usuarioId: yo.id, accion: "usuario.cambiarClave", entidad: "Usuario", entidadId: yo.id });
    return null;
  });
}

export async function sincronizarConLebane(): Promise<Resultado<ResumenSincronizacion>> {
  return ejecutar(async () => {
    const yo = await autorizar("obras.sincronizar");
    const r = await sincronizarLebane();
    await auditar(db, { usuarioId: yo.id, accion: "lebane.sincronizar", entidad: "Lebane", entidadId: r.origen, detalle: r });
    despuesDeCambiar();
    return r;
  });
}

export async function recalcularAlertas(): Promise<Resultado<{ activas: number }>> {
  return ejecutar(async () => {
    await autorizar("alertas.ver");
    const r = await evaluarAlertas();
    despuesDeCambiar();
    return r;
  });
}
