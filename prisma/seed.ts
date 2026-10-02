/**
 * Carga inicial / reinicio de los datos de demostración.
 * Los datos están en src/lib/demo/datos.ts (también los usa el botón de reinicio).
 * Se corre con la condición "react-server" para poder usar el evaluador de alertas.
 */
import { PrismaClient } from "@prisma/client";
import { cargarDatosDemo } from "../src/lib/demo/datos";
import { evaluarAlertas } from "../src/lib/alertas";

const db = new PrismaClient();

cargarDatosDemo(db)
  .then(async (conteo) => {
    const alertas = await evaluarAlertas();
    console.table({ ...conteo, "Alertas activas": alertas.activas });
    const porEstado = await db.pedidoViaje.groupBy({ by: ["estado"], _count: { _all: true } });
    console.log("Pedidos por estado:", Object.fromEntries(porEstado.map((p) => [p.estado, p._count._all])));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
