/**
 * RECORRIDO COMO ALEJANDRA (Compras) contra el servidor local (MODO_DEMO), con capturas en
 * tmp/recorrido-compras/: tablero vacío → OC nueva desde cero con la plantilla → guardar → vista
 * previa → enviar a aprobación → el dueño la aprueba → aparece Autorizada → "Próximos pasos" en línea
 * → PE con su numeración aparte → exportar el tablero (y abrir el Excel) → importar el Excel real
 * (vista previa, sin confirmar salvo IMPORTAR=1).
 *
 *   npx tsx scripts/recorrido-compras.ts [http://localhost:3100]
 */
import { chromium, type Browser, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import ExcelJS from "exceljs";

const BASE = process.argv[2] ?? "http://localhost:3100";
const DIR = "tmp/recorrido-compras";
mkdirSync(DIR, { recursive: true });
const log = (...x: unknown[]) => console.log("·", ...x);

async function entrar(nav: Browser, quien: string, ancho = 1440) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: ancho < 1024 ? 844 : 900 }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(() => sessionStorage.setItem("signa:splash-visto", "1"));
  const p = await ctx.newPage();
  p.setDefaultTimeout(20_000);
  await p.goto(`${BASE}/login`);
  await p.fill("#email", `${quien}@signa.demo`);
  await p.fill("#password", "signa2026");
  await p.click('button[type="submit"]');
  await p.waitForURL("**/inicio", { timeout: 60_000 });
  return p;
}
const foto = (p: Page, n: string, completa = false) => p.screenshot({ path: `${DIR}/${n}.png`, fullPage: completa });
const listo = async (p: Page) => { await p.waitForLoadState("load"); await p.waitForTimeout(800); };

async function elegirCombo(p: Page, nombre: string, texto: string) {
  const c = p.getByRole("combobox", { name: nombre });
  if (!(await c.count())) await p.getByLabel(nombre, { exact: true }).first().click();
  await p.getByRole("combobox", { name: nombre }).fill(texto);
  await p.getByRole("listbox").getByRole("option").filter({ hasText: texto }).first().click();
}

