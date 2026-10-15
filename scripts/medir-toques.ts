/**
 * CUÁNTOS TOQUES CUESTA CADA TAREA (auditoría de usabilidad, docs/auditoria-ux.md). Para cada rol, sus cinco
 * tareas más frecuentes, en el celular (390 px), desde la pantalla en la que cae al entrar. Cuenta cada toque
 * (botón, enlace, opción de una lista, pestaña); escribir en un campo no cuenta. El último toque es el que
 * confirma ("Pedir", "Aceptar"…): se cuenta pero no sale (las Server Actions se cortan), así la base no cambia.
 * Meta: 3 toques o menos.
 *
 *   npx tsx scripts/medir-toques.ts [http://localhost:3100]   (base de desarrollo con `npx prisma db seed`)
 *
 * Deja tmp/toques.json y una tabla en la consola.
 */
import { chromium, type Browser, type Locator, type Page } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const BASE = process.argv[2] ?? "http://localhost:3100";
const META = 3;

/** Un paso: un toque (rol + nombre accesible, o un selector) o escribir (no cuenta). */
type Paso =
  | { toque: string; rol?: "button" | "link" | "radio" | "tab" | "option" | "checkbox" | "combobox"; dentro?: string; barra?: boolean; n?: number }
  | { css: string; n?: number; nombre?: string }
  | { escribir: string; en: string }
  | { elegir: string; opcion: RegExp }
  | { esperar: string };
type Tarea = { nombre: string; pasos: Paso[]; nota?: string };

const T = (toque: string, rol?: Extract<Paso, { toque: string }>["rol"], extra: Partial<Extract<Paso, { toque: string }>> = {}): Paso => ({ toque, rol, ...extra });

const TAREAS: Record<string, { usuario: string; tareas: Tarea[] }> = {
  DIRECCION: {
    usuario: "direccion",
    tareas: [
      { nombre: "Autorizar una orden de compra", pasos: [T("Aprobaciones", "link"), T("Aprobar", "button")] },
      { nombre: "Autorizar un pago", pasos: [T("Aprobaciones", "link"), T("Pagos", "link"), T("Autorizar pago", "button")] },
      { nombre: "Ver dónde está cada camión", pasos: [T("Más"), T("Mapa", "link")] },
      { nombre: "Ver en qué quedó un pedido de material", pasos: [T("Pedidos", "link"), { css: "main a[href*='/compras/oc/']:not([href^='/compras/oc/nueva'])", nombre: "fila" }] },
      { nombre: "Ver los costos del mes por obra", pasos: [T("Más"), T("Costos", "link")] },
    ],
  },
  RESPONSABLE_OBRA: {
    usuario: "daniela",
    tareas: [
      {
        nombre: "Pedir un viaje (llevar algo de la base a la obra)",
        pasos: [T("Pedir", "link"), T("Llevar algo a la obra"), { escribir: "20 bolsas de cemento", en: "#que" }, T("Pedir el viaje", "button")],
      },
      { nombre: "Pedir materiales a Compras", pasos: [T("Pedir", "link"), T("Pedir materiales")] },
      { nombre: "Ver cómo viene mi viaje", pasos: [T("Mis pedidos", "link"), { css: "main a[href^='/mis-pedidos/']", nombre: "fila" }] },
      { nombre: "Pedir el viaje de un material listo", pasos: [{ css: "main a[href^='/pedir/retiro?']", nombre: "Pedir el viaje (tarjeta verde)" }, T("Pedir el viaje", "button")] },
      { nombre: "Buscar dónde está una herramienta", pasos: [T("Más"), T("Herramientas", "link"), { escribir: "amoladora", en: "input[type=search], input[placeholder*='Buscar']" }] },
    ],
  },
  CHOFER: {
    usuario: "claudio",
    tareas: [
      { nombre: "Aceptar una solicitud", pasos: [T("Solicitudes", "link"), { css: "main a[href^='/solicitudes/']", nombre: "solicitud" }, T("Aceptar", "button")] },
      { nombre: "Iniciar el viaje de hoy", pasos: [T("Iniciar viaje", "button")] },
      { nombre: "Ver los viajes de mañana", pasos: [T("Próximos")] },
      { nombre: "Cargar combustible", pasos: [T("Más"), T("Combustible", "link")] },
      { nombre: "Ver las paradas de un viaje", pasos: [{ css: "main a[href^='/viaje/']", nombre: "viaje" }] },
    ],
  },
  DEPOSITO: {
    usuario: "deposito",
    tareas: [
      { nombre: "Buscar una herramienta", pasos: [{ escribir: "amoladora", en: "input[type=search], input[placeholder*='Buscar']" }] },
      { nombre: "Entregar una herramienta a una obra", pasos: [{ css: "main a[href^='/herramientas/']", nombre: "herramienta" }, T("Entregar", "button")] },
      { nombre: "Registrar una devolución", pasos: [T("Entregas", "link", { barra: true }), T("Volvió", "link"), T("Registrar devolución", "button", { n: 0 })] },
      { nombre: "Cargar un sobrante", pasos: [T("Sobrantes", "link", { barra: true }), T("Agregar")] },
      { nombre: "Ver qué hay en una obra", pasos: [{ elegir: "Ubicación", opcion: /^Obra Darwin/ }] },
    ],
  },
  COMPRAS: {
    usuario: "compras",
    tareas: [
      { nombre: "Tomar un pedido nuevo", pasos: [T("Ver pedidos", "link"), { css: "main a[href*='/compras/oc/']:not([href^='/compras/oc/nueva'])", nombre: "pedido" }] },
      { nombre: "Enviar una orden a autorización", pasos: [T("Pedidos", "link"), { css: "main a[href*='/compras/oc/']:not([href^='/compras/oc/nueva'])", nombre: "pedido" }, T("Enviar a autorización", "button")] },
      { nombre: "Habilitar un retiro", pasos: [T("Listas para retirar", "link"), { css: "main a[href*='/compras/oc/']:not([href^='/compras/oc/nueva'])", nombre: "orden" }, T("Habilitar")] },
      { nombre: "Coordinar un viaje para una arquitecta", pasos: [T("Viajes", "link")] },
      { nombre: "Armar una orden de compra nueva", pasos: [T("Nueva", "link"), T("Armar orden de compra", "button")] },
    ],
  },
  ADMINISTRACION: {
    usuario: "administracion",
    tareas: [
      { nombre: "Cargar la factura de una orden", pasos: [T("Facturación", "link", { barra: true }), { css: "main a[href*='/compras/oc/']:not([href^='/compras/oc/nueva'])", nombre: "orden" }] },
      { nombre: "Ver vencimientos de seguro y VTV", pasos: [T("Flota", "link")] },
      { nombre: "Ver costos por obra", pasos: [T("Costos", "link")] },
      { nombre: "Dar de alta un usuario", pasos: [T("Más"), T("Usuarios", "link"), T("Agregar persona")] },
      { nombre: "Exportar costos para Lebane", pasos: [T("Costos", "link"), T("CSV por obra")] },
    ],
  },
};

