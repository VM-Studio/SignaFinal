import { NextResponse, type NextRequest } from "next/server";
import { tokenValido } from "@/lib/cron/token";
import { enviarRecordatorios } from "@/lib/viajes/recordatorios";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cada minuto (cron de Vercel, con CRON_SECRET): manda los recordatorios del chofer que llegaron a su
 * hora (18:00 del día anterior, 7:00 del día, "Todavía no iniciaste…") y el resumen de las 9:00 para
 * Dirección. Idempotente por claveUnica: llamarlo dos veces no duplica nada.
 */
async function correr(req: NextRequest) {
  if (!tokenValido(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await enviarRecordatorios()) });
}

export const GET = correr;
export const POST = correr;
