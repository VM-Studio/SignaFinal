"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { exigirSesion } from "@/lib/auth/sesion";
import { ejecutar, type Resultado } from "@/lib/resultado";
import { auditar } from "@/lib/auditoria";

const esquema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(10),
  auth: z.string().min(8),
  userAgent: z.string().max(300).optional(),
});

/** Guarda (o reactiva) la suscripción push de este teléfono para el usuario. */
export async function guardarSuscripcion(entrada: z.input<typeof esquema>): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    const d = esquema.parse(entrada);
    await db.suscripcionPush.upsert({
      where: { endpoint: d.endpoint },
      create: { usuarioId: yo.id, endpoint: d.endpoint, p256dh: d.p256dh, auth: d.auth, userAgent: d.userAgent ?? null },
      update: { usuarioId: yo.id, p256dh: d.p256dh, auth: d.auth, userAgent: d.userAgent ?? null, activa: true },
    });
    await auditar(db, { usuarioId: yo.id, accion: "push.activar", entidad: "Usuario", entidadId: yo.id, resumen: `${yo.nombre} activó los avisos en un dispositivo` });
    return null;
  });
}
