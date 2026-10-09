import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { tokenValido } from "@/lib/cron/token";
import { finDelDia, inicioDelDia } from "@/lib/formato";
import { notificarEvento } from "@/lib/notificaciones/enviar";
import { EVENTO } from "@/lib/notificaciones/eventos";

export const dynamic = "force-dynamic";

/** 7:00: a cada chofer, sus viajes del día (cron de Vercel, con CRON_SECRET). */
async function correr(req: NextRequest) {
  if (!tokenValido(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const desde = inicioDelDia();
  const hasta = finDelDia();
  const choferes = await db.usuario.findMany({ where: { rol: "CHOFER", activo: true }, select: { id: true } });
  let avisados = 0;
  for (const c of choferes) {
    const viajes = await db.viaje.findMany({
      where: {
        choferId: c.id, etapa: "PROGRAMADO", estado: "PROGRAMADO", pedido: { estado: "TOMADO" },
        OR: [{ salidaEstimada: { gte: desde, lte: hasta } }, { salidaEstimada: null, pedido: { paraCuando: { gte: desde, lte: hasta } } }],
      },
      orderBy: [{ ordenRuta: { sort: "asc", nulls: "last" } }, { salidaEstimada: "asc" }],
      select: { salidaEstimada: true, pedido: { select: { descripcion: true, destinoNombre: true } } },
    });
    if (!viajes.length) continue;
    await notificarEvento(EVENTO.resumenChofer({ choferId: c.id, viajes: viajes.map((v) => ({ salida: v.salidaEstimada, descripcion: v.pedido.descripcion, destino: v.pedido.destinoNombre })) }));
    avisados++;
  }
  return NextResponse.json({ ok: true, choferes: choferes.length, avisados });
}

export const GET = correr; // Vercel Cron llama con GET
export const POST = correr;
