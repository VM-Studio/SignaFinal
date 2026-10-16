/**
 * LA LISTA DE MATERIALES ADJUNTA LLEGA (y un Excel se transcribe al Detalle del Pedido):
 *  1. Daniela arma una OC, elige la obra y adjunta una planilla .xlsx y un PDF, SIN tocar ningún otro botón: los
 *     dos quedan en el documento y los materiales del Excel aparecen en "Detalle del Pedido". La envía a Compras.
 *  2. Alejandra (Compras) abre el pedido y ve los dos adjuntos y el detalle con las cantidades.
 *  3. Daniela pide materiales rápido ("Pedir materiales") con solo el Excel: el detalle sale de la planilla.
 *  4. Una OC con solo un PDF adjunto (sin detalle escrito) se puede enviar: el detalle dice "Ver lista adjunta".
 * Necesita la app con MODO_DEMO=true y los datos de prueba. Capturas en tmp/capturas/lista-excel/.
 *
 *   npx tsx scripts/recorrido-lista-excel.ts [http://localhost:3100]
 */
import { chromium, type Browser, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE = process.argv[2] ?? "http://localhost:3100";
const DIR = "tmp/capturas/lista-excel";
mkdirSync(DIR, { recursive: true });
let paso = 0;
const foto = (p: Page, nombre: string) => p.screenshot({ path: `${DIR}/${String(++paso).padStart(2, "0")}-${nombre}.png`, fullPage: true });
const ok = (c: unknown, t: string) => {
  if (!c) throw new Error(`FALLÓ: ${t}`);
  console.log(`✓ ${t}`);
};

async function entrar(nav: Browser, quien: string, celular = false) {
  const ctx = await nav.newContext({ viewport: celular ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: celular, hasTouch: celular, serviceWorkers: "block" });
  await ctx.addInitScript(() => sessionStorage.setItem("signa:splash-visto", "1"));
  const p = await ctx.newPage();
  p.setDefaultTimeout(30_000);
  p.on("pageerror", (e) => console.log(`  [error en la página de ${quien}]`, e.message));
  await p.goto(`${BASE}/login`);
  await p.fill("#email", `${quien}@signa.demo`);
  await p.fill("#password", "signa2026");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  await p.waitForTimeout(1500);
  return p;
}
const celda = (p: Page, c: string) => p.locator(`.hoja [data-celda="${c}"]`).first();
const guardado = async (p: Page) => {
  await p.waitForTimeout(1200);
  await p.waitForFunction(() => !document.body.innerText.includes("Guardando…"), null, { timeout: 15_000 });
};
/** El texto de la celda (en un textarea si es editable). */
const textoCelda = (p: Page, c: string) => celda(p, c).evaluate((el) => (el.querySelector("textarea") as HTMLTextAreaElement | null)?.value ?? el.textContent ?? "");
const elegir = async (p: Page, c: string, texto: string | RegExp) => {
  await celda(p, c).locator("button").first().click();
  await p.getByRole("button", { name: texto }).first().click();
};

async function planilla(ruta: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Materiales");
  ws.addRow(["LISTA DE MATERIALES - OBRA DARWIN"]);
  ws.addRow([]);
  ws.addRow(["Ítem", "Descripción", "Cantidad", "Unidad"]);
  ws.addRow([1, "Cemento Loma Negra 50 kg", 40, "bolsas"]);
  ws.addRow([2, "Hierro del 8", 20, "barras"]);
  ws.addRow([3, "Arena gruesa", 6, "m3"]);
  writeFileSync(ruta, Buffer.from(await wb.xlsx.writeBuffer()));
}
const PDF = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF";

(async () => {
  const xlsx = `${DIR}/lista-darwin.xlsx`;
  const pdf = `${DIR}/presupuesto.pdf`;
  await planilla(xlsx);
  writeFileSync(pdf, PDF);
  const nav = await chromium.launch();

  // ── 1. Daniela arma la OC y adjunta, sin un segundo botón ──
  const daniela = await entrar(nav, "daniela");
  await daniela.goto(`${BASE}/pedir`);
  await daniela.getByRole("button", { name: "Armar orden de compra" }).click();
  await daniela.waitForURL(/\/compras\/oc\/[^/?]+/);
  const url = daniela.url().split("?")[0];
  const id = url.split("/").pop()!;
  await daniela.waitForTimeout(1500);
  await elegir(daniela, "obra", /Obra Darwin/);
  await guardado(daniela);
  await daniela.locator('input[type="file"][multiple]').setInputFiles([xlsx, pdf]);
  await daniela.getByText(/3 materiales pasaron al Detalle del Pedido/).waitFor({ timeout: 30_000 });
  ok(true, "Al terminar de subir, los dos archivos quedan en el documento (sin \"Guardar el archivo\")");
  await daniela.waitForFunction(() => document.querySelector('.hoja [data-celda="detalleDelPedido"]')?.textContent?.includes("40 bolsas Cemento Loma Negra"), null, { timeout: 15_000 });
  const detalle = (await textoCelda(daniela, "detalleDelPedido")).trim();
  ok(/40 bolsas Cemento Loma Negra 50 kg/.test(detalle) && /20 barras Hierro del 8/.test(detalle) && /6 m³ Arena gruesa/.test(detalle), `El Excel pasó al Detalle del Pedido: ${detalle.replace(/\n/g, " / ")}`);
  await foto(daniela, "daniela-adjunta-excel");
  await daniela.getByRole("button", { name: "Enviar a Compras" }).click();
  await daniela.getByText(/Enviada a Compras/).first().waitFor();
  const adj = await db.adjunto.findMany({ where: { entidadTipo: "ORDEN_COMPRA", entidadId: id }, select: { nombre: true } });
  ok(adj.length === 2, `Los dos adjuntos quedaron en la orden (${adj.map((a) => a.nombre).join(", ")})`);

  // ── 2. Alejandra los ve ──
  const alejandra = await entrar(nav, "compras");
  await alejandra.goto(url);
  await alejandra.waitForTimeout(2000);
  ok(await alejandra.getByText("lista-darwin.xlsx").count(), "Compras ve la planilla adjunta");
  ok(await alejandra.getByText("presupuesto.pdf").count(), "Compras ve el PDF adjunto");
  ok((await textoCelda(alejandra, "detalleDelPedido")).includes("20 barras Hierro del 8"), "Compras ve el detalle con las cantidades");
  await foto(alejandra, "compras-ve-adjuntos");

  // ── 3. "Pedir materiales" con solo el Excel ──
  await daniela.goto(`${BASE}/pedir-materiales`);
  await daniela.waitForTimeout(1500);
  await daniela.getByPlaceholder("Buscar por nombre o localidad").fill("Darwin");
  await daniela.getByRole("option", { name: /Darwin/ }).or(daniela.getByRole("button", { name: /Obra Darwin/ })).first().click();
  await daniela.locator('input[type="file"][multiple]').setInputFiles([xlsx]);
  await daniela.getByText(/subido/).first().waitFor();
  await foto(daniela, "pedir-materiales-excel");
  await daniela.getByRole("button", { name: /Pedir a Compras/ }).click();
  await daniela.waitForTimeout(3000);
  await foto(daniela, "pedir-materiales-enviado");
  const rapido = await db.ordenCompra.findFirst({ where: { creadaPor: { email: "daniela@signa.demo" }, id: { not: id } }, orderBy: { creadoEn: "desc" }, select: { detallePedido: true, _count: { select: { renglones: true } } } });
  ok(rapido?.detallePedido?.includes("40 bolsas Cemento Loma Negra 50 kg") && rapido._count.renglones === 3, `Pedir materiales: el detalle sale del Excel (${rapido?._count.renglones} renglones)`);

  // ── 4. Solo un PDF: se puede enviar igual ──
  await daniela.goto(`${BASE}/pedir`);
  await daniela.getByRole("button", { name: "Armar orden de compra" }).click();
  await daniela.waitForURL(/\/compras\/oc\/[^/?]+/);
  const id2 = daniela.url().split("?")[0].split("/").pop()!;
  await daniela.waitForTimeout(1500);
  await elegir(daniela, "obra", /Obra Darwin/);
  await guardado(daniela);
  await daniela.locator('input[type="file"][multiple]').setInputFiles([pdf]);
  await daniela.getByText(/Archivo adjuntado/).waitFor();
  await daniela.getByRole("button", { name: "Enviar a Compras" }).click();
  await daniela.getByText(/Enviada a Compras/).first().waitFor();
  const d2 = await db.ordenCompra.findUniqueOrThrow({ where: { id: id2 }, select: { estado: true, detallePedido: true } });
  ok(d2.estado === "ENVIADA_A_COMPRAS" && d2.detallePedido === "Ver lista adjunta (presupuesto.pdf)", `Con solo un PDF se envía: "${d2.detallePedido}"`);

  await nav.close();
  await db.$disconnect();
  console.log(`\nRecorrido completo. Capturas en ${DIR}`);
})().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
