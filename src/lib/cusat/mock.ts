import "server-only";
import { db } from "@/lib/db";
import { largo, puntoEn, type Punto } from "@/lib/geo";
import type { ClienteCusat, PosicionCusat } from "./tipos";
import { paradasDe } from "./rutas";

/**
 * Simulador de Cusat, mientras no haya acceso a la API real.
 * - Vehículos EN_VIAJE: avanzan por la ruta de su viaje (base → retiro → obra) a 28 km/h
 *   desde la hora de salida, con 20 minutos parados donde cargan. Al llegar quedan en la obra.
 * - El resto: en su base (o en su última posición conocida si no tiene base).
 */

const VELOCIDAD_MS = 28_000 / 3600; // 28 km/h en m/s
const CARGA_MS = 20 * 60_000; // parados cargando en el proveedor o depósito
/** Para la demo: SIMULADOR_ACELERAR=10 hace que el viaje ocurra 10 veces más rápido. */
const ACELERAR = Math.max(1, Number(process.env.SIMULADOR_ACELERAR ?? 1) || 1);

const incluir = {
  vehiculo: { select: { id: true, baseId: true } },
  pedido: { select: { origenTipo: true, origenId: true, obraId: true } },
} as const;

/** Posición simulada de un viaje a "ms" de su salida. */
async function enViaje(viaje: { salidaReal: Date | null; vehiculo: { baseId: string | null }; pedido: { origenTipo: "BASE" | "PROVEEDOR" | "DEPOSITO" | "OBRA"; origenId: string; obraId: string } }, instante: Date) {
  const paradas = await paradasDe(viaje);
  const ruta: Punto[] = paradas.map((p) => ({ lat: p.lat, lng: p.lng }));
  const ms = Math.max(0, instante.getTime() - (viaje.salidaReal ?? instante).getTime()) * ACELERAR;
  const hayRetiro = paradas.some((p) => p.tipo === "retiro");
  const hastaRetiro = hayRetiro ? largo(ruta.slice(0, 2)) : Infinity;
  let metros = (ms / 1000) * VELOCIDAD_MS;
  let parado = false;
  if (hayRetiro && metros > hastaRetiro) {
    const msHastaRetiro = (hastaRetiro / VELOCIDAD_MS) * 1000;
    if (ms < msHastaRetiro + CARGA_MS) {
      metros = hastaRetiro;
      parado = true;
    } else metros = ((ms - CARGA_MS) / 1000) * VELOCIDAD_MS;
  }
  const llego = metros >= largo(ruta);
  const { punto, rumbo } = puntoEn(ruta, metros);
  return { punto, rumbo, velocidad: parado || llego ? 0 : 28, motor: !llego };
}

export class CusatMock implements ClienteCusat {
  readonly origen = "mock" as const;

  async obtenerPosicionesActuales(): Promise<PosicionCusat[]> {
    const ahora = new Date();
    const vehiculos = await db.vehiculo.findMany({
      where: { activo: true, idCusat: { not: null } },
      select: {
        id: true, baseId: true,
        base: { select: { latitud: true, longitud: true } },
        viajes: { where: { estado: "EN_CURSO" }, take: 1, include: incluir },
        posiciones: { orderBy: { fecha: "desc" }, take: 1 },
      },
    });
    const baseGeneral = await db.ubicacion.findFirst({ where: { tipo: "BASE_VEHICULOS" } });
    const out: PosicionCusat[] = [];
    for (const v of vehiculos) {
      const viaje = v.viajes[0];
      if (viaje) {
        const s = await enViaje(viaje, ahora);
        out.push({ vehiculoId: v.id, latitud: s.punto.lat, longitud: s.punto.lng, velocidad: s.velocidad, rumbo: s.rumbo, motorEncendido: s.motor, fecha: ahora });
        continue;
      }
      // Sin viaje: en su base; sin base, donde se lo vio por última vez.
      const ult = v.posiciones[0];
      const lat = v.base?.latitud ?? ult?.latitud ?? baseGeneral?.latitud;
      const lng = v.base?.longitud ?? ult?.longitud ?? baseGeneral?.longitud;
      if (lat == null || lng == null) continue;
      out.push({ vehiculoId: v.id, latitud: lat, longitud: lng, velocidad: 0, rumbo: 0, motorEncendido: false, fecha: ahora });
    }
    return out;
  }

  /** Recorrido simulado: cada 2 minutos, en viaje si había uno en ese momento; si no, en la base. */
  async obtenerHistorial(vehiculoId: string, desde: Date, hasta: Date): Promise<PosicionCusat[]> {
    const fin = new Date(Math.min(hasta.getTime(), Date.now()));
    const [v, viajes] = await Promise.all([
      db.vehiculo.findUnique({ where: { id: vehiculoId }, select: { base: { select: { latitud: true, longitud: true } } } }),
      db.viaje.findMany({
        where: { vehiculoId, salidaReal: { lt: fin }, OR: [{ llegadaReal: null }, { llegadaReal: { gt: desde } }], estado: { in: ["EN_CURSO", "FINALIZADO"] } },
        include: incluir,
        orderBy: { salidaReal: "asc" },
      }),
    ]);
    const out: PosicionCusat[] = [];
    for (let t = desde.getTime(); t <= fin.getTime(); t += 2 * 60_000) {
      const instante = new Date(t);
      const viaje = viajes.find((x) => x.salidaReal! <= instante && (!x.llegadaReal || x.llegadaReal >= instante));
      if (viaje) {
        const s = await enViaje(viaje, instante);
        out.push({ vehiculoId, latitud: s.punto.lat, longitud: s.punto.lng, velocidad: s.velocidad, rumbo: s.rumbo, motorEncendido: s.motor, fecha: instante });
      } else if (v?.base) {
        out.push({ vehiculoId, latitud: v.base.latitud, longitud: v.base.longitud, velocidad: 0, rumbo: 0, motorEncendido: false, fecha: instante });
      }
    }
    return out;
  }
}
