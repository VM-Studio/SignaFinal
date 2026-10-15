/**
 * CAPTURAS DEL CIRCUITO DE COMPRAS a 390 y 1440 px (tmp/capturas/compras/): tablero con la franja de pedidos
 * nuevos, una orden a página completa y la vuelta al tablero con filtros y scroll, plantilla de OC y PE, PDF, importación (vista previa con tmp/tablero-ejemplo.xlsx), cola con
 * filtros, coordinar viaje y solicitudes agrupadas por lugar. Las del inicio y la barra de cada rol las
 * saca scripts/capturas-roles.ts.
 *
 *   npx tsx scripts/capturas-compras.ts [http://localhost:3100]
 */
import { chromium, type Browser, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3100";
const DIR = "tmp/capturas/compras";
mkdirSync(DIR, { recursive: true });

async function entrar(nav: Browser, quien: string, ancho: number) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: ancho < 1024 ? 844 : 900 }, isMobile: ancho < 1024, hasTouch: ancho < 1024, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(() => sessionStorage.setItem("signa:splash-visto", "1"));
  const p = await ctx.newPage();
  p.setDefaultTimeout(30_000);
  await p.goto(`${BASE}/login`);
  await p.fill("#email", `${quien}@signa.demo`);
  await p.fill("#password", "signa2026");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  await p.waitForTimeout(3000);
  return p;
}
const ir = async (p: Page, ruta: string) => { await p.goto(`${BASE}${ruta}`); await p.waitForLoadState("load"); await p.waitForTimeout(1200); };

(async () => {
  const nav = await chromium.launch();
  for (const ancho of [390, 1440]) {
    const p = await entrar(nav, "compras", ancho);
    const foto = (n: string, completa = false) => p.screenshot({ path: `${DIR}/${ancho}-${n}.png`, fullPage: completa });

    // Tablero con la franja negra de pedidos nuevos (Compras entra directo acá, sin /inicio).
    await ir(p, "/compras/tablero");
    await foto("01-tablero");
    await ir(p, "/compras?filtro=nuevos");
    await foto("01b-pedidos-nuevos");

    // Una fila abre la orden a página completa; "← Volver al tablero" vuelve con los filtros y el scroll.
    await ir(p, "/compras/tablero?orden=numero-asc&tipo=OC");
    await p.evaluate(() => window.scrollTo(0, 400));
    await p.waitForTimeout(400);
    const antes = { url: p.url(), y: await p.evaluate(() => window.scrollY) };
    const fila = ancho < 1024 ? p.locator("ul li a[href*='/compras/oc/']").last() : p.locator(".planilla tbody tr").last().locator("td").nth(5);
    await fila.click();
    await p.waitForURL(/\/compras\/oc\//);
    await p.waitForTimeout(1500);
    await foto("02-orden-pagina-completa");
    const ocId = new URL(p.url()).pathname.split("/").pop()!;
    await foto("03-plantilla-oc", true);
    await p.getByRole("link", { name: /Volver/ }).first().click();
    await p.waitForURL(/\/compras\/tablero/);
    await p.waitForTimeout(1500);
    const despues = { url: p.url(), y: await p.evaluate(() => window.scrollY) };
    console.log(`${ancho}: volver al tablero ${despues.url === antes.url && Math.abs(despues.y - antes.y) < 60 ? "✓" : "✗"} (${antes.url} y=${antes.y} → ${despues.url} y=${despues.y})`);
    await foto("02b-volvio-al-tablero");

    await ir(p, "/compras/oc/nueva");
    await foto("04a-nueva");
    await p.getByRole("button", { name: "Armar pedido especial" }).click();
    await p.waitForURL(/\/compras\/oc\/(?!nueva)/);
    await p.waitForTimeout(1500);
    await foto("04-plantilla-pe");

    if (ancho === 1440) {
      const r = await p.context().request.get(`${BASE}/api/oc/${ocId}/pdf`);
      writeFileSync(`${DIR}/05-pdf.pdf`, await r.body());
    }

    // Importar: por ahora la usa el dueño (Más → Compras → Importar Excel); Compras sigue teniendo la ruta.
    await ir(p, "/compras/importar");
    await p.setInputFiles('input[type="file"][accept=".xlsx"]', "tmp/tablero-ejemplo.xlsx");
    await p.getByText("Filas detectadas").waitFor({ timeout: 60_000 });
    await p.waitForTimeout(800);
    await foto("06-importar-vista-previa", ancho < 1024);

    await ir(p, "/compras?prioridad=URGENTE");
    await foto("07-cola-filtros");
    if (ancho < 1024) {
      await p.getByRole("button", { name: /^Filtros/ }).click();
      await p.waitForTimeout(600);
      await foto("07b-cola-filtros-hoja");
      await p.keyboard.press("Escape");
    }

    await ir(p, "/compras/viajes");
    await p.getByLabel("Obra", { exact: true }).first().click();
    await p.getByRole("combobox", { name: "Obra" }).fill("Darwin");
    await p.getByRole("listbox").getByRole("option").filter({ hasText: "Darwin" }).first().click();
    await p.waitForTimeout(600);
    await foto("08-coordinar-viaje", ancho < 1024);

    await ir(p, "/compras/viajes/solicitudes");
    const lugar = p.getByRole("link", { name: /Corralón San Martín/ }).first();
    if (await lugar.count()) { await lugar.click(); await p.waitForTimeout(1500); }
    await foto("09-solicitudes-por-lugar", ancho < 1024);

    await p.context().close();
  }
  // El dueño: aprobaciones y razones sociales.
  for (const ancho of [390, 1440]) {
    const p = await entrar(nav, "direccion", ancho);
    await ir(p, "/aprobaciones");
    await p.screenshot({ path: `${DIR}/${ancho}-11-aprobaciones.png`, fullPage: ancho < 1024 });
    await ir(p, "/configuracion/razones-sociales");
    await p.screenshot({ path: `${DIR}/${ancho}-12-razones-sociales.png` });
    await p.context().close();
  }
  await nav.close();
  console.log(`listo: ${DIR}`);
})();
