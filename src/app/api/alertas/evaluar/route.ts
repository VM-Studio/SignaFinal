import { NextResponse, type NextRequest } from "next/server";
import { evaluarAlertas } from "@/lib/alertas";
import { avisarAlertas } from "@/lib/alertas/avisar";
import { tokenValido } from "@/lib/cron/token";

export const dynamic = "force-dynamic";

/** Evalúa todas las reglas de alertas (cron diario en el plan gratuito de Vercel). */
async function correr(req: NextRequest) {
  if (!tokenValido(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const r = await evaluarAlertas();
  await avisarAlertas(r.nuevas);
  return NextResponse.json({ ok: true, reglas: r.reglas, activas: r.activas, avisadas: r.nuevas.length });
}

export const POST = correr;
export const GET = correr;
