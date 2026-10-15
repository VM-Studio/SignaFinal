/**
 * CAPTURAS de las 15 pantallas más usadas a 390 px (celular) y 1440 px (escritorio), para comparar
 * antes y después de un cambio de diseño. Guarda en tmp/capturas/<etiqueta>/<ancho>-<nombre>.png.
 *
 *   npx tsx scripts/capturas-principales.ts antes   (contra http://localhost:3100, MODO_DEMO=true)
 */
import { chromium, type Browser, type Page } from "playwright";
import { mkdirSync } from "node:fs";

const ETIQUETA = process.argv[2] ?? "capturas";
const BASE = process.argv[3] ?? "http://localhost:3100";

// [quién, nombre, ruta]; {lista|prefijo} toma el primer detalle de esa lista.
const PANTALLAS: [string, string, string][] = [
  ["direccion", "01-inicio-direccion", "/inicio"],
  ["direccion", "02-mapa", "/mapa"],
  ["direccion", "03-solicitudes", "/solicitudes"],
  ["direccion", "04-solicitud-detalle", "{/solicitudes|/solicitudes/}"],
  ["direccion", "05-viajes", "/viajes"],
  ["direccion", "06-aprobaciones", "/aprobaciones"],
  ["direccion", "07-flota", "/flota"],
  ["compras", "08-compras", "/compras"],
  ["compras", "09-compras-detalle", "{/compras?p=todos|/compras/}"],
  ["daniela", "10-inicio-obra", "/inicio"],
  ["daniela", "11-pedir", "/pedir"],
  ["daniela", "12-mis-pedidos", "/mis-pedidos"],
  ["claudio", "13-hoy-chofer", "/hoy"],
  ["claudio", "14-viaje-chofer", "{/hoy?vista=proximos|/viaje/}"],
  ["deposito", "15-deposito", "/herramientas"],
];

async function entrar(nav: Browser, quien: string, ancho: number) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: ancho < 1024 ? 844 : 900 }, serviceWorkers: "block", isMobile: ancho < 1024, hasTouch: ancho < 1024 });
  await ctx.addInitScript(() => sessionStorage.setItem("signa:splash-visto", "1"));
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`);
  await p.fill("#email", `${quien}@signa.demo`);
  await p.fill("#password", "signa2026");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  return p;
}

async function resolver(p: Page, ruta: string) {
  const m = ruta.match(/^\{(.+)\|(.+)\}$/);
  if (!m) return ruta;
  await p.goto(`${BASE}${m[1]}`);
  await p.waitForLoadState("load", { timeout: 10_000 }).catch(() => {}); await p.waitForTimeout(600); // networkidle no llega nunca: el stream de tiempo real queda abierto
  const href = await p.evaluate((pre) => [...document.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "").find((h) => h.startsWith(pre) && h.length > pre.length + 8) ?? null, m[2]);
  return href?.split("?")[0] ?? null;
}

async function main() {
  const dir = `tmp/capturas/${ETIQUETA}`;
  mkdirSync(dir, { recursive: true });
  const nav = await chromium.launch();
  for (const ancho of [390, 1440]) {
    const sesiones = new Map<string, Page>();
    for (const [quien, nombre, r] of PANTALLAS) {
      if (!sesiones.has(quien)) sesiones.set(quien, await entrar(nav, quien, ancho));
      const p = sesiones.get(quien)!;
      const ruta = await resolver(p, r);
      if (!ruta) { console.log(`sin dato: ${nombre}`); continue; }
      await p.goto(`${BASE}${ruta}`);
      await p.waitForLoadState("load", { timeout: 10_000 }).catch(() => {}); await p.waitForTimeout(600); // networkidle no llega nunca: el stream de tiempo real queda abierto
      await p.waitForTimeout(1200);
      await p.screenshot({ path: `${dir}/${ancho}-${nombre}.png`, fullPage: ancho < 1024 });
    }
    for (const p of sesiones.values()) await p.context().close();
  }
  await nav.close();
  console.log(`listo: ${dir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
