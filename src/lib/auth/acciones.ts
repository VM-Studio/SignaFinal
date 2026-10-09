"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { auditar } from "@/lib/auditoria";
import { abrirSesion, cerrarSesionCookie, obtenerSesion } from "./sesion";

const esquema = z.object({
  email: z.string().trim().toLowerCase().email("Revisá el email."),
  password: z.string().min(1, "Escribí tu contraseña."),
  volver: z.string().optional(),
});

// Para que un email inexistente tarde lo mismo que uno real.
const HASH_FALSO = bcrypt.hashSync("no-es-una-clave", 10);

export type EstadoLogin = { error?: string; email?: string } | undefined;

export async function ingresar(_: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const d = esquema.safeParse(Object.fromEntries(form));
  const email = String(form.get("email") ?? "");
  if (!d.success) return { error: d.error.issues[0].message, email };

  const u = await db.usuario.findUnique({ where: { email: d.data.email } });
  const ok = await bcrypt.compare(d.data.password, u?.passwordHash ?? HASH_FALSO);
  if (!u || !ok) return { error: "Email o contraseña incorrectos.", email };
  if (!u.activo) return { error: "Tu usuario está desactivado. Hablá con la oficina.", email };

  await abrirSesion(u);
  await auditar(db, { usuarioId: u.id, accion: "sesion.ingresar", entidad: "Usuario", entidadId: u.id, resumen: `${u.nombre} ingresó al sistema` });
  const v = d.data.volver;
  redirect(v && v.startsWith("/") && !v.startsWith("//") ? v : "/inicio");
}

/**
 * Cerrar sesión. Si el formulario trae el endpoint push de este dispositivo, la suscripción se
 * desactiva (no se borra): el que se va no sigue recibiendo avisos en un celular que ya no usa.
 * Cuando otro entra en ese dispositivo, la app la reactiva a su nombre.
 */
export async function cerrarSesion(formData?: FormData) {
  const u = await obtenerSesion();
  const endpoint = formData?.get("endpoint");
  if (u && typeof endpoint === "string" && endpoint.startsWith("https://")) {
    await db.suscripcionPush.updateMany({ where: { endpoint, usuarioId: u.id }, data: { activa: false } });
  }
  if (u) await auditar(db, { usuarioId: u.id, accion: "sesion.salir", entidad: "Usuario", entidadId: u.id, resumen: `${u.nombre} cerró sesión` });
  await cerrarSesionCookie();
  redirect("/login");
}
