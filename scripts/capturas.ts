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
 *
 *   npx tsx scripts/capturas.ts nuevas                      (las pantallas nuevas del 10/10, con los datos de prueba
 *                                                            recién cargados: npx prisma db seed)
 * Recorre los flujos (adjunto, OC, PDF, aprobación, sucursales, fechas del chofer, "Aprovechá el viaje",
 * viaje con paradas) y guarda cada pantalla a 380 y 1440 en tmp/capturas/nuevas/.
 */
import { chromium, type Browser, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ExcelJS from "exceljs";

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
  deposito: ["/inicio", "/herramientas", "/herramientas?tab=herramientas", "/herramientas/{herramienta}", "/sobrantes", "/entregas"],
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

// ─────────────────────────────── Pantallas nuevas ───────────────────────────────

async function sesion(nav: Browser, quien: string, ancho: number) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: ancho < 1024 ? 860 : 900 }, serviceWorkers: "block" });
  await ctx.addInitScript(() => sessionStorage.setItem("signa:splash-visto", "1"));
  const p = await ctx.newPage();
  await entrar(p, quien);
  return p;
}
const quieto = async (p: Page) => {
  await p.waitForLoadState("networkidle").catch(() => {});
  await p.waitForTimeout(700);
};

/** Captura la pantalla actual a 380 y a 1440 (sin recargar si no hace falta). */
async function ambas(p: Page, dir: string, nombre: string, o: { completa?: boolean; recargar?: boolean } = {}) {
  for (const ancho of ANCHOS) {
    await p.setViewportSize({ width: ancho, height: ancho < 1024 ? 860 : 900 });
    if (o.recargar) await p.reload();
    await quieto(p);
    await p.screenshot({ path: `${dir}/${nombre}-${ancho}.png`, fullPage: o.completa ?? true });
  }
}

