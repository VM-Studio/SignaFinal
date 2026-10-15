/**
 * Capturas a 390 px del inicio con la barra inferior y del "Más" de cada rol (y del escritorio a 1440),
 * en tmp/capturas/navegacion/.
 *
 *   npx tsx scripts/capturas-roles.ts [http://localhost:3100]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3100";
const DIR = "tmp/capturas/navegacion";
mkdirSync(DIR, { recursive: true });
const ROLES = ["direccion", "compras", "daniela", "lolo", "claudio", "deposito", "administracion"];

(async () => {
  const nav = await chromium.launch();
  for (const quien of ROLES) {
    for (const ancho of [390, 1440]) {
      const ctx = await nav.newContext({ viewport: { width: ancho, height: ancho < 1024 ? 844 : 900 }, isMobile: ancho < 1024, hasTouch: ancho < 1024, serviceWorkers: "block" });
      await ctx.addInitScript(() => sessionStorage.setItem("signa:splash-visto", "1"));
      const p = await ctx.newPage();
      await p.goto(`${BASE}/login`);
      await p.fill("#email", `${quien}@signa.demo`);
      await p.fill("#password", "signa2026");
      await p.click('button[type="submit"]');
      await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
      // El splash de ingreso dura 2,5 s.
      await p.waitForTimeout(3500);
      await p.screenshot({ path: `${DIR}/${ancho}-${quien}-inicio.png` });
      if (ancho < 1024) {
        await p.locator('nav[aria-label="Principal"] button').last().click();
        await p.waitForTimeout(600);
        await p.screenshot({ path: `${DIR}/${ancho}-${quien}-mas.png` });
        const barra = await p.locator('nav[aria-label="Principal"] li').allInnerTexts();
        console.log(quien.padEnd(15), barra.map((t) => t.replace(/\s+/g, " ").trim()).join(" · "));
      }
      await ctx.close();
    }
  }
  await nav.close();
})();
