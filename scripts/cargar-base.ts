/**
 * Deja la base con solo los DATOS BASE (src/lib/base/datos.ts) y borra todo lo demás.
 *   DATABASE_URL="..." npx tsx scripts/cargar-base.ts
 * Sin DATABASE_URL usa la de .env.
 */
import { PrismaClient } from "@prisma/client";
import { cargarDatosBase } from "../src/lib/base/datos";

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {}
}

const db = new PrismaClient();
cargarDatosBase(db)
  .then((c) => console.table(c))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
