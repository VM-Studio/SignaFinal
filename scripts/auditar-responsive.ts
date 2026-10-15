/**
 * AUDITORÍA DE RESPONSIVE (Playwright). Recorre TODAS las rutas de todos los roles:
 *  - Celular a 360, 390 y 430 px: scroll horizontal de la página y cualquier elemento que se salga
 *    (getBoundingClientRect().right > innerWidth o left < 0), también con cada hoja inferior abierta.
 *  - Escritorio a 1440 y 1920 px: ancho del contenido real (el elemento más ancho del main) sobre el
 *    ancho disponible; las rutas por debajo del 90 %.
 * Para abrir las hojas toca los botones de la pantalla con las Server Actions BLOQUEADAS (ningún toque
 * cambia datos). Guarda tmp/responsive.md (y tmp/responsive-<etiqueta>.md) y una captura de cada caso
 * en tmp/capturas/responsive/<etiqueta>/.
 *
 *   npx tsx scripts/auditar-responsive.ts antes            (contra http://localhost:3100, MODO_DEMO=true)
 *   npx tsx scripts/auditar-responsive.ts despues http://localhost:3100 [rol]
 */
import { chromium, type Browser, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const ETIQUETA = process.argv[2] ?? "auditoria";
const BASE = process.argv[3] ?? "http://localhost:3100";
const SOLO = process.argv[4];
const SOLO_ANCHOS = process.env.ANCHOS?.split(",").map(Number);
const CELULAR = [360, 390, 430, 768].filter((a) => !SOLO_ANCHOS || SOLO_ANCHOS.includes(a));
const ESCRITORIO = [1440, 1920].filter((a) => !SOLO_ANCHOS || SOLO_ANCHOS.includes(a));
const MAX_BOTONES = 14;
const VERBOSO = process.env.VERBOSO === "1";

const RUTAS: Record<string, string[]> = {
  direccion: [
    "/inicio", "/mapa", "/mapa/historial", "/solicitudes", "/solicitudes/{solicitud}", "/viajes", "/viajes-en-curso", "/aprobaciones", "/compras", "/compras/oc/{material}",
    "/compras/oc/nueva", "/compras/nuevo", "/habilitados", "/flota", "/flota/{vehiculo}", "/flota/agenda", "/flota/mantenimiento", "/costos", "/actividad", "/actividad/{usuario}",
    "/alertas", "/usuarios", "/obras", "/obras/{obra}", "/proveedores", "/proveedores/{proveedor}", "/configuracion/rastreo", "/configuracion/ubicaciones", "/avisos", "/cuenta",
    "/herramientas", "/herramientas/{herramienta}", "/herramientas/importar", "/sobrantes", "/entregas", "/combustible", "/pedir", "/pedir/retiro", "/pedir-materiales", "/mis-pedidos",
    "/compras/tablero", "/compras/facturacion", "/aprobaciones?p=pagos", "/compras/oc/nueva?tipo=PE", "/configuracion/razones-sociales", "/configuracion/compras",
  ],
  daniela: ["/inicio", "/obras", "/obras/{obra}", "/pedir", "/pedir/retiro", "/pedir-materiales", "/mis-pedidos", "/mis-pedidos?tab=materiales", "/mis-pedidos/{mipedido}", "/compras/oc/{mimaterial}", "/compras/oc/nueva?tipo=OC", "/viajes-en-curso", "/herramientas", "/herramientas/{herramienta}", "/avisos", "/cuenta"],
  claudio: ["/inicio", "/hoy", "/hoy?vista=proximos", "/hoy?vista=todos", "/solicitudes", "/solicitudes/{solicitud}", "/viaje/{viaje}", "/combustible", "/avisos", "/cuenta"],
  compras: ["/compras", "/compras/oc/{material}", "/compras/oc/nueva", "/compras/nuevo", "/habilitados", "/proveedores", "/proveedores/{proveedor}", "/pedir-materiales", "/avisos", "/cuenta",
    "/compras/tablero", "/compras/tablero?estado=HABILITADA", "/compras/oc/nueva?tipo=PE", "/compras/importar", "/compras/viajes", "/compras/viajes/solicitudes", "/configuracion/compras"],
  deposito: ["/inicio", "/herramientas", "/herramientas/{herramienta}", "/herramientas/importar", "/sobrantes", "/entregas", "/avisos", "/cuenta"],
  administracion: ["/inicio", "/flota", "/flota/{vehiculo}", "/flota/agenda", "/flota/mantenimiento", "/costos", "/alertas", "/obras", "/usuarios", "/configuracion/ubicaciones", "/avisos", "/cuenta", "/compras/tablero", "/compras/facturacion", "/compras/oc/{facturar}", "/configuracion/razones-sociales"],
};

/** De dónde sacar un id real: la lista y el prefijo del enlace al detalle. */
const DETALLE: Record<string, { lista: string; prefijo: string }> = {
  solicitud: { lista: "/solicitudes", prefijo: "/solicitudes/" },
  material: { lista: "/compras?p=todos", prefijo: "/compras/oc/" },
  facturar: { lista: "/compras/facturacion", prefijo: "/compras/oc/" },
  vehiculo: { lista: "/flota", prefijo: "/flota/" },
  usuario: { lista: "/actividad", prefijo: "/actividad/" },
  obra: { lista: "/obras", prefijo: "/obras/" },
  proveedor: { lista: "/proveedores", prefijo: "/proveedores/" },
  herramienta: { lista: "/herramientas?tab=herramientas", prefijo: "/herramientas/" },
  mipedido: { lista: "/mis-pedidos?p=aceptados", prefijo: "/mis-pedidos/" },
  mimaterial: { lista: "/mis-pedidos?tab=materiales", prefijo: "/compras/oc/" },
  viaje: { lista: "/hoy?vista=proximos", prefijo: "/viaje/" },
};

/** Lo que no es un desborde pero se revisa en el celular: campos chicos, botones bajos, deslizadores cortados, tablas sin columna fija. */
type Detalle = { rol: string; ruta: string; ancho: number; donde: string; tipo: "campo <16px" | "botón <48px" | "deslizador cortado" | "tabla sin columna fija"; selector: string; valor: string };
type Caso = { rol: string; ruta: string; ancho: number; donde: string; selector: string; izquierda: number; derecha: number; ancho_el: number; texto: string };
type Ancho = { rol: string; ruta: string; ancho: number; contenido: number; disponible: number; pct: number; selector: string };

async function entrar(nav: Browser, quien: string, ancho: number) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: ancho < 1024 ? 800 : 900 }, serviceWorkers: "block", isMobile: ancho < 1024, hasTouch: ancho < 1024 });
  await ctx.addInitScript(() => sessionStorage.setItem("signa:splash-visto", "1"));
  // tsx le agrega "__name" a las funciones que se mandan a la página: que exista también ahí.
  await ctx.addInitScript({ content: "window.__name = (f) => f;" });
  const p = await ctx.newPage();
  p.setDefaultTimeout(8_000);
  await p.goto(`${BASE}/login`, { timeout: 60_000 });
  await p.fill("#email", `${quien}@signa.demo`);
  await p.fill("#password", "signa2026");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  // Desde acá, ningún toque cambia datos: las Server Actions no salen.
  await p.route("**/*", (r) => (r.request().method() === "POST" && r.request().headers()["next-action"] ? r.abort() : r.continue()));
  return p;
}

