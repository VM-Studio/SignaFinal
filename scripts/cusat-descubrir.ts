/**
 * Descubre cómo habla la web de Cusat View (cusatglobal.com) con su servidor, para construir
 * el adaptador src/lib/cusat/cusatView.ts. Cusat no tiene API pública: esto registra lo que
 * hace la web real con un usuario de la cuenta.
 *
 *   npx tsx scripts/cusat-descubrir.ts              (navegador visible, para mirar)
 *   npx tsx scripts/cusat-descubrir.ts --headless   (sin ventana)
 *
 * Lee CUSAT_WEB_USER y CUSAT_WEB_PASS de .env. Nunca los escribe: en la captura, el usuario y
 * la contraseña quedan como "***", y cookies y tokens recortados (alcanza para ver dónde van).
 *
 * Salida:
 *   docs/cusat/captura-<fecha>.json   todas las requests/responses (no se sube a git)
 *   docs/cusat/api-descubierta.md     inventario automático (se completa a mano después)
 *   tmp/cusat/*.png                   capturas de pantalla de cada paso (no se suben a git)
 */
import { chromium, type Page, type Request, type Response } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

try {
  process.loadEnvFile(".env");
} catch {}

const USUARIO = process.env.CUSAT_WEB_USER ?? "";
const CLAVE = process.env.CUSAT_WEB_PASS ?? "";
if (!USUARIO || !CLAVE) {
  console.error("Faltan CUSAT_WEB_USER y CUSAT_WEB_PASS en .env.");
  process.exit(1);
}

const HEADLESS = process.argv.includes("--headless");
const INICIO = "https://cusatglobal.com/";
const SEGUNDOS_DESPUES_DEL_MAPA = 90;
const VEHICULOS = ["MERCEDES 710", "KIA", "ZANELLA", "OROCH", "KANGOO", "KANGOO LL"];
const PATENTES = ["HFD336", "AH282PU", "AG149BJ", "AC689NR", "AF399OO", "AF399OP"];
const MAX_CUERPO = 300_000;

const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
mkdirSync("docs/cusat", { recursive: true });
mkdirSync("tmp/cusat", { recursive: true });

// ───────────────────────── Enmascarar ─────────────────────────

const recortar = (v: string) => (v.length > 10 ? `${v.slice(0, 6)}…(${v.length})` : "***");
const SENSIBLE = /token|session|sesion|sid|jwt|auth|cookie|key|clave|pass|secret/i;

/** Valores exactos del usuario y la contraseña → "***". La contraseña puede ser parte de "cusatglobal": solo se tapa el valor exacto. */
function taparValor(v: unknown): unknown {
  if (typeof v === "string") {
    if (v === CLAVE || v === USUARIO) return "***";
    return v.split(USUARIO).join("***");
  }
  if (Array.isArray(v)) return v.map(taparValor);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, typeof x === "string" && SENSIBLE.test(k) && x !== "***" && x.length > 10 ? recortar(x) : taparValor(x)]),
    );
  }
  return v;
}

function taparTexto(t: string): string {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return t
    .split(USUARIO).join("***")
    // Formularios y JSON: solo donde la contraseña es el valor completo.
    .replace(new RegExp(`(=)${esc(encodeURIComponent(CLAVE))}(?=&|$)`, "g"), "$1***")
    .replace(new RegExp(`(=)${esc(CLAVE)}(?=&|$)`, "g"), "$1***")
    .replace(new RegExp(`(["'])${esc(CLAVE)}\\1`, "g"), "$1***$1");
}

function taparCuerpo(t: string | null): unknown {
  if (t == null) return null;
  try {
    return taparValor(JSON.parse(t));
  } catch {
    return taparTexto(t);
  }
}

function taparUrl(u: string) {
  try {
    const url = new URL(u);
    for (const [k, v] of url.searchParams) {
      if (v === CLAVE || v === USUARIO) url.searchParams.set(k, "***");
      else if (SENSIBLE.test(k) && v.length > 10) url.searchParams.set(k, recortar(v));
    }
    return taparTexto(url.toString());
  } catch {
    return taparTexto(u);
  }
}

