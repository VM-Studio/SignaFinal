/**
 * Carga los DATOS BASE (src/lib/base/datos.ts): usuarios con su rol, base y depósito, los seis
 * vehículos reales y el inventario de herramientas en el depósito. Borra todo lo demás.
 * Lo mismo hace el botón "Dejar solo los datos base" (Mi cuenta, con MODO_DEMO) y scripts/cargar-base.ts.
 */
import { PrismaClient } from "@prisma/client";
import { cargarDatosBase } from "../src/lib/base/datos";

const db = new PrismaClient();

cargarDatosBase(db)
  .then((conteo) => console.table(conteo))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