const ids = new Map<string, string | null>();
async function resolver(p: Page, ruta: string) {
  const m = ruta.match(/\{(\w+)\}/);
  if (!m) return ruta;
  if (!ids.has(m[1])) {
    const d = DETALLE[m[1]];
    await p.goto(`${BASE}${d.lista}`, { timeout: 30_000 }).catch(() => {});
    await p.waitForLoadState("load", { timeout: 10_000 }).catch(() => {}); await p.waitForTimeout(600); // networkidle no llega nunca: el stream de tiempo real queda abierto
    const href = await p.evaluate((pre) => [...document.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "").find((h) => h.startsWith(pre) && h.split("?")[0].split("/").length === pre.split("/").length && h.length > pre.length + 8) ?? null, d.prefijo);
    ids.set(m[1], href ? href.split("?")[0].slice(d.prefijo.length) : null);
  }
  const id = ids.get(m[1]);
  return id ? ruta.replace(`{${m[1]}}`, id) : null;
}

/** Elementos que se salen de la pantalla (los más externos; lo que está adentro de un contenedor con scroll o recorte no cuenta). */
export function medirDesbordes() {
  const W = window.innerWidth;
  const selector = (el: Element) => {
    const c = typeof el.className === "string" ? el.className.split(/\s+/).filter(Boolean).slice(0, 4).join(".") : "";
    const extra = el.getAttribute("aria-label") ? `[aria-label="${el.getAttribute("aria-label")!.slice(0, 30)}"]` : el.id ? `#${el.id}` : "";
    return `${el.tagName.toLowerCase()}${extra}${c ? `.${c}` : ""}`;
  };
  const recortado = (el: Element) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) {
        const r = a.getBoundingClientRect();
        if (r.right <= W + 1 && r.left >= -1) return true;
      }
    }
    return false;
  };
  const fuera: Element[] = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.opacity === "0") continue;
    if (r.right > W + 1 || r.left < -1) {
      if (recortado(el)) continue;
      fuera.push(el);
    }
  }
  const externos = fuera.filter((el) => !fuera.some((o) => o !== el && o.contains(el)));
  return {
    scroll: document.documentElement.scrollWidth > W + 1 ? document.documentElement.scrollWidth : 0,
    casos: externos.slice(0, 12).map((el) => {
      const r = el.getBoundingClientRect();
      return { selector: selector(el), izquierda: Math.round(r.left), derecha: Math.round(r.right), ancho_el: Math.round(r.width), texto: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 50) };
    }),
  };
}

