"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { cerrarSesion, iniciarSesion } from "@/lib/auth/usuario-actual";

const esquemaLogin = z.object({
  usuario: z.string().trim().toLowerCase().min(1, "Elegí tu nombre."),
  password: z.string().min(1, "Escribí tu contraseña."),
  volver: z.string().optional(),
});

// Hash de referencia para que un usuario inexistente tarde lo mismo que uno real.
const HASH_FALSO = "$2b$10$aoJeAXLQu8KhR/vA9LlDw.96WziSCWOvulflENUhaVEAOdB0D4HyW";

export type EstadoLogin = { error?: string } | undefined;

export async function entrar(_previo: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const datos = esquemaLogin.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0].message };

  const u = await db.usuario.findUnique({ where: { usuario: datos.data.usuario } });
  const coincide = await bcrypt.compare(datos.data.password, u?.passwordHash ?? HASH_FALSO);
  if (!u || !coincide) return { error: "Usuario o contraseña incorrectos." };
  if (!u.activo) return { error: "Tu usuario está desactivado. Hablá con la oficina." };

  await iniciarSesion(u);
  const volver = datos.data.volver;
  redirect(volver && volver.startsWith("/") && !volver.startsWith("//") ? volver : "/inicio");
}

export async function salir() {
  await cerrarSesion();
  redirect("/login");
}
