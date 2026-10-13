import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/notificaciones";
import { responderLlegada, responderSalida } from "@/lib/viajes/motor";
import { revalidar } from "@/lib/revalidar";

export const dynamic = "force-dynamic";

const esquema = z.object({ accion: z.enum(["si_llegue", "todavia_no", "si_sali", "sigo_aca"]), token: z.string().min(20).max(100) });

/**
 * Respuesta desde la notificación, sin abrir la app (la llama el service worker): "Sí, llegué" / "Todavía
 * no" ante una llegada detectada, "Sí, salí" / "Sigo acá" ante una salida. Vale con el token de un solo
 * uso que vino en la push (30 minutos, atado a ese viaje, esa parada y ese chofer). Termina en las mismas
 * funciones del motor que el deslizador y los botones (auditoría con origen NOTIFICACION, mismos avisos).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const pedidoId = (await params).id;
  const d = esquema.safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json({ ok: false, mensaje: "Pedido inválido." }, { status: 400 });
  const tipo = d.data.accion === "si_llegue" || d.data.accion === "todavia_no" ? "LLEGADA" : "SALIDA";

  // Canje atómico: solo una vez, sin vencer, para este pedido y este tipo de respuesta.
  const t = await db.tokenAccion.findUnique({ where: { hash: hashToken(d.data.token) } });
  if (!t || t.pedidoId !== pedidoId || t.tipo !== tipo) return NextResponse.json({ ok: false, mensaje: "Este aviso ya no sirve. Abrí la app." }, { status: 403 });
  const canje = await db.tokenAccion.updateMany({ where: { id: t.id, usadoEn: null, expiraEn: { gt: new Date() } }, data: { usadoEn: new Date() } });
  if (!canje.count) return NextResponse.json({ ok: false, mensaje: "Este aviso ya se usó o venció. Abrí la app." }, { status: 410 });

  const chofer = await db.usuario.findUnique({ where: { id: t.usuarioId }, select: { nombre: true, activo: true } });
  const viaje = await db.viaje.findUnique({ where: { id: t.viajeId }, select: { choferId: true, pedido: { select: { solicitante: { select: { nombre: true } } } } } });
  if (!chofer?.activo || viaje?.choferId !== t.usuarioId) return NextResponse.json({ ok: false, mensaje: "Este viaje ya no es tuyo." }, { status: 403 });

  const si = d.data.accion === "si_llegue" || d.data.accion === "si_sali";
  const hecho = tipo === "LLEGADA"
    ? await responderLlegada(t.viajeId, si, t.usuarioId, chofer.nombre, "NOTIFICACION")
    : await responderSalida(t.viajeId, si, t.usuarioId, chofer.nombre, "NOTIFICACION");
  revalidar("pedidos");
  if (!hecho) return NextResponse.json({ ok: false, mensaje: "El viaje ya cambió: abrí la app para ver dónde está." });
  const quien = viaje.pedido.solicitante.nombre;
  const mensaje = {
    si_llegue: `Listo, avisamos a ${quien}.`,
    todavia_no: "Listo: te volvemos a avisar cuando llegues.",
    si_sali: `Listo, avisamos a ${quien}.`,
    sigo_aca: "Listo: seguís en el lugar. Avisá cuando salgas.",
  }[d.data.accion];
  return NextResponse.json({ ok: true, mensaje });
}