/** Celular: campos con letra de menos de 16 px (iPhone hace zoom), botones de menos de 48 px de alto, texto cortado en
 *  los deslizadores y tablas anchas sin la primera columna fija. */
export function medirDetalles() {
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
  };
  const sel = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${el.getAttribute("aria-label") ? `[aria-label="${el.getAttribute("aria-label")!.slice(0, 30)}"]` : ""}`;
  const out: { tipo: string; selector: string; valor: string }[] = [];
  for (const el of document.querySelectorAll("input, select, textarea")) {
    const t = (el as HTMLInputElement).type;
    if (["hidden", "checkbox", "radio", "file", "range"].includes(t) || !visible(el)) continue;
    const f = parseFloat(getComputedStyle(el).fontSize);
    if (f < 16) out.push({ tipo: "campo <16px", selector: sel(el), valor: `${f}px` });
  }
  for (const el of document.querySelectorAll("main button, [role=dialog] button, main a[class*='min-h-12'], main a[class*='rounded-md'][class*='bg-negro']")) {
    if (!visible(el) || el.closest(".planilla, .hoja, nav, header, [role=slider]")) continue;
    const texto = (el.textContent ?? "").trim();
    if (!texto) continue; // íconos solos (cerrar, quitar): van aparte
    const h = el.getBoundingClientRect().height;
    if (h < 47.5) out.push({ tipo: "botón <48px", selector: sel(el), valor: `${Math.round(h)}px · ${texto.slice(0, 30)}` });
  }
  for (const el of document.querySelectorAll("[role=slider] p")) {
    const p = el as HTMLElement;
    if (p.scrollWidth > p.clientWidth + 1 || p.scrollHeight > p.clientHeight + 1) out.push({ tipo: "deslizador cortado", selector: "slider", valor: (p.textContent ?? "").slice(0, 40) });
  }
  for (const t of document.querySelectorAll("table")) {
    if (!visible(t)) continue;
    let caja: Element | null = t.parentElement;
    while (caja && !/(auto|scroll)/.test(getComputedStyle(caja).overflowX)) caja = caja.parentElement;
    if (!caja || t.scrollWidth <= caja.clientWidth + 1) continue;
    const primera = t.querySelector("tbody tr > *");
    if (primera && getComputedStyle(primera).position !== "sticky") out.push({ tipo: "tabla sin columna fija", selector: sel(t), valor: (t.querySelector("th")?.textContent ?? "").slice(0, 30) });
  }
  return out;
}

/** Escritorio: el elemento más ancho del main sobre el ancho disponible. */
function medirAncho() {
  const main = document.querySelector("main");
  if (!main) return null;
  const cs = getComputedStyle(main);
  const mr = main.getBoundingClientRect();
  const disponible = mr.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  let mejor = { w: 0, sel: "" };
  const visitar = (el: Element, prof: number) => {
    if (prof > 4) return;
    for (const h of el.children) {
      const s = getComputedStyle(h);
      if (s.position === "fixed" || s.display === "none") continue;
      const r = h.getBoundingClientRect();
      if (r.height < 8) continue;
      const w = Math.min(r.right, mr.right - parseFloat(cs.paddingRight)) - Math.max(r.left, mr.left + parseFloat(cs.paddingLeft));
      if (w > mejor.w) mejor = { w, sel: `${h.tagName.toLowerCase()}.${typeof h.className === "string" ? h.className.split(/\s+/).slice(0, 3).join(".") : ""}` };
      visitar(h, prof + 1);
    }
  };
  visitar(main, 0);
  return { contenido: Math.round(mejor.w), disponible: Math.round(disponible), selector: mejor.sel };
}

const detalles: Detalle[] = [];

async function auditarCelular(p: Page, rol: string, ruta: string, ancho: number, dir: string, casos: Caso[], soloLaPantalla = false) {
  const registrar = async (donde: string) => {
    for (const x of await p.evaluate(medirDetalles)) detalles.push({ rol, ruta, ancho, donde, ...x, tipo: x.tipo as Detalle["tipo"] });
    const m = await p.evaluate(medirDesbordes);
    const nuevos: Caso[] = m.casos.map((c) => ({ rol, ruta, ancho, donde, ...c }));
    if (m.scroll) nuevos.unshift({ rol, ruta, ancho, donde, selector: "document (scroll horizontal)", izquierda: 0, derecha: m.scroll, ancho_el: m.scroll, texto: "" });
    if (nuevos.length) {
      casos.push(...nuevos);
      const nombre = `${rol}-${ruta.replace(/^\//, "").replace(/[/?=&]+/g, "-") || "raiz"}-${donde === "pantalla" ? "" : `hoja-${casos.length}-`}${ancho}.png`;
      await p.screenshot({ path: `${dir}/${nombre}`, fullPage: donde === "pantalla" }).catch(() => {});
    }
  };
  await registrar("pantalla");
  if (soloLaPantalla) return registrar;
  // Cada hoja inferior: tocar los botones de la pantalla (sin cambiar datos) y medir si se abre una.
  const botones = await p.locator("main button:visible").all();
  let tocados = 0;
  for (const b of botones) {
    if (tocados >= MAX_BOTONES) break;
    const nombre = ((await b.getAttribute("aria-label", { timeout: 1_000 }).catch(() => null)) ?? (await b.innerText({ timeout: 1_000 }).catch(() => ""))).trim().slice(0, 40);
    if (!nombre || /cerrar sesión|salir|eliminar|borrar/i.test(nombre) || (await b.isDisabled({ timeout: 1_000 }).catch(() => true))) continue;
    const url = p.url();
    tocados++;
    await b.click({ timeout: 2_000 }).catch(() => {});
    await p.waitForTimeout(350);
    const hoja = p.locator('[role="dialog"]').last();
    if (await hoja.isVisible().catch(() => false)) {
      await registrar(`hoja "${nombre}"`);
      await p.keyboard.press("Escape");
      await p.waitForTimeout(250);
    }
    if (p.url() !== url) {
      await p.goto(url, { timeout: 30_000 }).catch(() => {});
      await p.waitForLoadState("load", { timeout: 10_000 }).catch(() => {}); await p.waitForTimeout(600); // networkidle no llega nunca: el stream de tiempo real queda abierto
    }
  }
  return registrar;
}