async function nuevas() {
  const dir = "tmp/capturas/nuevas";
  mkdirSync(dir, { recursive: true });
  // La planilla que adjunta el responsable (igual a las que mandan por WhatsApp).
  const wb = new ExcelJS.Workbook();
  const hoja = wb.addWorksheet("Pedido");
  hoja.addRows([["Material", "Cantidad", "Unidad"], ["Cemento Portland x 50 kg", 40, "bolsas"], ["Hierro del 8", 20, "barras"], ["Cal hidratada x 25 kg", 15, "bolsas"], ["Arena fina", 6, "m3"]]);
  writeFileSync(`${dir}/planilla-darwin.xlsx`, Buffer.from(await wb.xlsx.writeBuffer()));
  const nav = await chromium.launch({ headless: true });

  // 1) Daniela pide materiales con la planilla adjunta.
  const dani = await sesion(nav, "daniela", 380);
  await dani.goto(`${BASE}/pedir-materiales`);
  await dani.getByLabel("Obra").fill("darwin");
  await dani.getByRole("option", { name: /Darwin/ }).click();
  await dani.locator('input[type="file"][multiple]').setInputFiles([`${dir}/planilla-darwin.xlsx`]);
  await dani.getByText("subido").first().waitFor({ timeout: 20_000 });
  await ambas(dani, dir, "1-pedir-materiales-adjunto");
  await dani.setViewportSize({ width: 380, height: 860 });
  await dani.getByRole("button", { name: "Siguiente" }).click();
  await dani.getByLabel("Observaciones (opcional)").fill("El cemento que sea Loma Negra. Entrar por Darwin.");
  await dani.getByRole("button", { name: "Pedir a Compras" }).click();
  await dani.waitForURL("**/mis-pedidos?tab=materiales", { timeout: 20_000 });

  // 2) Compras: detalle con el adjunto y las observaciones arriba; lo toma y arma la OC.
  const comp = await sesion(nav, "compras", 1440);
  await comp.goto(`${BASE}/compras`);
  await quieto(comp);
  await comp.getByRole("link", { name: /planilla-darwin\.xlsx/ }).first().click();
  await comp.waitForURL(/\/compras\/[^/]+$/);
  await ambas(comp, dir, "2-compras-detalle");
  await comp.setViewportSize({ width: 1440, height: 900 });
  await comp.getByRole("button", { name: "Tomar" }).click();
  await comp.getByRole("link", { name: "Armar orden de compra" }).click();
  await comp.waitForURL("**/oc");
  await quieto(comp);
  await comp.getByRole("button", { name: /Importar desde/ }).click();
  await comp.getByRole("button", { name: "Agregar a la orden" }).click();
  await comp.getByLabel("Precio 1").fill("11500");
  await comp.getByLabel("Precio 2").fill("9800");
  // Selector de proveedor con sus sucursales.
  await comp.getByLabel("Proveedor").fill("san martin");
  await comp.getByRole("option", { name: /Corralón San Martín/ }).click();
  await quieto(comp);
  await ambas(comp, dir, "5-selector-proveedor-sucursales", { completa: false });
  await comp.setViewportSize({ width: 1440, height: 900 });
  await comp.getByRole("radio", { name: /Sucursal Pilar/ }).click();
  await comp.getByRole("radio", { name: "Acopio" }).click();
  await comp.getByLabel("Condiciones").fill("50% anticipo, saldo contra entrega");
  await ambas(comp, dir, "3-formulario-oc");
  await comp.setViewportSize({ width: 1440, height: 900 });
  await comp.getByRole("button", { name: "Enviar a aprobación" }).click();
  await comp.waitForURL(/\/compras\/[^/]+$/, { timeout: 30_000 });
  await quieto(comp);

  // 3) El PDF de la OC (primera página a PNG con sips).
  const ocId = await comp.evaluate(() => [...document.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "").find((h) => /^\/api\/oc\/[^/]+\/pdf/.test(h)) ?? null);
  if (ocId) {
    const r = await comp.request.get(`${BASE}${ocId.split("?")[0]}`);
    writeFileSync(`${dir}/4-pdf-oc.pdf`, await r.body());
    try {
      execFileSync("sips", ["-s", "format", "png", "-Z", "1440", `${dir}/4-pdf-oc.pdf`, "--out", `${dir}/4-pdf-oc-1440.png`], { stdio: "ignore" });
      execFileSync("sips", ["-s", "format", "png", "-Z", "760", `${dir}/4-pdf-oc.pdf`, "--out", `${dir}/4-pdf-oc-380.png`], { stdio: "ignore" });
    } catch {
      console.log("No pude convertir el PDF a imagen (sips); queda el PDF.");
    }
  }

  // 4) Aprobaciones con todos los datos escritos.
  const dueno = await sesion(nav, "direccion", 1440);
  await dueno.goto(`${BASE}/aprobaciones`);
  await ambas(dueno, dir, "6-aprobaciones");

  // 5) Chofer: Hoy y Próximos con la fecha en palabras.
  const cl = await sesion(nav, "claudio", 380);
  await cl.goto(`${BASE}/hoy?vista=proximos`);
  await ambas(cl, dir, "7-hoy-proximos-fechas");
  // "Aprovechá el viaje" al aceptar el cemento para Darwin.
  await cl.setViewportSize({ width: 380, height: 860 });
  await cl.goto(`${BASE}/solicitudes`);
  await quieto(cl);
  const cemento = cl.locator("li").filter({ hasText: "Obra Darwin" }).filter({ hasText: "Cemento Portland" }).first();
  for (const ancho of ANCHOS) {
    await cl.setViewportSize({ width: ancho, height: ancho < 1024 ? 860 : 900 });
    await cemento.getByRole("button", { name: "Aceptar" }).click();
    await cl.getByText("Aprovechá el viaje").waitFor({ timeout: 20_000 });
    await cl.waitForTimeout(600);
    await cl.screenshot({ path: `${dir}/8-aprovecha-el-viaje-${ancho}.png` });
    if (ancho !== ANCHOS[ANCHOS.length - 1]) {
      await cl.keyboard.press("Escape");
      await cl.waitForTimeout(400);
    }
  }
  await cl.getByRole("checkbox", { name: /Chubut/ }).click();
  await cl.getByRole("checkbox", { name: /hormigonera/i }).click();
  await cl.getByRole("button", { name: /^Sumar 2/ }).click();
  await cl.getByRole("radio", { name: /Mercedes/ }).click();
  await cl.getByRole("button", { name: "Confirmar" }).click();
  await cl.getByText(/Aceptaste 3 pedidos/).waitFor({ timeout: 20_000 });
  await cl.goto(`${BASE}/hoy`);
  await ambas(cl, dir, "9-hoy-viaje-combinado");
  await cl.setViewportSize({ width: 380, height: 860 });
  await cl.locator("li").filter({ hasText: "pedidos ·" }).first().getByRole("link").first().click();
  await cl.waitForURL("**/viaje/**");
  await ambas(cl, dir, "10-viaje-con-paradas");
  // Salir y llegar al corralón: la lista de verificación por obra.
  await cl.setViewportSize({ width: 380, height: 860 });
  await cl.getByRole("button", { name: "Iniciar viaje" }).click();
  await cl.getByRole("button", { name: "Salir ahora" }).click();
  await cl.getByRole("button", { name: /^Llegué / }).click();
  await cl.getByRole("button", { name: "Cargué todo, salgo" }).waitFor({ timeout: 20_000 });
  await cl.getByRole("checkbox").first().click();
  await ambas(cl, dir, "11-lista-de-verificacion");
  await nav.close();
  console.log(`Capturas de las pantallas nuevas en ${dir}`);
}

(etiqueta === "nuevas" ? nuevas() : main()).catch((e) => {
  console.error(e);
  process.exit(1);
});
