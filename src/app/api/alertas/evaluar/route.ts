import { NextResponse, type NextRequest } from "next/server";
import { evaluarAlertas } from "@/lib/alertas";
import { avisarAlertas } from "@/lib/alertas/avisar";
import { tokenValido } from "@/lib/cron/token";
import { limpiarEventos } from "@/lib/tiempo-real";

export const dynamic = "force-dynamic";

/** Evalúa todas las reglas de alertas (cron diario en el plan gratuito de Vercel). */
async function correr(req: NextRequest) {
  if (!tokenValido(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const r = await evaluarAlertas();
  await avisarAlertas(r.nuevas);
  // Limpieza diaria: los eventos de tiempo real de más de 24 h.
  const eventosBorrados = await limpiarEventos();
  return NextResponse.json({ ok: true, reglas: r.reglas, activas: r.activas, avisadas: r.nuevas.length, eventosBorrados });
}

export const POST = correr;
export const GET = correr;