/**
 * Hojas y formularios abiertos a propósito (lo que tocar botones al azar no alcanza): aceptar con el vehículo,
 * los selectores de proveedor y obra de la plantilla de OC y el tablero con scroll interno. La hoja de
 * "Terminar viaje" la mide scripts/recorrido-chofer.ts (necesita un viaje en curso de verdad).
 */
const ESCENARIOS: Record<string, { ruta: string; nombre: string; hacer: (p: Page) => Promise<void> }[]> = {
  claudio: [
    { ruta: "/solicitudes/{solicitud}", nombre: "aceptar con vehículo", hacer: async (p) => {
      await p.getByRole("button", { name: "Aceptar" }).first().click();
      await p.getByRole("dialog").waitFor({ timeout: 8_000 });
      await p.waitForTimeout(1500);
      const solo = p.getByRole("dialog").getByRole("button", { name: /Seguir con este solo|Llevo/ });
      if (await solo.count()) await solo.first().click();
      await p.waitForTimeout(500);
    } },
  ],
  compras: [
    { ruta: "/compras/oc/{material}", nombre: "selector de proveedor", hacer: async (p) => {
      await p.locator('[data-celda="proveedorFinal"]').first().click();
      await p.waitForTimeout(600);
    } },
    { ruta: "/compras/oc/{material}", nombre: "selector de obra", hacer: async (p) => {
      await p.locator('[data-celda="obra"]').first().click();
      await p.waitForTimeout(600);
    } },
    { ruta: "/compras/tablero", nombre: "tablero con scroll interno", hacer: async (p) => {
      await p.evaluate(() => { const t = document.querySelector<HTMLElement>(".planilla"); if (t) t.scrollLeft = 400; window.scrollTo(0, 300); });
      await p.waitForTimeout(400);
    } },
  ],
};

