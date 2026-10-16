/**
 * HABILITAR SE VE AL INSTANTE: el dueño autoriza la OC de Leandro; Leandro y el dueño tienen "Pedir" abierto y
 * Alejandra habilita el retiro. Sin recargar, a los dos les aparece la tarjeta verde "Listo para retirar" (tiempo
 * real); Alejandra lo ve en Habilitados. "Retiro en proveedor" pedido desde otra obra cae en la obra que tiene algo
 * listo (antes decía "No tenés materiales listos"). Necesita la app con MODO_DEMO=true y los datos de prueba.
 *
 *   npx tsx scripts/recorrido-habilitar.ts [http://localhost:3100]
 */
import { chromium, type Browser, type Page } from "playwright";
import { mkdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE = process.argv[2] ?? "http://localhost:3100";
const DIR = "tmp/capturas/habilitar";
mkdirSync(DIR, { recursive: true });
const ok = (c: unknown, t: string) => {
  if (!c) throw new Error(`FALLÓ: ${t}`);
  console.log(`✓ ${t}`);
};
async function entrar(nav: Browser, quien: string, celular = false) {
  const ctx = await nav.newContext({ viewport: celular ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: celular, hasTouch: celular, serviceWorkers: "block" });
  await ctx.addInitScript(() => sessionStorage.setItem("signa:splash-visto", "1"));
  const p = await ctx.newPage();
  p.setDefaultTimeout(30_000);
  await p.goto(`${BASE}/login`);
  await p.fill("#email", `${quien}@signa.demo`);
  await p.fill("#password", "signa2026");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  await p.waitForTimeout(1500);
  return p;
}
const tarjetas = (p: Page) => p.getByText("Listo para retirar", { exact: true }).count();

(async () => {
  const oc = await db.ordenCompra.findFirstOrThrow({ where: { estado: "ESPERANDO_AUTORIZACION", solicitante: { email: "leandro@signa.demo" } }, select: { id: true, numero: true, obraId: true } });
  const nav = await chromium.launch();
  const dueno = await entrar(nav, "direccion");
  await dueno.goto(`${BASE}/aprobaciones`);
  await dueno.locator("li", { hasText: oc.numero! }).getByRole("button", { name: "Aprobar" }).click();
  await dueno.getByText(/autorizada/).first().waitFor();
  ok(true, `El dueño autoriza ${oc.numero}`);

  const leandro = await entrar(nav, "leandro", true);
  ok(new URL(leandro.url()).pathname === "/pedir", "Leandro entra a Pedir");
  const antesL = await tarjetas(leandro);
  await dueno.goto(`${BASE}/pedir`);
  await dueno.waitForTimeout(1500);
  const antesD = await tarjetas(dueno);
  const alejandra = await entrar(nav, "compras");
  await alejandra.goto(`${BASE}/habilitados`);
  await alejandra.waitForTimeout(1000);
  const ale = await entrar(nav, "compras");
  await ale.goto(`${BASE}/compras/oc/${oc.id}`);
  await ale.waitForTimeout(1500);
  await ale.getByRole("button", { name: /Habilitar para retirar/ }).click();
  await ale.getByRole("dialog").getByRole("radio", { name: /Hasta 1 tn/ }).click();
  const t0 = Date.now();
  await ale.getByRole("dialog").getByRole("button", { name: /^Habilitar$/ }).click();
  await ale.getByText(/Habilitado/).first().waitFor();

  await leandro.waitForFunction((n) => [...document.querySelectorAll("p")].filter((x) => x.textContent === "Listo para retirar").length > n, antesL, { timeout: 20_000 });
  ok(true, `A Leandro (celular, en Pedir) le aparece la tarjeta verde sin recargar (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  await leandro.screenshot({ path: `${DIR}/leandro-pedir.png` });
  await dueno.waitForFunction((n) => [...document.querySelectorAll("p")].filter((x) => x.textContent === "Listo para retirar").length > n, antesD, { timeout: 20_000 });
  ok(true, `Al dueño (en Pedir un viaje) también (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  await alejandra.waitForFunction((n) => document.body.innerText.includes(n), oc.numero!, { timeout: 20_000 });
  ok(true, "Compras lo ve en Habilitados sin recargar");

  // Retiro en proveedor pedido desde otra obra: cae en la que tiene algo listo.
  const otra = await db.responsableObra.findFirst({ where: { usuario: { email: "leandro@signa.demo" }, obraId: { not: oc.obraId! }, activo: true }, select: { obraId: true } });
  if (otra) {
    const listosOtra = await db.materialListo.count({ where: { obraId: otra.obraId, estado: "LISTO", modoEntrega: "RETIRA_CHOFER" } });
    await leandro.goto(`${BASE}/pedir/retiro?obra=${otra.obraId}`);
    await leandro.waitForTimeout(1500);
    const dice = await leandro.getByText(/No tenés materiales listos/).count();
    ok(listosOtra > 0 || !dice, "Retiro en proveedor desde otra obra no dice \"No tenés materiales listos\" si hay en otra");
    await leandro.screenshot({ path: `${DIR}/leandro-retiro.png` });
  }
  await nav.close();
  await db.$disconnect();
  console.log(`\nRecorrido completo. Capturas en ${DIR}`);
})().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
