import { obtenerSesion } from "@/lib/auth/sesion";
import { abrirStream } from "@/lib/tiempo-real-stream";
import { eventosDesde, ultimoEvento, yaEntregados } from "@/lib/tiempo-real";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Tiempo real por usuario (Server-Sent Events). Cada 2 s mira sus EventoCambio nuevos y los manda con
 * su id; a los 50 s corta y el navegador reconecta solo mandando Last-Event-ID, sin perder eventos.
 * Sin "desde" arranca en el último (no repite la historia). ?modo=json: lo mismo para el polling.
 */
export async function GET(req: Request) {
  const u = await obtenerSesion();
  if (!u) return new Response("Sin sesión", { status: 401 });
  const url = new URL(req.url);
  const pedido = Number(req.headers.get("last-event-id") ?? url.searchParams.get("desde") ?? NaN);
  const desde = Number.isFinite(pedido) && pedido >= 0 ? pedido : await ultimoEvento(u.id);

  if (url.searchParams.get("modo") === "json") {
    const eventos = await eventosDesde(u.id, desde, await yaEntregados(u.id, desde));
    return Response.json({ eventos, ultimo: eventos.reduce((m, e) => Math.max(m, e.id), desde) }, { headers: { "Cache-Control": "no-store" } });
  }
  return abrirStream({ usuarioId: u.id, desde, signal: req.signal });
}
