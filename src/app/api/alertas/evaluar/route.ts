import { NextResponse, type NextRequest } from "next/server";
import { evaluarAlertas } from "@/lib/alertas";
import { tokenValido } from "@/lib/cron/token";

export const dynamic = "force-dynamic";

/** Evalúa todas las reglas de alertas (cron diario en el plan gratuito de Vercel). */
async function correr(req: NextRequest) {
  if (!tokenValido(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await evaluarAlertas()) });
}

export const POST = correr;
export const GET = correr;