const RELEVANTES = /^(content-type|cookie|set-cookie|authorization|x-[\w-]+|referer|origin|accept)$/i;
function taparHeaders(h: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    if (!RELEVANTES.test(k)) continue;
    if (/^authorization$/i.test(k)) {
      const [tipo, valor = ""] = v.split(" ");
      if (/^basic$/i.test(tipo)) out[k] = "Basic ***";
      else out[k] = `${tipo} ${recortar(valor)}`;
    } else if (/cookie/i.test(k)) {
      // Nombre de cada cookie a la vista; el valor recortado.
      out[k] = v.split(/;\s*|\n/).map((c) => {
        const i = c.indexOf("=");
        return i < 0 ? c : `${c.slice(0, i)}=${recortar(c.slice(i + 1))}`;
      }).join("; ");
    } else out[k] = taparTexto(v);
  }
  return out;
}

// ───────────────────────── Registro ─────────────────────────

type Entrada = {
  n: number; t: string; metodo: string; url: string; tipo: string;
  requestHeaders: Record<string, string>; requestBody: unknown;
  status?: number; responseHeaders?: Record<string, string>; contentType?: string; responseBody?: unknown; error?: string;
};
const entradas: Entrada[] = [];
const sockets: { url: string; enviados: unknown[]; recibidos: unknown[] }[] = [];
const porRequest = new Map<Request, Entrada>();
const t0 = Date.now();
const seg = () => ((Date.now() - t0) / 1000).toFixed(1);
let fase = "antes del login";
const fases: { t: string; fase: string }[] = [];
const marcar = (f: string) => {
  fase = f;
  fases.push({ t: seg(), fase: f });
  console.log(`[${seg()} s] ${f}`);
};

const TEXTO = /json|text\/plain|xml|text\/html|javascript\+json|x-www-form-urlencoded/i;

function registrarRequest(r: Request) {
  const e: Entrada = {
    n: entradas.length + 1, t: seg(), metodo: r.method(), url: taparUrl(r.url()), tipo: r.resourceType(),
    requestHeaders: taparHeaders(r.headers()), requestBody: taparCuerpo(r.postData()),
  };
  (e as Entrada & { fase: string }).fase = fase;
  entradas.push(e);
  porRequest.set(r, e);
}

async function registrarResponse(res: Response) {
  const e = porRequest.get(res.request());
  if (!e) return;
  e.status = res.status();
  const h = await res.allHeaders().catch(() => ({}) as Record<string, string>);
  e.responseHeaders = taparHeaders(h);
  e.contentType = h["content-type"] ?? "";
  // Cuerpos solo de lo que trae datos (no imágenes, CSS ni el JS de la web).
  if (["image", "stylesheet", "font", "media"].includes(e.tipo) || (e.tipo === "script" && !/json/i.test(e.contentType))) return;
  if (!TEXTO.test(e.contentType) && e.tipo !== "xhr" && e.tipo !== "fetch") return;
  try {
    const cuerpo = await res.text();
    e.responseBody = taparCuerpo(cuerpo.length > MAX_CUERPO ? `${cuerpo.slice(0, MAX_CUERPO)}…(recortado, ${cuerpo.length} caracteres)` : cuerpo);
  } catch (err) {
    e.error = `No se pudo leer el cuerpo: ${(err as Error).message.slice(0, 120)}`;
  }
}

async function foto(p: Page, nombre: string) {
  await p.screenshot({ path: `tmp/cusat/${nombre}.png`, fullPage: false }).catch(() => {});
}

/** Busca el primer elemento visible de una lista de selectores. */
async function primero(p: Page, selectores: string[]) {
  for (const s of selectores) {
    const l = p.locator(s).filter({ visible: true }).first();
    if (await l.count().catch(() => 0)) return l;
  }
  return null;
}

async function hayCaptcha(p: Page) {
  const frames = p.frames().map((f) => f.url()).join(" ");
  if (/recaptcha|hcaptcha|turnstile|captcha/i.test(frames)) return true;
  return (await p.locator("text=/captcha|no soy un robot/i").count().catch(() => 0)) > 0;
}

async function haySegundoFactor(p: Page) {
  return (await p.locator("text=/c[oó]digo de verificaci[oó]n|segundo factor|two.factor|2FA|ingres[aá] el c[oó]digo/i").count().catch(() => 0)) > 0;
}

