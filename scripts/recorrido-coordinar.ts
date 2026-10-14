/**
 * RECORRIDO DEL PROMPT 3 como Alejandra (Compras), con capturas en tmp/recorrido-coordinar/: filtra la
 * cola por Pinares y urgentes y guarda la vista; coordina un viaje para Daniela a Darwin (retiro en el
 * corralón); lo ve en Solicitudes agrupado por lugar junto con los otros retiros del mismo corralón;
 * filtra por "pidió Daniela" (historial); Claudio ve "Pidió Daniela · coordinó …".
 *
 *   npx tsx scripts/recorrido-coordinar.ts [http://localhost:3100]
 */
import { chromium, type Browser, type Page } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3100";
const DIR = "tmp/recorrido-coordinar";
mkdirSync(DIR, { recursive: true });
const log = (...x: unknown[]) => console.log("·", ...x);

async function entrar(nav: Browser, quien: string, ancho = 1440) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: ancho < 1024 ? 844 : 900 }, serviceWorkers: "block", isMobile: ancho < 1024, hasTouch: ancho < 1024 });
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
const listo = async (p: Page) => { await p.waitForLoadState("load"); await p.waitForTimeout(900); };
const chip = async (p: Page, etiqueta: string, opcion: string) => {
  await p.getByRole("button", { name: new RegExp(`^${etiqueta}`) }).first().click();
  await p.getByRole("button", { name: new RegExp(opcion) }).first().click();
  await p.waitForTimeout(1200);
  await p.keyboard.press("Escape");
};

async function main() {
  const nav = await chromium.launch();
  const ale = await entrar(nav, "compras");

  // 1. Cola filtrada por Pinares y urgentes; guardar la vista.
  await ale.goto(`${BASE}/compras`);
  await listo(ale);
  await chip(ale, "Obra", "Pinares");
  await chip(ale, "Prioridad", "Urgente");
  await listo(ale);
  log("url filtrada:", ale.url().replace(BASE, ""));
  log("filas:", await ale.locator("table.tabla tbody tr").count(), "· panel por quién pidió:", (await ale.locator("aside").first().innerText()).replace(/\s+/g, " "));
  await ale.getByRole("button", { name: /^Vistas$/ }).click();
  await ale.getByRole("button", { name: /Guardar los filtros/ }).click();
  await ale.getByLabel("Nombre de la vista").fill("Pinares urgentes");
  await ale.getByRole("button", { name: "Guardar", exact: true }).click();
  await ale.waitForTimeout(1500);
  await ale.keyboard.press("Escape");
  await listo(ale);
  log("vista guardada:", await ale.getByRole("button", { name: "Pinares urgentes" }).isVisible());
  await foto(ale, "01-cola-pinares-urgentes");

  // 2. Coordinar un viaje para Daniela a Darwin (retiro en el corralón).
  await ale.goto(`${BASE}/compras/viajes`);
  await listo(ale);
  await ale.getByLabel("Obra", { exact: true }).first().click();
  await ale.getByRole("combobox", { name: "Obra" }).fill("Darwin");
  await ale.getByRole("listbox").getByRole("option").filter({ hasText: "Darwin" }).first().click();
  log("para quién:", await ale.getByLabel("Responsable").inputValue().then(async (v) => (await ale.locator(`option[value="${v}"]`).textContent())));
  await foto(ale, "02-coordinar-para-quien");
  await ale.getByRole("button", { name: /Retirar en un proveedor/ }).click();
  await listo(ale);
  await ale.getByRole("checkbox").filter({ hasText: "Ladrillos" }).click();
  await ale.getByRole("button", { name: "Siguiente" }).click();
  await ale.getByRole("radio", { name: /^Mañana/ }).first().click();
  await foto(ale, "03-coordinar-retiro");
  await ale.getByRole("button", { name: /^Pedir/ }).last().click();
  await ale.waitForURL(/\/compras\/viajes\/solicitudes/, { timeout: 30_000 });
  await listo(ale);

  // 3. Solicitudes agrupadas por lugar.
  const grupos = await ale.locator("aside ul li").allInnerTexts();
  log("por lugar de retiro:", grupos.map((g) => g.replace(/\s+/g, " ")).join(" | "));
  await ale.getByRole("link", { name: /Corralón San Martín/ }).first().click();
  await ale.waitForTimeout(1500);
  await listo(ale);
  log("retiros del corralón:", await ale.locator("table.tabla tbody tr").count());
  log("fila coordinada:", (await ale.locator("table.tabla tbody tr").filter({ hasText: "coordinó" }).first().innerText()).replace(/\s+/g, " ").slice(0, 200));
  await foto(ale, "04-solicitudes-corralon");

  // 4. "Pidió Daniela": su historial (incluidos los pasados).
  await ale.goto(`${BASE}/compras/viajes/solicitudes`);
  await listo(ale);
  await ale.getByRole("link", { name: "Daniela", exact: true }).first().click();
  await ale.waitForTimeout(1500);
  await listo(ale);
  log("historial de Daniela:", await ale.getByText(/Todos los viajes que pidió/).innerText(), "·", (await ale.getByText(/solicitud(es)?( ·|$)/).first().innerText()));
  await foto(ale, "05-pidio-daniela");
  const ale390 = await entrar(nav, "compras", 390);
  await ale390.goto(`${BASE}/compras/viajes/solicitudes`);
  await listo(ale390);
  await foto(ale390, "06-solicitudes-390", true);
  await ale390.goto(`${BASE}/compras`);
  await listo(ale390);
  await ale390.getByRole("button", { name: /^Filtros/ }).click();
  await ale390.waitForTimeout(600);
  await foto(ale390, "07-cola-filtros-hoja-390");

  // 5. Lo que ve Claudio.
  const claudio = await entrar(nav, "claudio", 390);
  await claudio.goto(`${BASE}/solicitudes`);
  await listo(claudio);
  const tarjeta = claudio.locator("li").filter({ hasText: "coordinó" }).first();
  log("Claudio ve:", (await tarjeta.innerText()).replace(/\s+/g, " ").slice(0, 220));
  await tarjeta.scrollIntoViewIfNeeded();
  await foto(claudio, "08-claudio-coordino");
  await nav.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
