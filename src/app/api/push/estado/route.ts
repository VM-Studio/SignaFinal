import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { obtenerSesion } from "@/lib/auth/sesion";
import { vapidFaltantes } from "@/lib/notificaciones";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico de avisos (Mi cuenta): si las claves VAPID están en el servidor (sin mostrarlas) y si la
 * suscripción de ESTE dispositivo (su endpoint) está guardada, activa y a nombre de quién.
 */
export async function POST(req: NextRequest) {
  const u = await obtenerSesion();
  if (!u) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const d = z.object({ endpoint: z.string().url().optional() }).safeParse(await req.json().catch(() => ({})));
  const endpoint = d.success ? d.data.endpoint : undefined;
  const s = endpoint ? await db.suscripcionPush.findUnique({ where: { endpoint }, select: { activa: true, usuarioId: true, usuario: { select: { nombre: true } } } }) : null;
  const faltan = vapidFaltantes();
  return NextResponse.json(
    {
      vapid: { ok: faltan.length === 0, faltan },
      suscripcion: s ? { activa: s.activa, usuario: s.usuario.nombre, esMia: s.usuarioId === u.id } : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
