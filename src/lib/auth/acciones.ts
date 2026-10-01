"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { abrirSesion, cerrarSesionCookie } from "./sesion";

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
  await db.auditoria.create({ data: { usuarioId: u.id, accion: "sesion.ingresar", entidad: "Usuario", entidadId: u.id } });
  const v = d.data.volver;
  redirect(v && v.startsWith("/") && !v.startsWith("//") ? v : "/inicio");
}

export async function cerrarSesion() {
  await cerrarSesionCookie();
  redirect("/login");
}