type Resultado = { rol: string; tarea: string; toques: number; ok: boolean; donde?: string; recorrido: string[] };

async function entrar(nav: Browser, quien: string) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.addInitScript(() => sessionStorage.setItem("signa:splash-visto", "1"));
  const p = await ctx.newPage();
  p.setDefaultTimeout(15_000);
  await p.goto(`${BASE}/login`, { timeout: 60_000 });
  await p.fill("#email", `${quien}@signa.demo`);
  await p.fill("#password", "signa2026");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  // Nada cambia la base: las Server Actions no salen.
  await p.route("**/*", (r) => (r.request().method() === "POST" && r.request().headers()["next-action"] ? r.abort() : r.continue()));
  return p;
}

async function localizar(p: Page, paso: Paso): Promise<Locator> {
  // Con una hoja abierta (Más, una acción), se toca adentro de la hoja.
  const hoja = p.getByRole("dialog").filter({ visible: true });
  const base = (await hoja.count()) ? hoja.last() : p;
  if ("css" in paso) return base.locator(paso.css).filter({ visible: true }).nth(paso.n ?? 0);
  if ("toque" in paso) {
    // barra: el ítem de la barra inferior (si no, "Hoy" encuentra también la tarjeta "HOY · 9:00").
    const raiz = paso.dentro ? p.getByRole("radiogroup", { name: paso.dentro }) : paso.barra ? p.locator("nav").last() : base;
    // Sin ancla al principio: los contadores van pegados al nombre ("1Aprobaciones"). "Más" exacto ("Ver más" no).
    const escapado = paso.toque.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nombre = paso.toque === "Más" ? /Más$/ : new RegExp(escapado, "i");
    const l = paso.rol ? raiz.getByRole(paso.rol, { name: nombre }) : raiz.getByRole("link", { name: nombre }).or(raiz.getByRole("button", { name: nombre }));
    return l.filter({ visible: true }).nth(paso.n ?? 0);
  }
  throw new Error("paso sin toque");
}

/**
 * Deja la base de desarrollo con algo para hacer en cada tarea (abrir un documento lo toma, ver un viaje lo
 * mueve…): un pedido nuevo para Compras, un material listo para retirar en Darwin, un viaje de Claudio para
 * hoy y un pago esperando al dueño. Solo en la base de desarrollo.
 */