// El proyecto compila los scripts como CommonJS: sin await en el nivel superior.
async function main() {
// ───────────────────────── Recorrido ─────────────────────────

const navegador = await chromium.launch({ headless: HEADLESS, slowMo: HEADLESS ? 0 : 150 });
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });
contexto.on("request", registrarRequest);
contexto.on("response", (r) => void registrarResponse(r));
contexto.on("requestfailed", (r) => {
  const e = porRequest.get(r);
  if (e) e.error = r.failure()?.errorText ?? "falló";
});
const pagina = await contexto.newPage();
pagina.on("websocket", (ws) => {
  const s = { url: taparUrl(ws.url()), enviados: [] as unknown[], recibidos: [] as unknown[] };
  sockets.push(s);
  console.log(`[${seg()} s] WebSocket: ${s.url}`);
  ws.on("framesent", (f) => s.enviados.length < 200 && s.enviados.push({ t: seg(), datos: taparCuerpo(typeof f.payload === "string" ? f.payload : `(binario ${f.payload.length} bytes)`) }));
  ws.on("framereceived", (f) => s.recibidos.length < 400 && s.recibidos.push({ t: seg(), datos: taparCuerpo(typeof f.payload === "string" ? f.payload.slice(0, 20_000) : `(binario ${f.payload.length} bytes)`) }));
});

const problemas: string[] = [];
let detenido: string | null = null;