async function main() {
  const nav = await chromium.launch();
  const ale = await entrar(nav, "compras");

  // 1. Tablero vacío
  await ale.goto(`${BASE}/compras/tablero`);
  await listo(ale);
  await foto(ale, "01-tablero-vacio");
  log("tablero vacío:", await ale.getByText("Todavía no hay órdenes").isVisible());

  // 2. OC desde cero con la plantilla
  await ale.goto(`${BASE}/compras/ordenes/nueva`);
  await listo(ale);
  await elegirCombo(ale, "Solicitado por", "Daniela");
  await elegirCombo(ale, "Obra", "Darwin 1299");
  await ale.fill("#oc-detalle", "40 - bolsas de cemento\n10 - barras del 8\n3 rollos malla de seguridad");
  await ale.getByRole("button", { name: "Pasar a renglones" }).click();
  await ale.fill("#oc-sug", "Corralón San Martín");
  await ale.fill("#oc-pres", "P-2231");
  await ale.fill("#oc-importe", "723.839,42");
  await ale.getByRole("radio", { name: /^Transferencia/ }).click();
  await ale.getByRole("radio", { name: /^Anticipo/ }).click();
  await ale.getByLabel("Observaciones de la Orden de Pedido").fill("Descargar por Darwin, el portón de Thames está cerrado.");
  await foto(ale, "02-plantilla-completa", true);
  await ale.getByRole("button", { name: "Guardar", exact: true }).click();
  await ale.waitForURL(/\/compras\/ordenes\/c/, { timeout: 30_000 });
  await listo(ale);
  log("guardada como borrador:", ale.url());
  await ale.goto(`${BASE}/compras/ordenes`);
  await listo(ale);
  await foto(ale, "03-ordenes-con-borrador");
  log("borradores en Órdenes:", await ale.getByText(/Borradores \(\d+\)/).textContent());
  await ale.goBack();
  await listo(ale);

  // Vista previa del PDF
  await ale.getByRole("button", { name: "Vista previa PDF" }).click();
  await ale.locator("iframe[title='Vista previa de la orden']").waitFor({ timeout: 30_000 });
  log("vista previa PDF: ok");
  await ale.keyboard.press("Escape");

  // Enviar a aprobación
  await ale.getByRole("button", { name: "Enviar a aprobación" }).click();
  await ale.waitForURL(/\/compras\/tablero\?ver=/, { timeout: 30_000 });
  await listo(ale);
  await foto(ale, "04-tablero-pedir-autorizacion");
  log("en el tablero:", (await ale.locator("table.tabla-tablero tbody tr").first().innerText()).replace(/\s+/g, " ").slice(0, 160));

  // 3. El dueño la aprueba
  const duenio = await entrar(nav, "direccion");
  await duenio.goto(`${BASE}/aprobaciones`);
  await listo(duenio);
  await foto(duenio, "05-aprobaciones", true);
  await duenio.getByRole("button", { name: "Aprobar", exact: true }).first().click();
  await duenio.waitForTimeout(2500);
  log("dueño aprobó");

  // 4. Autorizada en el tablero; próximos pasos en línea
  await ale.goto(`${BASE}/compras/tablero`);
  await listo(ale);
  const fila = ale.locator("table.tabla-tablero tbody tr").first();
  log("estado:", await fila.locator("td").nth(8).innerText());
  await fila.locator("td").nth(10).getByRole("button").click();
  await ale.keyboard.type("Ya avisé a Claudio que retire el jueves.");
  await ale.keyboard.press("Enter");
  await ale.waitForTimeout(1500);
  await ale.reload();
  await listo(ale);
  log("próximos pasos guardado:", await ale.locator("table.tabla-tablero tbody tr").first().locator("td").nth(10).innerText());
  await foto(ale, "06-tablero-autorizada-proximos-pasos");
  await ale.locator("table.tabla-tablero tbody tr").first().click();
  await ale.waitForURL(/ver=/);
  await listo(ale);
  await foto(ale, "07-tablero-panel-orden");

  // 5. Un PE: numeración aparte
  await ale.goto(`${BASE}/compras/ordenes/nueva?tipo=PE`);
  await listo(ale);
  await elegirCombo(ale, "Solicitado por", "Vicky");
  await elegirCombo(ale, "Obra", "Álvarez Thomas 1545");
  await ale.fill("#oc-detalle", "3 rollos malla seguridad");
  await ale.fill("#oc-sug", "Mercado Libre");
  await ale.getByLabel("A confirmar").check();
  await ale.getByRole("button", { name: "Enviar a aprobación" }).click();
  await ale.waitForURL(/\/compras\/tablero\?ver=/, { timeout: 30_000 });
  await listo(ale);
  const numeros = await ale.locator("table.tabla-tablero tbody tr").evaluateAll((trs) => trs.map((tr) => `${tr.children[0].textContent}-${tr.children[1].textContent}`));
  log("numeración por tipo:", numeros.join(", "));
  await foto(ale, "08-tablero-oc-y-pe");

  // 6. Exportar el tablero y abrir el Excel
  const descarga = ale.waitForEvent("download");
  await ale.getByRole("link", { name: "Exportar a Excel" }).click();
  const d = await descarga;
  const ruta = `${DIR}/tablero-exportado.xlsx`;
  await d.saveAs(ruta);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(ruta);
  const hoja = libro.worksheets[0];
  log("Excel exportado:", hoja.name, "·", (hoja.getRow(1).values as unknown[]).slice(1).join(" | "));
  log("filas:", hoja.rowCount - 1, "· primera:", (hoja.getRow(2).values as unknown[]).slice(1).map((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v)).join(" | ").slice(0, 200));

  // 7. Importar el Excel real (vista previa)
  await ale.goto(`${BASE}/compras/importar`);
  await listo(ale);
  await ale.setInputFiles('input[type="file"][accept=".xlsx"]', "docs/plantilla-oc/ORDENES_DE_COMPRA_PEDIDOS_ESPECIALES.xlsx");
  await ale.getByText("Filas detectadas").waitFor({ timeout: 120_000 });
  await listo(ale);
  const cifras = await ale.locator("button:has(p.etiqueta)").evaluateAll((bs) => bs.slice(0, 4).map((b) => b.textContent?.replace(/\s+/g, " ").trim()));
  log("vista previa:", cifras.join(" · "));
  const pendiente = await ale.locator("p.bg-aviso-fondo").first().textContent().catch(() => null);
  if (pendiente) log("obras pendientes:", pendiente);
  await foto(ale, "09-importar-vista-previa");
  const errores = await ale.locator("tr.bg-critico-fondo").evaluateAll((trs) => trs.slice(0, 40).map((tr) => `fila ${tr.children[0].textContent}: ${tr.lastElementChild?.textContent}`));
  writeFileSync(`${DIR}/importar-errores.txt`, errores.join("\n"));
  log("errores (primeros):", errores.slice(0, 8).join(" | "));
  if (process.env.IMPORTAR === "1") {
    await ale.getByRole("button", { name: /^Importar \d+ filas válidas/ }).click();
    await ale.getByText("Listo: tu tablero está en el sistema.").waitFor({ timeout: 180_000 });
    await foto(ale, "10-importacion-resultado", true);
    log("importación:", (await ale.locator("main").innerText()).split("\n").slice(0, 14).join(" · "));
    await ale.goto(`${BASE}/compras/tablero`);
    await listo(ale);
    await foto(ale, "11-tablero-con-historial");
    const ale390 = await entrar(nav, "compras", 390);
    await ale390.goto(`${BASE}/compras/tablero`);
    await listo(ale390);
    await foto(ale390, "12-tablero-390", true);
  }
  await nav.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
