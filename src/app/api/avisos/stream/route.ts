import { obtenerSesion } from "@/lib/auth/sesion";
import { estadoAvisos } from "@/lib/avisos/estado";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Cada cuánto se mira la base (solo conteos). */
const CADA_MS = 3_000;
/** Vercel corta las funciones largas: a los 50 s se cierra y el navegador reconecta solo. */
const DURACION_MS = 50_000;

/**
 * Avisos en vivo (Server-Sent Events): la campana se actualiza al instante y muestra el aviso
 * nuevo. Manda un evento solo cuando algo cambió. El navegador (EventSource) reconecta solo.
 */
export async function GET(req: Request) {
  const u = await obtenerSesion();
  if (!u) return new Response("Sin sesión", { status: 401 });
  const codificar = new TextEncoder();
  let cerrado = false;

  const stream = new ReadableStream({
    async start(controller) {
      const enviar = (texto: string) => {
        if (!cerrado) controller.enqueue(codificar.encode(texto));
      };
      const cerrar = () => {
        if (cerrado) return;
        cerrado = true;
        try {
          controller.close();
        } catch {}
      };
      req.signal.addEventListener("abort", cerrar);
      enviar("retry: 1500\n\n");
      const fin = Date.now() + DURACION_MS;
      let anterior = "";
      while (!cerrado && Date.now() < fin) {
        try {
          const e = await estadoAvisos(u);
          const firma = JSON.stringify(e);
          if (firma !== anterior) {
            enviar(`event: avisos\ndata: ${firma}\n\n`);
            anterior = firma;
          } else enviar(": sigo\n\n"); // latido: mantiene viva la conexión en proxies
        } catch {
          // Base ocupada un instante: se reintenta en el próximo ciclo.
        }
        await new Promise((ok) => setTimeout(ok, CADA_MS));
      }
      cerrar();
    },
    cancel() {
      cerrado = true;
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