async function preparar() {
  if (!/signa_v2_dev/.test(process.env.DATABASE_URL ?? "")) throw new Error("medir-toques solo corre contra la base de desarrollo");
  const nuevo = await db.ordenCompra.findFirst({ where: { estado: { in: ["ENVIADA_A_COMPRAS", "EN_COMPRAS"] }, numero: null }, orderBy: { creadoEn: "desc" } });
  if (nuevo) await db.ordenCompra.update({ where: { id: nuevo.id }, data: { estado: "ENVIADA_A_COMPRAS" } });
  const listo = await db.materialListo.findFirst({ where: { ordenCompra: { obra: { nombre: { contains: "Darwin" } } } } });
  if (listo) await db.materialListo.update({ where: { id: listo.id }, data: { estado: "LISTO", pedidoViajeId: null } });
  const viaje = await db.viaje.findFirst({ where: { estado: "PROGRAMADO" }, select: { pedidoId: true } });
  if (viaje) { const hoy = new Date(); hoy.setHours(Math.max(hoy.getHours(), 9), 0, 0, 0); await db.pedidoViaje.update({ where: { id: viaje.pedidoId }, data: { paraCuando: hoy } }); }
  const pago = await db.ordenCompra.findFirst({ where: { numero: { not: null }, estado: { in: ["AUTORIZADA", "ENCARGADA", "HABILITADA"] } } });
  // Una herramienta en Darwin para poder devolverla (solo para medir: en la app se mueve con un movimiento).
  if (!(await db.herramienta.count({ where: { obra: { nombre: { contains: "Darwin" } } } }))) {
    const [h, darwin] = await Promise.all([db.herramienta.findFirst({ where: { estado: "DISPONIBLE", tipoControl: "UNITARIA", esMaquina: true } }), db.obra.findFirst({ where: { nombre: { contains: "Darwin" } } })]);
    if (h && darwin) await db.herramienta.update({ where: { id: h.id }, data: { estado: "EN_OBRA", obraId: darwin.id, ubicacionId: null } });
  }
  if (pago) await db.ordenCompra.update({ where: { id: pago.id }, data: { pagoSolicitadoEn: new Date(), ordenPagoAutorizadaEn: null } });
}

async function medir(nav: Browser, rol: string, usuario: string, t: Tarea): Promise<Resultado> {
  await preparar();
  const p = await entrar(nav, usuario);
  const inicio = new URL(p.url()).pathname;
  const recorrido: string[] = [`(entra en ${inicio})`];
  let toques = 0;
  try {
    for (const paso of t.pasos) {
      if ("esperar" in paso) { await p.waitForTimeout(Number(paso.esperar)); continue; }
      if ("elegir" in paso) {
        // Una lista nativa: un toque para abrirla y otro para elegir.
        const sel = p.getByLabel(paso.elegir).filter({ visible: true }).first();
        const valor = await sel.locator("option").evaluateAll((os, re) => (os as HTMLOptionElement[]).find((o) => new RegExp(re, "i").test(o.text))?.value ?? null, paso.opcion.source);
        if (valor == null) throw new Error("sin opción");
        await sel.selectOption(valor);
        toques += 2;
        recorrido.push(`elige ${paso.opcion.source}`);
        await p.waitForTimeout(1200);
        continue;
      }
      if ("escribir" in paso) {
        await p.locator(paso.en).filter({ visible: true }).first().fill(paso.escribir);
        recorrido.push(`escribe "${paso.escribir}"`);
        continue;
      }
      const l = await localizar(p, paso);
      await l.waitFor({ state: "visible" });
      await l.click();
      toques++;
      recorrido.push("css" in paso ? `[${paso.nombre ?? paso.css}]` : paso.toque);
      await p.waitForLoadState("load").catch(() => {});
      await p.waitForTimeout(700);
    }
    return { rol, tarea: t.nombre, toques, ok: true, recorrido };
  } catch {
    const visibles = await p.evaluate(() => [...document.querySelectorAll("main a, main button, nav a, nav button, [role=radio]")].filter((e) => (e as HTMLElement).offsetParent).map((e) => (e.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30)).filter(Boolean).slice(0, 40));
    return { rol, tarea: t.nombre, toques, ok: false, donde: `${new URL(p.url()).pathname} · visibles: ${visibles.join(" | ")}`, recorrido };
  } finally {
    await p.context().close();
  }
}

(async () => {
  const solo = process.env.ROL?.split(",");
  const nav = await chromium.launch();
  const resultados: Resultado[] = [];
  for (const [rol, { usuario, tareas }] of Object.entries(TAREAS)) {
    if (solo && !solo.includes(rol)) continue;
    for (const t of tareas) {
      const r = await medir(nav, rol, usuario, t);
      resultados.push(r);
      console.log(`${r.ok ? (r.toques <= META ? "✓" : "▲") : "✗"} ${rol.padEnd(17)} ${String(r.toques).padStart(2)} toques · ${r.tarea}${r.ok ? "" : `\n    no se pudo: ${r.donde}`}\n    ${r.recorrido.join(" → ")}`);
    }
  }
  await nav.close();
  await db.$disconnect();
  mkdirSync("tmp", { recursive: true });
  writeFileSync("tmp/toques.json", JSON.stringify(resultados, null, 2));
  const pasan = resultados.filter((r) => r.ok && r.toques <= META).length;
  console.log(`\n${pasan} de ${resultados.length} tareas en ${META} toques o menos.`);
})();
