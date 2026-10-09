import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * El service worker avisa que el teléfono recibió una push (diagnóstico de "Avisos en este celular").
 * Sin sesión: alcanza con el endpoint, que solo conoce ese dispositivo.
 */
export async function POST(req: NextRequest) {
  const d = z.object({ endpoint: z.string().url() }).safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json({ ok: false }, { status: 400 });
  await db.suscripcionPush.updateMany({ where: { endpoint: d.data.endpoint }, data: { ultimaRecepcionEn: new Date(), activa: true } });
  return NextResponse.json({ ok: true });
}
