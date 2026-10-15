/**
 * RECORRIDO DEL DOCUMENTO DE COMPRA, con varias sesiones abiertas a la vez (como varios navegadores):
 *  1. Daniela arma una OC (borrador) y escribe el detalle; Alejandra la tiene abierta y ve aparecer el texto.
 *  2. Daniela la envía a Compras; Alejandra completa Proveedor Final (Daniela lo ve en gris) e Importe y la envía
 *     a autorización. El dueño la aprueba. Alejandra marca encargada y habilita.
 *  3. Daniela recibe "Listo para retirar" (tarjeta verde en Mis pedidos) y pide el viaje desde el botón.
 *  4. Camila (Administración) completa la facturación, adjunta la factura y pide la autorización del pago; el dueño
 *     la autoriza. El PDF sale con dos páginas (la plantilla y la factura).
 *  5. Lolo, desde el celular, arma un PE con solo el detalle y lo envía: a Alejandra le llega como "Solo indicaciones".
 * Capturas en tmp/capturas/recorrido-documento/. Necesita la app con MODO_DEMO=true y los datos de prueba.
 *
 *   npx tsx scripts/recorrido-documento.ts [http://localhost:3100]
 */
import { chromium, type Browser, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const BASE = process.argv[2] ?? "http://localhost:3100";
const DIR = "tmp/capturas/recorrido-documento";
mkdirSync(DIR, { recursive: true });
let paso = 0;
const foto = async (p: Page, nombre: string, completa = true) => p.screenshot({ path: `${DIR}/${String(++paso).padStart(2, "0")}-${nombre}.png`, fullPage: completa });
const ok = (cond: unknown, msj: string) => {
  if (!cond) throw new Error(`FALLÓ: ${msj}`);
  console.log(`✓ ${msj}`);
};

async function entrar(nav: Browser, quien: string, celular = false) {
  const ctx = await nav.newContext({ viewport: celular ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: celular, hasTouch: celular, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(() => sessionStorage.setItem("signa:splash-visto", "1"));
  const p = await ctx.newPage();
  p.setDefaultTimeout(30_000);
  p.on("pageerror", (e) => console.log(`  [error en la página de ${quien}]`, e.message));
  await p.goto(`${BASE}/login`);
  await p.fill("#email", `${quien}@signa.demo`);
  await p.fill("#password", "signa2026");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  await p.waitForTimeout(2500);
  return p;
}
const celda = (p: Page, c: string) => p.locator(`.hoja [data-celda="${c}"]`).first();
/** Espera a que termine el guardado por celda (800 ms después de escribir, más la ida al servidor). */
const guardado = async (p: Page) => {
  await p.waitForTimeout(1200);
  await p.waitForFunction(() => !document.body.innerText.includes("Guardando…"), null, { timeout: 15_000 });
};
const elegir = async (p: Page, c: string, texto: string | RegExp) => {
  await celda(p, c).locator("button").first().click();
  await p.getByRole("button", { name: texto }).first().click();
};

(async () => {
  const nav = await chromium.launch();
  const daniela = await entrar(nav, "daniela");
  const alejandra = await entrar(nav, "compras");
  const dueno = await entrar(nav, "direccion");
  const camila = await entrar(nav, "administracion");

  // ── 1. Daniela arma la OC y escribe; Alejandra la ve aparecer ──
  await daniela.goto(`${BASE}/pedir`);
  await daniela.getByRole("button", { name: "Armar orden de compra" }).click();
  await daniela.waitForURL(/\/compras\/oc\/[^/?]+/);
  const url = daniela.url().split("?")[0];
  const id = url.split("/").pop()!;
  await daniela.waitForTimeout(1500);
  await elegir(daniela, "obra", /Obra Darwin/);
  await guardado(daniela);
  await alejandra.goto(url);
  await alejandra.waitForTimeout(2000);
  await celda(daniela, "detalleDelPedido").locator("textarea").fill("40 - bolsas de cemento Loma Negra\n20 - barras de hierro del 8");
  await guardado(daniela);
  await celda(daniela, "proveedorSugerido").locator("input").fill("Corralón San Martín");
  await guardado(daniela);
  await foto(daniela, "daniela-arma-la-oc");
  await alejandra.waitForFunction(() => document.querySelector('.hoja [data-celda="detalleDelPedido"]')?.textContent?.includes("Loma Negra"), null, { timeout: 20_000 });
  ok(true, "Alejandra, con la OC abierta, ve aparecer lo que escribe Daniela (tiempo real)");
  await foto(alejandra, "alejandra-ve-el-texto", false);

  await daniela.getByRole("button", { name: "Enviar a Compras" }).first().click();
  await daniela.getByText("Enviada a Compras").first().waitFor();
  ok(true, "Daniela la envía a Compras");

  // ── 2. Alejandra: con OC cargada, completa y envía a autorización ──
  await alejandra.goto(`${BASE}/compras?carga=oc`);
  await alejandra.waitForTimeout(1500);
  ok(await alejandra.getByText("Loma Negra").count(), "En la bandeja de Compras aparece como \"Con OC cargada\"");
  await foto(alejandra, "bandeja-con-oc-cargada", false);
  await alejandra.goto(`${url}?desde=pedidos`);
  await alejandra.waitForTimeout(1500);
  ok(await alejandra.getByText("En Compras").first().count(), "Al abrirla, pasa a En Compras");
  await daniela.goto(url);
  await daniela.waitForTimeout(1500);
  await elegir(alejandra, "proveedorFinal", /Corralón San Martín/);
  const sucursal = alejandra.getByRole("button", { name: /Villa Crespo|Casa central/ }).first();
  if (await sucursal.count()) await sucursal.click();
  await guardado(alejandra);
  await celda(alejandra, "importe").locator('input[aria-label="Importe"]').fill("556.600,00");
  await guardado(alejandra);
  await daniela.waitForFunction(() => document.querySelector('.hoja [data-celda="proveedorFinal"]')?.textContent?.includes("Corralón"), null, { timeout: 20_000 });
  ok(await daniela.locator('.hoja [data-celda="proveedorFinal"][data-bloqueada]').count(), "Daniela ve el Proveedor Final que puso Alejandra, en gris (no lo puede tocar)");
  await foto(daniela, "daniela-ve-proveedor-en-gris", false);
  ok(!(await daniela.getByRole("button", { name: "Enviar a autorización" }).count()), "La arquitecta nunca ve \"Enviar a autorización\"");
  await alejandra.getByRole("button", { name: "Enviar a autorización" }).first().click();
  await alejandra.getByText(/Enviada a autorización/).first().waitFor();
  await alejandra.waitForTimeout(1500);
  const numero = (await alejandra.locator("[data-numero]").first().textContent())?.trim();
  ok(/^OC-\d+/.test(numero ?? ""), `Recibe el número al enviarla a autorización (${numero})`);
  await foto(alejandra, "enviada-a-autorizacion");

  // El dueño aprueba
  await dueno.goto(`${BASE}/aprobaciones`);
  await dueno.waitForTimeout(2000);
  await foto(dueno, "aprobaciones", false);
  const tarjeta = dueno.locator("li", { hasText: numero! }).first();
  await tarjeta.getByRole("button", { name: "Aprobar" }).click();
  await dueno.getByText(/autorizada/).first().waitFor();
  ok(true, "El dueño la aprueba desde Aprobaciones");

  // Alejandra: encargada y habilitada
  await alejandra.goto(url);
  await alejandra.waitForTimeout(1500);
  await alejandra.getByRole("button", { name: /Marcar como encargada/ }).click();
  await alejandra.getByText("Marcada como encargada.").waitFor();
  await alejandra.waitForTimeout(1200);
  await foto(alejandra, "barra-encargada", false);
  await alejandra.getByRole("button", { name: /Habilitar para retirar/ }).click();
  await alejandra.getByRole("dialog").getByRole("radio", { name: /Hasta 1 tn/ }).click();
  await alejandra.getByRole("dialog").getByRole("button", { name: /^Habilitar$/ }).click();
  await alejandra.getByText(/Habilitado/).first().waitFor();
  await alejandra.waitForTimeout(1500);
  ok(await alejandra.getByText(/LISTO PARA RETIRAR en/).count(), "Habilitada: la barra se pone verde con dónde y cuándo se retira");
  await foto(alejandra, "barra-verde-habilitada", false);

  // ── 3. Daniela: listo para retirar y pide el viaje ──
  await daniela.goto(`${BASE}/mis-pedidos?tab=materiales`);
  await daniela.waitForTimeout(1500);
  ok(await daniela.getByText("Listos para retirar").count(), "En Mis pedidos, \"Listos para retirar\" arriba con la tarjeta verde");
  await foto(daniela, "mis-pedidos-listos", false);
  await daniela.locator("li", { hasText: "Loma Negra" }).getByRole("link", { name: "Pedir el viaje" }).first().click();
  await daniela.waitForURL(/\/pedir\/retiro/);
  await daniela.waitForTimeout(1500);
  await foto(daniela, "pedir-el-viaje");
  // La tarjeta verde abre el último paso con el material marcado y "mañana a la mañana": un toque.
  await daniela.getByRole("button", { name: /Pedir (el|los)/ }).click();
  await daniela.waitForURL((u) => !u.pathname.startsWith("/pedir/retiro"), { timeout: 15000 });
  ok((await db.materialListo.count({ where: { ordenCompraId: id!, pedidoViajeId: { not: null } } })) > 0, "Daniela pide el viaje con ese material ya marcado (2 toques)");

  // ── 4. Camila: facturación, factura y pago ──
  await camila.goto(`${BASE}/compras/facturacion`);
  await camila.waitForTimeout(1500);
  await foto(camila, "facturacion", false);
  await camila.goto(url);
  await camila.waitForTimeout(1500);
  await elegir(camila, "empresaParaFacturar", /SIGNA/i);
  await guardado(camila);
  await celda(camila, "facturaN").locator("input").fill("A-0003-00012345");
  await guardado(camila);
  await celda(camila, "facturaImporte").locator("input").fill("556.600,00");
  await guardado(camila);
  await elegir(camila, "condicionDePago", /Saldo a 30 días/);
  await guardado(camila);
  await elegir(camila, "facturaFormaDePago", /Transferencia/);
  await guardado(camila);
  const factura = await PDFDocument.create();
  factura.addPage([595, 842]).drawText("FACTURA A 0003-00012345 · Corralón San Martín · $ 556.600,00", { x: 60, y: 760, size: 12 });
  writeFileSync(`${DIR}/factura-prueba.pdf`, await factura.save());
  await celda(camila, "facturaAdjunto").locator('input[type="file"]').setInputFiles(`${DIR}/factura-prueba.pdf`);
  await guardado(camila);
  await camila.getByRole("button", { name: "Pedir autorización" }).click();
  await camila.getByText(/Pedido al dueño/).first().waitFor();
  ok(true, "Camila completa la sección 3, adjunta la factura y pide la autorización del pago");
  await camila.waitForTimeout(1200);
  await foto(camila, "camila-facturacion");

  await dueno.goto(`${BASE}/aprobaciones?p=pagos`);
  await dueno.waitForTimeout(1500);
  await foto(dueno, "aprobaciones-pagos", false);
  await dueno.locator("li", { hasText: numero! }).getByRole("button", { name: "Autorizar pago" }).click();
  await dueno.getByText(/Pago autorizado/).first().waitFor();
  ok(true, "El dueño autoriza el pago");

  const r = await camila.context().request.get(`${BASE}/api/oc/${id}/pdf`);
  const pdf = await r.body();
  writeFileSync(`${DIR}/orden-${numero}.pdf`, pdf);
  const paginas = (await PDFDocument.load(pdf)).getPageCount();
  ok(paginas === 2, `El PDF sale con dos páginas: la plantilla y la factura (motor: ${r.headers()["x-pdf-motor"]})`);

  // ── 5. Lolo, desde el celular, un PE con solo el detalle ──
  const lolo = await entrar(nav, "lolo", true);
  await lolo.goto(`${BASE}/pedir`);
  await lolo.waitForTimeout(1500);
  await lolo.getByRole("button", { name: "Armar pedido especial" }).click();
  await lolo.waitForURL(/\/compras\/oc\//);
  await lolo.waitForTimeout(1500);
  await elegir(lolo, "obra", /Obra Chubut/);
  await guardado(lolo);
  await celda(lolo, "detalleDelPedido").locator("textarea").fill("Puerta placa 80 cm con marco, para el baño del PB");
  await guardado(lolo);
  await foto(lolo, "lolo-pe-celular");
  await lolo.getByRole("button", { name: "Enviar a Compras" }).first().click();
  await lolo.getByText("Enviada a Compras").first().waitFor();
  await alejandra.goto(`${BASE}/compras?carga=indicaciones`);
  await alejandra.waitForTimeout(1500);
  ok(await alejandra.getByText("Puerta placa").count(), "A Alejandra le llega el PE de Lolo como \"Solo indicaciones\"");
  await foto(alejandra, "bandeja-solo-indicaciones", false);

  await nav.close();
  await db.$disconnect();
  console.log(`\nRecorrido completo. Capturas en ${DIR}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
