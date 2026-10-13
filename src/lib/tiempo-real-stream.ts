import { eventosDesde, yaEntregados } from "@/lib/tiempo-real";

/** Cada cuánto se mira la base. */
export const CADA_MS = 2_000;
/** Vercel corta las funciones largas: a los 50 s se cierra y el navegador reconecta solo. */
export const DURACION_MS = 50_000;

/**
 * El stream SSE de un usuario desde un id (separado de la ruta para poder probarlo). Manda cada evento
 * con "id:" (el navegador lo guarda y lo manda como Last-Event-ID al reconectar) y un latido si no hay nada.
 */
export function abrirStream(o: { usuarioId: string; desde: number; signal?: AbortSignal; cadaMs?: number; duracionMs?: number }) {
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
      o.signal?.addEventListener("abort", cerrar);
      // El primer mensaje fija el punto de partida (id) y le dice al cliente que está conectado.
      enviar(`retry: 1500\nid: ${o.desde}\nevent: hola\ndata: {"desde":${o.desde}}\n\n`);
      let ultimo = o.desde;
      const entregados = await yaEntregados(o.usuarioId, o.desde).catch(() => new Set<number>());
      const fin = Date.now() + (o.duracionMs ?? DURACION_MS);
      while (!cerrado && Date.now() < fin) {
        try {
          const nuevos = await eventosDesde(o.usuarioId, ultimo, entregados);
          for (const e of nuevos) {
            entregados.add(e.id);
            ultimo = Math.max(ultimo, e.id);
            enviar(`id: ${ultimo}\nevent: cambio\ndata: ${JSON.stringify(e)}\n\n`);
          }
          if (!nuevos.length) enviar(": sigo\n\n"); // latido: mantiene viva la conexión en proxies
        } catch {
          // Base ocupada un instante: se reintenta en el próximo ciclo.
        }
        await new Promise((ok) => setTimeout(ok, o.cadaMs ?? CADA_MS));
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
