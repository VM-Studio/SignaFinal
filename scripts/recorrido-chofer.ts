/**
 * RECORRIDO DEL CHOFER EN EL CELULAR (390 px), contra el servidor local con la base de prueba
 * (MODO_DEMO=true npx prisma db seed): Claudio acepta el retiro de cemento para Darwin, "¿Llevás algo más?" le
 * ofrece la hormigonera de Humboldt para la misma obra, dice "Sí, lo llevo", y hace todos los pasos con el
 * deslizador (Iniciar → Llegué a … → En camino a … → … → Terminar) sin escribir ningún número. También: Camila
 * ve Facturación primero y el dueño tiene "Pedir un viaje" en la barra. Capturas en tmp/capturas/chofer/.
 *
 *   npx tsx scripts/recorrido-chofer.ts [http://localhost:3100]
 */
import { chromium, type Browser, type Page } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3100";
// ANCHO=360|390|430|768: mide además desbordes y el texto de los deslizadores en cada paso (auditoría responsive).
const ANCHO = Number(process.env.ANCHO) || 390;
const DIR = `tmp/capturas/chofer${ANCHO === 390 ? "" : `-${ANCHO}`}`;
mkdirSync(DIR, { recursive: true });
let n = 0;
const ok = (c: unknown, t: string) => {
  console.log(`${c ? "✓" : "✗"} ${t}`);
  if (!c) throw new Error(`FALLÓ: ${t}`);
};

async function entrar(nav: Browser, quien: string) {
  const ctx = await nav.newContext({ viewport: { width: ANCHO, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.addInitScript(() => sessionStorage.setItem("signa:splash-visto", "1"));
  const p = await ctx.newPage();
  p.setDefaultTimeout(20_000);
  await p.goto(`${BASE}/login`);
  await p.fill("#email", `${quien}@signa.demo`);
  await p.fill("#password", "signa2026");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  await p.waitForTimeout(1200);
  return p;
}
const foto = (p: Page, nombre: string, completa = false) => p.screenshot({ path: `${DIR}/${String(++n).padStart(2, "0")}-${nombre}.png`, fullPage: completa });
/** Inputs para escribir números visibles (no debería haber ninguno). */
/** Nada se sale de la pantalla y el texto del deslizador entra entero. */
const prolijo = (p: Page) =>
  p.evaluate(() => {
    const W = window.innerWidth;
    const fuera = [...document.querySelectorAll("body *")].filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || (r.right <= W + 1 && r.left >= -1)) return false;
      for (let a = el.parentElement; a; a = a.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(a).overflowX) && a.getBoundingClientRect().right <= W + 1) return false;
      return true;
    }).length;
    const cortado = [...document.querySelectorAll("[role=slider] p")].some((x) => (x as HTMLElement).scrollWidth > (x as HTMLElement).clientWidth + 1 || (x as HTMLElement).scrollHeight > (x as HTMLElement).clientHeight + 1);
    return { fuera, cortado, scroll: document.documentElement.scrollWidth > W + 1 };
  });
const numericos = (p: Page) => p.locator('input[inputmode="numeric"], input[inputmode="decimal"], input[type="number"]').filter({ visible: true }).count();

