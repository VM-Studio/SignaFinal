/**
 * Capturas de las pantallas principales de cada rol, a 380px (celular) y 1440px (escritorio),
 * para comparar el diseño antes y después de un cambio.
 *
 *   npx tsx scripts/capturas.ts antes                       (contra http://localhost:3100)
 *   npx tsx scripts/capturas.ts despues http://localhost:3100
 *   npx tsx scripts/capturas.ts despues http://localhost:3100 claudio   (solo ese rol)
 *
 * Guarda en tmp/capturas/<etiqueta>/<rol>-<pantalla>-<ancho>.png y avisa si alguna ruta tiene
 * scroll horizontal. Necesita la app corriendo con MODO_DEMO=true (usuarios @signa.demo).
 */
import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";

const etiqueta = process.argv[2] ?? "capturas";
const BASE = process.argv[3] ?? "http://localhost:3100";
const SOLO = process.argv[4];
const CLAVE = "signa2026";
const ANCHOS = [380, 1440];

/** Rutas por rol (docs/roles.md). "{pedido}" etc. se reemplazan por un id real de la pantalla de lista. */
const RUTAS: Record<string, string[]> = {
  direccion: ["/inicio", "/mapa", "/solicitudes", "/solicitudes/{solicitud}", "/viajes", "/aprobaciones", "/compras", "/flota", "/flota/{vehiculo}", "/costos", "/actividad", "/alertas", "/usuarios", "/obras", "/proveedores", "/mapa/historial", "/configuracion/rastreo", "/avisos", "/cuenta"],
  daniela: ["/inicio", "/pedir", "/pedir-materiales", "/mis-pedidos", "/mis-pedidos?tab=materiales", "/mis-pedidos/{mipedido}", "/viajes-en-curso", "/obras", "/herramientas"],
  claudio: ["/inicio", "/hoy", "/solicitudes", "/viaje/{viaje}", "/combustible"],
  compras: ["/inicio", "/compras", "/compras/{material}", "/habilitados", "/proveedores"],
  deposito: ["/inicio", "/herramientas", "/herramientas/{herramienta}", "/entregas"],
  administracion: ["/inicio", "/flota", "/costos", "/flota/agenda"],
};

/** De dónde sacar un id real para las rutas de detalle: la primera fila que enlaza ahí. */
const DETALLE: Record<string, { lista: string; prefijo: string }> = {
  solicitud: { lista: "/solicitudes", prefijo: "/solicitudes/" },
  vehiculo: { lista: "/flota", prefijo: "/flota/" },
  mipedido: { lista: "/mis-pedidos?p=aceptados", prefijo: "/mis-pedidos/" },
  viaje: { lista: "/hoy", prefijo: "/viaje/" },
  material: { lista: "/compras?p=listos", prefijo: "/compras/" },
  herramienta: { lista: "/herramientas", prefijo: "/herramientas/" },
};

async function entrar(p: Page, quien: string) {
  await p.goto(`${BASE}/login`);
  await p.fill("#email", `${quien}@signa.demo`);
  await p.fill("#password", CLAVE);
  await p.click('button[type="submit"]');
  await p.waitForURL("**/inicio", { timeout: 20_000 });
}

async function resolver(p: Page, ruta: string) {
  const m = ruta.match(/\{(\w+)\}/);
  if (!m) return ruta;
  const d = DETALLE[m[1]];
  await p.goto(`${BASE}${d.lista}`);
  await p.waitForTimeout(800);
  const href = await p.evaluate((pre) => [...document.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "").find((h) => h.startsWith(pre) && h.length > pre.length + 12 && !h.includes("?")) ?? null, d.prefijo);
  return href;
}

async function main() {
  const dir = `tmp/capturas/${etiqueta}`;
  mkdirSync(dir, { recursive: true });
  const navegador = await chromium.launch({ headless: true });
  const problemas: string[] = [];
  let total = 0;
  for (const [quien, rutas] of Object.entries(RUTAS).filter(([q]) => !SOLO || q === SOLO)) {
    for (const ancho of ANCHOS) {
      const ctx = await navegador.newContext({ viewport: { width: ancho, height: ancho < 1024 ? 860 : 900 }, serviceWorkers: "block" });
      await ctx.addInitScript(() => sessionStorage.setItem("signa:splash-visto", "1"));
      const p = await ctx.newPage();
      await entrar(p, quien);
      for (const r of rutas) {
        const ruta = await resolver(p, r);
        if (!ruta) {
          problemas.push(`${quien} ${r}: no encontré un id para el detalle`);
          continue;
        }
        await p.goto(`${BASE}${ruta}`);
        await p.waitForLoadState("networkidle").catch(() => {});
        await p.waitForTimeout(1200);
        const nombre = r.replace(/^\//, "").replace(/[/?=&{}]+/g, "-").replace(/-+$/, "") || "raiz";
        await p.screenshot({ path: `${dir}/${quien}-${nombre}-${ancho}.png`, fullPage: true });
        total++;
        if (await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) problemas.push(`${quien} ${ruta} a ${ancho}px: scroll horizontal`);
      }
      await ctx.close();
    }
  }
  await navegador.close();
  console.log(`${total} capturas en ${dir}`);
  console.log(problemas.length ? `Problemas:\n- ${problemas.join("\n- ")}` : "Sin scroll horizontal en ninguna.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
