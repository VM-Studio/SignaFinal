import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { obtenerSesion } from "@/lib/auth/sesion";
import { auditar } from "@/lib/auditoria";

/** Desactiva los avisos en este celular (nada se borra). */
export async function POST(req: NextRequest) {
  const u = await obtenerSesion();
  if (!u) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const d = z.object({ endpoint: z.string().url() }).safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json({ error: "Falta el endpoint" }, { status: 400 });
  const r = await db.suscripcionPush.updateMany({ where: { endpoint: d.data.endpoint, usuarioId: u.id }, data: { activa: false } });
  if (r.count) await auditar(db, { usuarioId: u.id, accion: "push.desactivar", entidad: "Usuario", entidadId: u.id, resumen: `${u.nombre} desactivó los avisos en un celular` });
  return NextResponse.json({ ok: true });
}