async function main() {
  const dir = `tmp/capturas/responsive/${ETIQUETA}`;
  mkdirSync(dir, { recursive: true });
  const nav = await chromium.launch();
  const casos: Caso[] = [];
  const anchos: Ancho[] = [];
  let paginas = 0;
  for (const [rol, rutas] of Object.entries(RUTAS).filter(([r]) => !SOLO || r === SOLO)) {
    for (const ancho of [...CELULAR, ...ESCRITORIO]) {
      const p = await entrar(nav, rol, ancho);
      for (const r of rutas) {
        const ruta = await resolver(p, r);
        if (!ruta) continue;
        if (VERBOSO) console.log(`${rol} ${ancho} ${ruta}`);
        // Una pantalla que se cuelga no frena la auditoría: a los 90 s se anota y se sigue.
        const ok = await Promise.race([
          (async () => {
            await p.goto(`${BASE}${ruta}`, { timeout: 30_000 }).catch(() => {});
            await p.waitForLoadState("load", { timeout: 10_000 }).catch(() => {}); await p.waitForTimeout(600); // networkidle no llega nunca: el stream de tiempo real queda abierto
            await p.waitForTimeout(500);
            if (ancho < 1024) await auditarCelular(p, rol, ruta, ancho, dir, casos);
            else {
              const a = await p.evaluate(medirAncho);
              if (a) anchos.push({ rol, ruta, ancho, ...a, pct: Math.round((a.contenido / a.disponible) * 100) });
            }
            return true;
          })(),
          new Promise<false>((r) => setTimeout(() => r(false), 90_000)),
        ]);
        paginas++;
        if (!ok) console.log(`  (se colgó: ${rol} ${ancho} ${ruta})`);
      }
      if (ancho < 1024) {
        for (const e of ESCENARIOS[rol] ?? []) {
          const ruta = await resolver(p, e.ruta);
          if (!ruta) continue;
          await p.goto(`${BASE}${ruta}`, { timeout: 30_000 }).catch(() => {});
          await p.waitForLoadState("load", { timeout: 10_000 }).catch(() => {});
          await p.waitForTimeout(1000);
          await e.hacer(p).catch((x) => console.log(`  (escenario ${e.nombre} ${ancho}: ${String(x).slice(0, 80)})`));
          await auditarCelular(p, rol, `${ruta} · ${e.nombre}`, ancho, dir, casos, true);
          await p.screenshot({ path: `${dir}/escenario-${rol}-${e.nombre.replace(/\s+/g, "-")}-${ancho}.png` }).catch(() => {});
        }
      }
      await p.context().close();
    }
    process.stdout.write(`${rol} listo · `);
  }
  await nav.close();

  const angostas = anchos.filter((a) => a.pct < 90);
  const rutasConDesborde = new Set(casos.map((c) => `${c.rol} ${c.ruta}`));
  const md = [
    `# Auditoría responsive · ${ETIQUETA}`,
    "",
    `${paginas} pantallas recorridas (${Object.keys(RUTAS).filter((r) => !SOLO || r === SOLO).join(", ")}).`,
    "",
    `## Celular (360, 390, 430, 768 px): ${casos.length} desbordes en ${rutasConDesborde.size} pantallas`,
    "",
    ...(casos.length ? ["| Rol | Ruta | Ancho | Dónde | Elemento | Izq. | Der. | Ancho | Texto |", "|---|---|---|---|---|---|---|---|---|", ...casos.map((c) => `| ${c.rol} | ${c.ruta} | ${c.ancho} | ${c.donde} | \`${c.selector}\` | ${c.izquierda} | ${c.derecha} | ${c.ancho_el} | ${c.texto.replace(/\|/g, "/")} |`)] : ["Ninguno."]),
    "",
    `## Celular: detalles (${detalles.length})`,
    "",
    ...(["campo <16px", "botón <48px", "deslizador cortado", "tabla sin columna fija"] as const).map((t) => `- ${t}: ${detalles.filter((d) => d.tipo === t).length}`),
    "",
    ...(detalles.length ? ["| Tipo | Rol | Ruta | Ancho | Dónde | Elemento | Valor |", "|---|---|---|---|---|---|---|", ...[...new Map(detalles.map((d) => [`${d.tipo}|${d.rol}|${d.ruta}|${d.selector}|${d.valor}`, d])).values()].filter((d) => d.ancho === 390 || d.ancho === 768).map((d) => `| ${d.tipo} | ${d.rol} | ${d.ruta} | ${d.ancho} | ${d.donde} | \`${d.selector}\` | ${d.valor.replace(/\|/g, "/")} |`)] : []),
    "",
    `## Escritorio (1440, 1920 px): ${angostas.length} pantallas usan menos del 90 % del ancho`,
    "",
    "| Rol | Ruta | Ancho | Contenido | Disponible | % | Elemento más ancho |",
    "|---|---|---|---|---|---|---|",
    ...[...anchos].sort((a, b) => a.pct - b.pct).map((a) => `| ${a.rol} | ${a.ruta} | ${a.ancho} | ${a.contenido} | ${a.disponible} | ${a.pct < 90 ? `**${a.pct}**` : a.pct} | \`${a.selector}\` |`),
  ].join("\n");
  // Para correr en paralelo (por rol y ancho) y unir después con scripts/unir-responsive.ts.
  writeFileSync(`tmp/responsive-${ETIQUETA}.json`, JSON.stringify({ paginas, casos, anchos, detalles }));
  writeFileSync(`tmp/responsive-${ETIQUETA}.md`, md);
  console.log(`\n${paginas} pantallas · celular: ${casos.length} desbordes en ${rutasConDesborde.size} pantallas · detalles: ${detalles.length} · escritorio: ${angostas.length} por debajo del 90 %`);
}

if (process.argv[1]?.includes("auditar-responsive")) main().catch((e) => {
  console.error(e);
  process.exit(1);
});
