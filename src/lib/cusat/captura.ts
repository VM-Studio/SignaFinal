import "server-only";
import { db } from "@/lib/db";
import { evaluarAlertas } from "@/lib/alertas";
import { clienteCusat } from "./index";
import { aplicarGeocercas } from "./geocercas";

/** Cada cuánto como mínimo se guarda una tanda de posiciones. */
const INTERVALO_MS = 50_000;

/**
 * Job de posiciones: pide la posición actual al adaptador (mock o API real), la guarda
 * en PosicionVehiculo, aplica geocercas y reevalúa las alertas de Cusat y de viajes.
 * Lo llama el cron cada minuto (POST /api/posiciones). Si nadie lo llama, el mapa lo
 * dispara al abrirse, con el mismo límite de una vez por minuto.
 */
export async function capturarPosiciones({ forzar = false } = {}) {
  const ultima = await db.posicionVehiculo.findFirst({ orderBy: { fecha: "desc" }, select: { fecha: true } });
  if (!forzar && ultima && Date.now() - ultima.fecha.getTime() < INTERVALO_MS) return { guardadas: 0, eventos: [] as string[], salteado: true };

  const cusat = clienteCusat();
  const posiciones = await cusat.obtenerPosicionesActuales();
  if (posiciones.length) {
    await db.posicionVehiculo.createMany({
      data: posiciones.map((p) => ({ vehiculoId: p.vehiculoId, latitud: p.latitud, longitud: p.longitud, velocidad: p.velocidad, rumbo: p.rumbo, motorEncendido: p.motorEncendido, fecha: p.fecha })),
    });
  }
  const eventos = await aplicarGeocercas(posiciones);
  await evaluarAlertas(["cusat", "pedidos"]);
  return { guardadas: posiciones.length, eventos, salteado: false, origen: cusat.origen };
}
