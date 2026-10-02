import { NextResponse, type NextRequest } from "next/server";
import { capturarPosiciones } from "@/lib/cusat/captura";
import { tokenValido } from "@/lib/cron/token";

export const dynamic = "force-dynamic";

/** Job de posiciones (cron cada minuto). POST con token; GET también para Vercel Cron. */
async function correr(req: NextRequest) {
  if (!tokenValido(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const r = await capturarPosiciones({ forzar: true });
  return NextResponse.json({ ok: true, ...r });
}

export const POST = correr;
export const GET = correr;
