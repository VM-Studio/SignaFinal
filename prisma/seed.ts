/**
 * Seed de DESARROLLO: los datos base (src/lib/base/datos.ts: usuarios, obras reales, base y depósitos,
 * flota real, inventario de herramientas) y encima los datos de prueba (src/lib/base/prueba.ts).
 * Producción nunca se siembra: allá se migra (los datos reales se conservan).
 * El botón "Dejar solo los datos base" (Mi cuenta, MODO_DEMO) y scripts/cargar-base.ts cargan solo la base.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { cargarDatosBase } from "../src/lib/base/datos";
import { cargarDatosPrueba } from "../src/lib/base/prueba";

const db = new PrismaClient();

async function main() {
  if (process.env.VERCEL_ENV === "production") throw new Error("El seed borra todo: no se corre en producción.");
  const base = await cargarDatosBase(db);
  const prueba = await cargarDatosPrueba(db);
  // Resumen por tabla (todas las del modelo).
  const tablas: Record<string, number> = {};
  for (const m of Prisma.dmmf.datamodel.models) {
    const delegado = (db as unknown as Record<string, { count: () => Promise<number> }>)[m.name[0].toLowerCase() + m.name.slice(1)];
    if (delegado?.count) tablas[m.name] = await delegado.count();
  }
  console.log("Datos base:", base);
  console.log("Datos de prueba:", prueba);
  console.table(tablas);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