(async () => {
  const nav = await chromium.launch();

  // ── Claudio ──
  const c = await entrar(nav, "claudio");
  ok(new URL(c.url()).pathname === "/hoy", "Claudio entra en Hoy");
  await c.goto(`${BASE}/solicitudes`);
  await c.getByText(/Cemento Portland/).first().click();
  await c.waitForURL(/\/solicitudes\//);
  await c.getByRole("button", { name: "Aceptar" }).first().click();
  const hoja = c.getByRole("dialog");
  await hoja.getByText("¿Llevás algo más?").first().waitFor();
  await c.waitForTimeout(600);
  await foto(c, "llevas-algo-mas", true);
  const ml = await prolijo(c);
  ok(!ml.fuera && !ml.scroll, `"¿Llevás algo más?" a ${ANCHO} px: nada se sale`);
  ok(await hoja.getByText(/Para la misma obra \(Darwin\) también pidieron:/).count(), "¿Llevás algo más? agrupa \"Para la misma obra (Darwin)\"");
  const hormigonera = hoja.locator("li", { hasText: "Hormigonera" }).first();
  ok(await hormigonera.count(), "Le ofrece la hormigonera de Humboldt para la misma obra");
  await hormigonera.getByRole("button", { name: "Sí, lo llevo" }).click();
  for (const otra of await hoja.locator("li[data-sugerencia]").all()) {
    if ((await otra.textContent())?.includes("Hormigonera")) continue;
    await otra.getByRole("button", { name: "No" }).click();
  }
  await hoja.getByRole("button", { name: /Llevo 2 pedidos/ }).click();
  await hoja.getByRole("radio", { name: /Mercedes/ }).click();
  await hoja.getByRole("button", { name: "Confirmar" }).click();
  await c.waitForTimeout(2500);

  await c.goto(`${BASE}/hoy`);
  await c.waitForTimeout(1500);
  await foto(c, "hoy");
  await c.getByRole("link", { name: "Iniciar viaje" }).first().click();
  await c.waitForURL(/\/conducir/);
  await c.waitForTimeout(1500);

  const titulos: string[] = [];
  for (let i = 0; i < 12; i++) {
    const slider = c.getByRole("slider");
    await slider.waitFor();
    const titulo = (await slider.getAttribute("aria-label")) ?? "";
    const paso = (await c.locator("header p").first().textContent())?.trim() ?? "";
    titulos.push(titulo);
    ok((await numericos(c)) === 0, `${paso} · "${titulo}": sin campos para escribir números`);
    const m = await prolijo(c);
    ok(!m.fuera && !m.scroll && !m.cortado, `"${titulo}" a ${ANCHO} px: nada se sale y el deslizador se lee entero`);
    await foto(c, `paso-${i + 1}`);
    await slider.focus();
    for (let k = 0; k < 10; k++) await c.keyboard.press("ArrowRight");
    if (titulo === "Terminar viaje") break;
    await c.waitForFunction((t) => document.querySelector('[role="slider"]')?.getAttribute("aria-label") !== t, titulo, { timeout: 20_000 });
    await c.waitForTimeout(800);
  }
  console.log(`  Pasos: ${titulos.join(" → ")}`);
  ok(titulos[0] === "Iniciar viaje" && titulos.at(-1) === "Terminar viaje", "Empieza en Iniciar viaje y termina en Terminar viaje");
  ok(titulos.length === 6 && titulos.filter((t) => t.startsWith("Llegué a")).length === 2 && titulos.filter((t) => t.startsWith("En camino a")).length === 2, "Seis pasos: dos retiros y la obra (Llegué / En camino por cada retiro)");
  ok(!titulos.some((t) => /^Salgo/.test(t)), "Ningún paso \"Salgo\" aparte");

  const fin = c.getByRole("dialog");
  await fin.getByRole("button", { name: "$0" }).waitFor();
  ok((await numericos(c)) === 0, "Terminar viaje: peajes con $0 / Escribir, sin km");
  const mf = await prolijo(c);
  ok(!mf.fuera && !mf.scroll, `Hoja "Terminar viaje" a ${ANCHO} px: nada se sale`);
  await foto(c, "terminar");
  await fin.getByRole("button", { name: "Terminar viaje" }).click();
  await c.waitForURL((u) => /\/viaje\/[^/]+$/.test(u.pathname), { timeout: 30_000 });
  await c.waitForTimeout(1500);
  await foto(c, "viaje-terminado");
  ok(await c.getByText(/Viaje terminado/).count(), "Viaje terminado sin escribir ningún número");
  await c.context().close();

  // ── Camila: Facturación primero ──
  const a = await entrar(nav, "administracion");
  const barraA = (await a.locator("nav").last().getByRole("link").allTextContents()).map((t) => t.replace(/\d+/g, "").trim());
  ok(barraA[0] === "Facturación" && barraA[1] === "Costos" && barraA[2] === "Tablero", `Camila: barra ${barraA.slice(0, 3).join(" · ")}`);
  ok((await a.getByText("OC con facturación pendiente").count()) > 0, "Camila: su inicio empieza por \"OC con facturación pendiente\"");
  await foto(a, "camila-inicio", true);
  await a.context().close();

  // ── El dueño: Pedir un viaje en la barra ──
  const d = await entrar(nav, "direccion");
  const barraD = (await d.locator("nav").last().getByRole("link").allTextContents()).map((t) => t.replace(/\d+/g, "").trim());
  ok(barraD.includes("Pedir un viaje"), `Dueño: barra ${barraD.join(" · ")}`);
  await d.locator("nav").last().getByRole("link", { name: /Pedir un viaje/ }).click();
  await d.waitForURL(/\/pedir/);
  await d.waitForTimeout(1000);
  ok(await d.getByText("¿Qué hay que hacer?").count(), "Pedir un viaje abre el formulario de viaje");
  await foto(d, "dueno-pedir");
  await d.context().close();

  await nav.close();
  console.log(`\nRecorrido completo. Capturas en ${DIR}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