try {
  marcar("abriendo cusatglobal.com");
  await pagina.goto(INICIO, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await pagina.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await foto(pagina, "1-inicio");

  // El formulario puede estar en la portada o detrás de un botón "Ingresar"/"Login".
  let clave = await primero(pagina, ['input[type="password"]']);
  if (!clave) {
    const ir = await primero(pagina, ['a:has-text("Ingresar")', 'button:has-text("Ingresar")', 'a:has-text("Login")', 'a:has-text("Iniciar sesión")', 'a:has-text("Acceso")', 'a:has-text("Cusat View")']);
    if (ir) {
      marcar("abriendo el formulario de ingreso");
      const nueva = contexto.waitForEvent("page", { timeout: 5_000 }).catch(() => null);
      await ir.click();
      const p2 = await nueva;
      if (p2) problemas.push(`El ingreso se abrió en otra pestaña: ${taparUrl(p2.url())}`);
      await pagina.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
      clave = await primero(pagina, ['input[type="password"]']);
    }
  }
  // También puede estar dentro de un iframe.
  let marco: Page | import("playwright").Frame = pagina;
  if (!clave) {
    for (const f of pagina.frames()) {
      const l = f.locator('input[type="password"]').first();
      if (await l.count().catch(() => 0)) {
        marco = f;
        clave = l;
        problemas.push(`El formulario de ingreso está dentro de un iframe: ${taparUrl(f.url())}`);
        break;
      }
    }
  }
  await foto(pagina, "2-formulario");
  if (!clave) throw new Error("No encontré el campo de contraseña. Mirá tmp/cusat/2-formulario.png.");
  if (await hayCaptcha(pagina)) {
    detenido = "La web pide captcha antes de ingresar. Paré acá como pediste.";
    throw new Error(detenido);
  }

  // Usuario: el campo de texto visible que está antes de la contraseña.
  const usuario = await (async () => {
    const candidatos = marco.locator('input:not([type="password"]):not([type="hidden"]):not([type="checkbox"]):not([type="submit"]):not([type="button"])');
    const n = await candidatos.count();
    for (let i = 0; i < n; i++) if (await candidatos.nth(i).isVisible().catch(() => false)) return candidatos.nth(i);
    return null;
  })();
  if (!usuario) throw new Error("No encontré el campo de usuario.");

  marcar("ingresando");
  await usuario.fill(USUARIO);
  await clave.fill(CLAVE);
  const boton = await (async () => {
    for (const s of ['button:has-text("Ingresar")', 'input[type="submit"]', 'button[type="submit"]', 'button:has-text("Entrar")', 'button:has-text("Iniciar")', 'button:has-text("Login")', 'a:has-text("Ingresar")']) {
      const l = marco.locator(s).first();
      if ((await l.count().catch(() => 0)) && (await l.isVisible().catch(() => false))) return l;
    }
    return null;
  })();
  if (boton) await boton.click();
  else await clave.press("Enter");
  await pagina.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await pagina.waitForTimeout(3_000);
  await foto(pagina, "3-despues-del-login");

  if (await hayCaptcha(pagina)) {
    detenido = "Después de tocar Ingresar apareció un captcha. Paré acá como pediste.";
    throw new Error(detenido);
  }
  if (await haySegundoFactor(pagina)) {
    detenido = "La web pide un código de verificación (segundo factor). Paré acá como pediste.";
    throw new Error(detenido);
  }
  if (await primero(pagina, ['input[type="password"]'])) {
    const msj = (await pagina.locator("text=/incorrect|inv[aá]lid|error|no coincide/i").first().innerText().catch(() => "")).slice(0, 160);
    throw new Error(`Sigue el formulario de ingreso después de tocar Ingresar.${msj ? ` La web dice: "${msj}"` : ""} ¿Usuario o contraseña incorrectos?`);
  }

  marcar("esperando el mapa y la lista de vehículos");
  await pagina.waitForSelector(".leaflet-container, .gm-style, .ol-viewport, .mapboxgl-map, canvas, #map, [id*=map i]", { timeout: 60_000 }).catch(() => problemas.push("No reconocí el mapa en 60 s (mirá tmp/cusat/4-mapa.png)."));
  await pagina.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await pagina.waitForTimeout(5_000);
  await foto(pagina, "4-mapa");
  marcar("mapa cargado");
  const finEspera = Date.now() + SEGUNDOS_DESPUES_DEL_MAPA * 1000;

  // Clic en un vehículo de la lista (o del mapa).
  const vehiculo = await primero(pagina, VEHICULOS.flatMap((v) => [`text="${v}"`, `text=/${v}/i`]).concat(PATENTES.map((p) => `text=/${p}/i`)));
  if (vehiculo) {
    marcar(`clic en un vehículo (${(await vehiculo.innerText().catch(() => "?")).slice(0, 40)})`);
    await vehiculo.click({ timeout: 5_000 }).catch((e) => problemas.push(`No se pudo hacer clic en el vehículo: ${(e as Error).message.slice(0, 100)}`));
    await pagina.waitForTimeout(5_000);
    await foto(pagina, "5-vehiculo");
  } else problemas.push("No encontré ningún vehículo por nombre ni patente en la pantalla.");

  // Historial / recorrido de hoy.
  const historial = await primero(pagina, ['text=/^\\s*historial\\s*$/i', 'text=/recorrido/i', 'text=/historial/i', '[title*="istorial"]', '[title*="ecorrido"]', 'text=/reporte de posiciones/i']);
  if (historial) {
    marcar("abriendo historial / recorrido");
    await historial.click({ timeout: 5_000 }).catch((e) => problemas.push(`No se pudo abrir el historial: ${(e as Error).message.slice(0, 100)}`));
    await pagina.waitForTimeout(3_000);
    await foto(pagina, "6-historial");
    const consultar = await primero(pagina, ['button:has-text("Buscar")', 'button:has-text("Consultar")', 'button:has-text("Ver")', 'button:has-text("Aceptar")', 'button:has-text("Generar")', 'input[type="submit"]']);
    if (consultar) {
      marcar("consultando el historial de hoy");
      await consultar.click({ timeout: 5_000 }).catch(() => {});
      await pagina.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
      await pagina.waitForTimeout(5_000);
      await foto(pagina, "7-historial-hoy");
    } else problemas.push("Abrí el historial pero no encontré el botón para consultar (puede que cargue solo).");
  } else problemas.push("No encontré una sección de historial/recorrido.");

  marcar(`registrando el tráfico en vivo hasta completar ${SEGUNDOS_DESPUES_DEL_MAPA} s desde el mapa`);
  while (Date.now() < finEspera) await pagina.waitForTimeout(1_000);
  await foto(pagina, "8-final");
  marcar("listo");
} catch (e) {
  const m = (e as Error).message;
  if (!detenido) problemas.push(m);
  console.error(`\nSE DETUVO: ${m}`);
  await foto(pagina, "error");
} finally {
  await new Promise((r) => setTimeout(r, 1_500)); // últimas respuestas
  await navegador.close();
}

// ───────────────────────── Salida ─────────────────────────

const textoDe = (e: Entrada) => JSON.stringify(e.responseBody ?? "");
const conVehiculos = entradas.filter((e) => VEHICULOS.some((v) => textoDe(e).toUpperCase().includes(v)) || PATENTES.some((p) => textoDe(e).toUpperCase().replace(/[\s-]/g, "").includes(p)));
const encontrados = {
  nombres: VEHICULOS.filter((v) => entradas.some((e) => textoDe(e).toUpperCase().includes(v)) || sockets.some((s) => JSON.stringify(s.recibidos).toUpperCase().includes(v))),
  patentes: PATENTES.filter((p) => entradas.some((e) => textoDe(e).toUpperCase().replace(/[\s-]/g, "").includes(p)) || sockets.some((s) => JSON.stringify(s.recibidos).toUpperCase().replace(/[\s-]/g, "").includes(p))),
};
const datos = entradas.filter((e) => ["xhr", "fetch", "document", "websocket", "eventsource", "other"].includes(e.tipo));
const archivo = `docs/cusat/captura-${fecha}.json`;
writeFileSync(archivo, JSON.stringify({ fecha, fases, detenido, problemas, encontrados, sockets, entradas }, null, 2));

const host = (u: string) => {
  try {
    const x = new URL(u);
    return x.origin + x.pathname;
  } catch {
    return u;
  }
};
const lineas = [
  `# Cusat View · API descubierta (inventario automático del ${fecha})`,
  "",
  "> Generado por scripts/cusat-descubrir.ts. Usuario y contraseña tapados con ***; cookies y tokens recortados.",
  "> La captura completa está en " + archivo + " (no se sube a git).",
  "",
  detenido ? `**Se detuvo:** ${detenido}\n` : "",
  "## Pasos",
  ...fases.map((f) => `- ${f.t} s · ${f.fase}`),
  "",
  "## Vehículos encontrados en las respuestas",
  `- Nombres: ${encontrados.nombres.join(", ") || "ninguno"} (de ${VEHICULOS.length})`,
  `- Patentes: ${encontrados.patentes.join(", ") || "ninguna"} (de ${PATENTES.length})`,
  "",
  "## Llamadas con datos (XHR, fetch, documentos)",
  "| # | s | Método | URL | Status | Tipo | Trae vehículos |",
  "|---|---|---|---|---|---|---|",
  ...datos.map((e) => `| ${e.n} | ${e.t} | ${e.metodo} | ${host(e.url)} | ${e.status ?? e.error ?? "-"} | ${(e.contentType ?? "").split(";")[0]} | ${conVehiculos.includes(e) ? "sí" : ""} |`),
  "",
  "## Cookies que pone el servidor",
  ...[...new Set(entradas.flatMap((e) => (e.responseHeaders?.["set-cookie"] ?? "").split("; ").map((c) => c.split("=")[0]).filter((c) => c && !/^(path|expires|max-age|domain|secure|httponly|samesite)$/i.test(c))))].map((c) => `- ${c}`),
  "",
  "## WebSockets",
  ...(sockets.length ? sockets.map((s) => `- ${s.url} · ${s.enviados.length} enviados, ${s.recibidos.length} recibidos`) : ["- Ninguno"]),
  "",
  "## Problemas",
  ...(problemas.length ? problemas.map((p) => `- ${p}`) : ["- Ninguno"]),
  "",
];
writeFileSync("docs/cusat/api-descubierta.md", lineas.join("\n"));

console.log(`\nCaptura: ${archivo} (${entradas.length} requests, ${sockets.length} websockets)`);
console.log(`Vehículos encontrados: ${encontrados.nombres.length}/6 nombres, ${encontrados.patentes.length}/6 patentes`);
if (problemas.length) console.log("Problemas:\n- " + problemas.join("\n- "));
console.log("Resumen: docs/cusat/api-descubierta.md · Capturas de pantalla: tmp/cusat/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
