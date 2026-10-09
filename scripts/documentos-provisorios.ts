/**
 * Seguro y VTV vigentes PROVISORIOS para los vehículos que no tienen (no toca nada más).
 *   DATABASE_URL="..." npx tsx scripts/documentos-provisorios.ts
 */
import { PrismaClient } from "@prisma/client";
import { documentosProvisorios } from "../src/lib/base/datos";

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {}
}

const db = new PrismaClient();
documentosProvisorios(db)
  .then((c) => console.log(c.length ? `Cargados:\n  ${c.join("\n  ")}` : "Todos los vehículos ya tenían seguro y VTV."))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
