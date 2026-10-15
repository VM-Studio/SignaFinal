import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { db } from "@/lib/db";
import { leerBuffer } from "@/lib/archivos";
import { incluirDocumento } from "./celdas";
import { hojaDe } from "./hoja";
import { pdfConReactPdf } from "./pdfHoja";

/**
 * PDF = LA PLANTILLA. Chromium (playwright-core; en Vercel, @sparticuz/chromium) abre /compras/oc/[id]/imprimir
 * —el mismo componente de la pantalla, en modo lectura y con el CSS de impresión A4— con un token de un solo
 * uso, y lo imprime. Si Chromium no está disponible, el respaldo dibuja la misma grilla con @react-pdf.
 * Si hay factura adjunta (sección 3), va como segunda página. Solo lo usan las rutas /api/oc/[id]/pdf (así el
 * binario de Chromium está en una sola función).
 */
export type MotorPDF = "chromium" | "react-pdf";

/** Token de un solo uso (10 min) para que Chromium abra la hoja sin sesión. */
async function tokenImpresion(ordenCompraId: string) {
  const token = randomBytes(24).toString("base64url");
  await db.tokenDocumento.create({ data: { hash: createHash("sha256").update(token).digest("hex"), ordenCompraId, expiraEn: new Date(Date.now() + 10 * 60_000) } });
  return token;
}

/** Valida y gasta el token (lo llama la página de impresión). */
export async function usarTokenImpresion(ordenCompraId: string, token: string) {
  const hash = createHash("sha256").update(token).digest("hex");
  const r = await db.tokenDocumento.updateMany({ where: { hash, ordenCompraId, usadoEn: null, expiraEn: { gt: new Date() } }, data: { usadoEn: new Date() } });
  return r.count === 1;
}

async function navegador() {
  const { chromium } = await import("playwright-core");
  if (process.env.VERCEL) {
    const sparticuz = (await import("@sparticuz/chromium")).default;
    return chromium.launch({ args: sparticuz.args, executablePath: await sparticuz.executablePath(), headless: true });
  }
  // En la máquina de desarrollo: el Chromium de Playwright (el de los tests).
  return chromium.launch({ headless: true });
}

async function conChromium(ordenCompraId: string, base: string) {
  const token = await tokenImpresion(ordenCompraId);
  const nav = await navegador();
  try {
    const p = await nav.newPage();
    const r = await p.goto(`${base}/compras/oc/${ordenCompraId}/imprimir?token=${token}`, { waitUntil: "load", timeout: 25_000 });
    if (!r?.ok() || !(await p.locator("[data-hoja-lista]").count())) throw new Error(`La hoja no abrió (${r?.status()})`);
    await p.evaluate(() => document.fonts.ready);
    return await p.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  } finally {
    await nav.close();
  }
}

/** Factura adjunta como segunda página (PDF: sus páginas; imagen: en una A4). */
async function agregarFactura(pdf: Uint8Array, adjuntoId: string | null) {
  if (!adjuntoId) return pdf;
  const a = await db.adjunto.findUnique({ where: { id: adjuntoId }, select: { url: true, tipoMime: true } });
  const bytes = a ? await leerBuffer(a.url).catch(() => null) : null;
  if (!a || !bytes) return pdf;
  const doc = await PDFDocument.load(pdf);
  try {
    if (a.tipoMime === "application/pdf") {
      const factura = await PDFDocument.load(bytes, { ignoreEncryption: true });
      for (const pagina of await doc.copyPages(factura, factura.getPageIndices())) doc.addPage(pagina);
    } else if (a.tipoMime === "image/png" || a.tipoMime === "image/jpeg") {
      const img = a.tipoMime === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const pagina = doc.addPage([595.28, 841.89]);
      const escala = Math.min((595.28 - 60) / img.width, (841.89 - 60) / img.height, 1);
      pagina.drawImage(img, { x: (595.28 - img.width * escala) / 2, y: (841.89 - img.height * escala) / 2, width: img.width * escala, height: img.height * escala });
    } else return pdf;
  } catch (e) {
    console.error("No se pudo agregar la factura al PDF", adjuntoId, e);
    return pdf;
  }
  return doc.save();
}

/** El PDF del documento tal cual está ahora. */
export async function generarPDF(ordenCompraId: string, base: string): Promise<{ pdf: Uint8Array; motor: MotorPDF; nombre: string }> {
  const d = await db.ordenCompra.findUniqueOrThrow({ where: { id: ordenCompraId }, include: incluirDocumento });
  let pdf: Uint8Array;
  let motor: MotorPDF = "chromium";
  try {
    pdf = await conChromium(ordenCompraId, base);
  } catch (e) {
    console.error("PDF con Chromium no disponible: uso el respaldo", e instanceof Error ? e.message : e);
    pdf = new Uint8Array(await pdfConReactPdf(hojaDe(d)));
    motor = "react-pdf";
  }
  pdf = await agregarFactura(pdf, d.facturaAdjuntoId);
  const nombre = `${d.numero ?? `${d.tipo}-${d.numeroInterno}`}${d.versionAprobacion > 1 ? `-v${d.versionAprobacion}` : ""}.pdf`;
  return { pdf, motor, nombre };
}
