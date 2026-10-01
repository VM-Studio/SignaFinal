import { NextResponse, type NextRequest } from "next/server";
import { evaluarAlertas } from "@/lib/alertas";

export const dynamic = "force-dynamic";

/** Vercel Cron: recalcula las alertas (vencimientos, pedidos sin tomar, etc.). */
export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const r = await evaluarAlertas();
  return NextResponse.json({ ok: true, ...r });
}
