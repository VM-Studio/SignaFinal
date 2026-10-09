import { NextResponse, type NextRequest } from "next/server";
import { sincronizar } from "@/lib/cusat/sincronizar";
import { tokenValido } from "@/lib/cron/token";

export const dynamic = "force-dynamic";

/**
 * Sincronización con Cusat. Protegida con CRON_SECRET ("Authorization: Bearer …").
 * POST desde cron-job.org (docs/cusat/cron.md); GET para Vercel Cron.
 */
async function correr(req: NextRequest) {
  if (!tokenValido(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const r = await sincronizar();
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}

export const POST = correr;
export const GET = correr;
