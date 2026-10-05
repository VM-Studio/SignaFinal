import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { tokenValido } from "@/lib/cron/token";
import { ETAPAS_EN_CURSO } from "@/lib/viajes/etapas";
import { recalcularEta } from "@/lib/viajes/tramos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Posiciones de más de 10 minutos no sirven para estimar (el teléfono dejó de mandar). */
const POSICION_VIGENTE_MS = 10 * 60_000;

/**
 * Cada minuto: recalcula la hora estimada de los viajes en curso con su última posición y, si se
 * corrió más de 15 minutos respecto de lo que se le dijo al que pidió, le avisa una vez.
 */
async function correr(req: NextRequest) {
  if (!tokenValido(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const viajes = await db.viaje.findMany({
    where: { etapa: { in: ETAPAS_EN_CURSO } },
    include: { pedido: true, chofer: { select: { nombre: true } }, posiciones: { orderBy: { fecha: "desc" }, take: 1 } },
  });
  let recalculados = 0;
  for (const v of viajes) {
    const p = v.posiciones[0];
    if (!p || Date.now() - p.fecha.getTime() > POSICION_VIGENTE_MS) continue;
    await recalcularEta(v, { lat: p.latitud, lng: p.longitud });
    recalculados++;
  }
  return NextResponse.json({ ok: true, enCurso: viajes.length, recalculados });
}

export const GET = correr;
export const POST = correr;
