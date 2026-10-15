import "server-only";
import { after } from "next/server";
import { headers } from "next/headers";

/**
 * Guardar el PDF del documento (al enviarlo a autorización: pdfUrl; al autorizarlo: pdfAprobadaUrl con
 * "AUTORIZADA por …"). Se hace después de responder (no demora el botón) pidiéndoselo a /api/oc/[id]/pdf,
 * que es la única función con Chromium. Si falla, el botón "Imprimir / PDF" lo genera igual en el momento.
 */
export async function guardarPDF(ordenCompraId: string, autorizada: boolean) {
  const base = await baseURL();
  const secreto = process.env.CRON_SECRET ?? process.env.AUTH_SECRET ?? "";
  after(async () => {
    try {
      const r = await fetch(`${base}/api/oc/${ordenCompraId}/pdf`, { method: "POST", headers: { "x-interno": secreto, "content-type": "application/json" }, body: JSON.stringify({ autorizada }) });
      if (!r.ok) console.error("No se pudo guardar el PDF", ordenCompraId, r.status);
    } catch (e) {
      console.error("No se pudo guardar el PDF", ordenCompraId, e);
    }
  });
}

/** Dirección de esta misma app (para que Chromium abra la hoja de impresión). */
export async function baseURL() {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")}://${host}`;
  } catch {}
  return process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
}
