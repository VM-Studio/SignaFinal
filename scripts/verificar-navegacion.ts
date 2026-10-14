/**
 * Recorre la matriz de permisos y comprueba que cada ruta permitida de cada rol tiene al menos un
 * enlace en la navegación de ese rol (barra inferior, Más, barra lateral o el header).
 *
 *   npx tsx scripts/verificar-navegacion.ts
 */
import type { Rol } from "@prisma/client";
import { MATRIZ } from "../src/lib/permisos";
import { barraInferior, menuMas, rutasSinEnlace } from "../src/lib/navegacion";

let faltan = 0;
for (const rol of Object.keys(MATRIZ) as Rol[]) {
  const sin = rutasSinEnlace(rol, MATRIZ[rol].rutas);
  faltan += sin.length;
  const barra = barraInferior(rol).map((s) => s.titulo).join(" · ");
  const mas = menuMas(rol).flatMap((g) => g.items.map((s) => s.titulo)).join(", ");
  console.log(`${rol.padEnd(17)} ${barra} · Más (${mas})${sin.length ? `\n  SIN ENLACE: ${sin.join(", ")}` : "  ✓"}`);
}
console.log(faltan ? `\n${faltan} rutas sin enlace.` : "\nTodas las rutas permitidas tienen un enlace en la navegación de su rol.");
process.exit(faltan ? 1 : 0);
