import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { obtenerSesion } from "@/lib/auth/sesion";
import { auditar } from "@/lib/auditoria";

const esquema = z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string().min(10), auth: z.string().min(8) }) });

/** Guarda (o reactiva) la suscripción push de este celular para el usuario. */
export async function POST(req: NextRequest) {
  const u = await obtenerSesion();
  if (!u) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const d = esquema.safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;
  await db.suscripcionPush.upsert({
    where: { endpoint: d.data.endpoint },
    create: { usuarioId: u.id, endpoint: d.data.endpoint, p256dh: d.data.keys.p256dh, auth: d.data.keys.auth, userAgent },
    update: { usuarioId: u.id, p256dh: d.data.keys.p256dh, auth: d.data.keys.auth, userAgent, activa: true },
  });
  await auditar(db, { usuarioId: u.id, accion: "push.activar", entidad: "Usuario", entidadId: u.id, resumen: `${u.nombre} activó los avisos en un celular` });
  return NextResponse.json({ ok: true });
}
