/**
 * Une las auditorías responsive corridas en paralelo (tmp/responsive-<etiqueta>-*.json) en
 * tmp/responsive-<etiqueta>.md, con el mismo formato que scripts/auditar-responsive.ts.
 *
 *   npx tsx scripts/unir-responsive.ts antes
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

type Caso = { rol: string; ruta: string; ancho: number; donde: string; selector: string; izquierda: number; derecha: number; ancho_el: number; texto: string };
type Ancho = { rol: string; ruta: string; ancho: number; contenido: number; disponible: number; pct: number; selector: string };

const ETIQUETA = process.argv[2] ?? "auditoria";
const partes = readdirSync("tmp").filter((f) => f.startsWith(`responsive-${ETIQUETA}-`) && f.endsWith(".json"));
let paginas = 0;
const casos: Caso[] = [];
const anchos: Ancho[] = [];
for (const f of partes) {
  const d = JSON.parse(readFileSync(`tmp/${f}`, "utf8")) as { paginas: number; casos: Caso[]; anchos: Ancho[] };
  paginas += d.paginas;
  casos.push(...d.casos);
  anchos.push(...d.anchos);
}
casos.sort((a, b) => a.rol.localeCompare(b.rol) || a.ruta.localeCompare(b.ruta) || a.ancho - b.ancho);
const angostas = anchos.filter((a) => a.pct < 90);
const rutasConDesborde = new Set(casos.map((c) => `${c.rol} ${c.ruta}`));
const md = [
  `# Auditoría responsive · ${ETIQUETA}`,
  "",
  `${paginas} pantallas recorridas (${partes.length} partes en paralelo). Capturas en tmp/capturas/responsive/${ETIQUETA}-*/.`,
  "",
  `## Celular (360, 390, 430 px): ${casos.length} desbordes en ${rutasConDesborde.size} pantallas`,
  "",
  ...(casos.length ? ["| Rol | Ruta | Ancho | Dónde | Elemento | Izq. | Der. | Ancho | Texto |", "|---|---|---|---|---|---|---|---|---|", ...casos.map((c) => `| ${c.rol} | ${c.ruta} | ${c.ancho} | ${c.donde} | \`${c.selector}\` | ${c.izquierda} | ${c.derecha} | ${c.ancho_el} | ${c.texto.replace(/\|/g, "/")} |`)] : ["Ninguno."]),
  "",
  `## Escritorio (1440, 1920 px): ${angostas.length} pantallas usan menos del 90 % del ancho`,
  "",
  "| Rol | Ruta | Ancho | Contenido | Disponible | % | Elemento más ancho |",
  "|---|---|---|---|---|---|---|",
  ...[...anchos].sort((a, b) => a.pct - b.pct).map((a) => `| ${a.rol} | ${a.ruta} | ${a.ancho} | ${a.contenido} | ${a.disponible} | ${a.pct < 90 ? `**${a.pct}**` : a.pct} | \`${a.selector}\` |`),
].join("\n");
writeFileSync(`tmp/responsive-${ETIQUETA}.md`, md);
writeFileSync("tmp/responsive.md", md);
console.log(`${paginas} pantallas · celular: ${casos.length} desbordes en ${rutasConDesborde.size} pantallas · escritorio: ${angostas.length} por debajo del 90 %`);
