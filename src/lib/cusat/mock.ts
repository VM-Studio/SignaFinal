import "server-only";
import { db } from "@/lib/db";
import { largo, puntoEn, type Punto } from "@/lib/geo";
import type { FuenteCusat, PosicionExterna, Prueba, PuntoHistorial, Resultado } from "./tipos";
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

/**
 * Simulador con el mismo contrato que Cusat View. idExterno = id del vehículo (no hace falta emparejar).
 * Simula todos los vehículos activos, tengan o no equipo.
 */
export class CusatMock implements FuenteCusat {
  readonly modo = "mock" as const;

  async obtenerPosicionesActuales(): Promise<Resultado<PosicionExterna[]>> {
    try {
      const ahora = new Date();
      const vehiculos = await db.vehiculo.findMany({
        where: { activo: true },
        select: {
          id: true, nombre: true, patente: true, baseId: true, ultimaLat: true, ultimaLng: true,
          base: { select: { latitud: true, longitud: true } },
          viajes: { where: { estado: "EN_CURSO" }, take: 1, include: incluir },
          posiciones: { orderBy: { fecha: "desc" }, take: 1 },
        },
      });
      const baseGeneral = await db.ubicacion.findFirst({ where: { tipo: "BASE_VEHICULOS" } });
      const out: PosicionExterna[] = [];
      for (const v of vehiculos) {
        const comun = { idExterno: v.id, nombre: v.nombre, patente: v.patente, direccionTexto: null, fechaGps: ahora };
        const viaje = v.viajes[0];
        if (viaje) {
          const s = await enViaje(viaje, ahora);
          out.push({ ...comun, latitud: s.punto.lat, longitud: s.punto.lng, velocidadKmh: s.velocidad, rumbo: s.rumbo, motorEncendido: s.motor });
          continue;
        }
        // Sin viaje: donde se lo vio por última vez; si nunca, en su base.
        const ult = v.posiciones[0];
        const lat = ult?.latitud ?? v.ultimaLat ?? v.base?.latitud ?? baseGeneral?.latitud;
        const lng = ult?.longitud ?? v.ultimaLng ?? v.base?.longitud ?? baseGeneral?.longitud;
        if (lat == null || lng == null) continue;
        out.push({ ...comun, latitud: lat, longitud: lng, velocidadKmh: 0, rumbo: 0, motorEncendido: false });
      }
      return { ok: true, datos: out };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  /** Recorrido simulado: cada 2 minutos, en viaje si había uno en ese momento; si no, en la base. */
  async obtenerHistorial(vehiculoId: string, desde: Date, hasta: Date): Promise<Resultado<PuntoHistorial[]>> {
    try {
      const fin = new Date(Math.min(hasta.getTime(), Date.now()));
      const [v, viajes] = await Promise.all([
        db.vehiculo.findUnique({ where: { id: vehiculoId }, select: { base: { select: { latitud: true, longitud: true } } } }),
        db.viaje.findMany({
          where: { vehiculoId, salidaReal: { lt: fin }, OR: [{ llegadaReal: null }, { llegadaReal: { gt: desde } }], estado: { in: ["EN_CURSO", "FINALIZADO"] } },
          include: incluir,
          orderBy: { salidaReal: "asc" },
        }),
      ]);
      const out: PuntoHistorial[] = [];
      for (let t = desde.getTime(); t <= fin.getTime(); t += 2 * 60_000) {
        const fecha = new Date(t);
        const viaje = viajes.find((x) => x.salidaReal! <= fecha && (!x.llegadaReal || x.llegadaReal >= fecha));
        if (viaje) {
          const s = await enViaje(viaje, fecha);
          out.push({ latitud: s.punto.lat, longitud: s.punto.lng, velocidadKmh: s.velocidad, fecha });
        } else if (v?.base) out.push({ latitud: v.base.latitud, longitud: v.base.longitud, velocidadKmh: 0, fecha });
      }
      return { ok: true, datos: out };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async probar(): Promise<Prueba> {
    const t = Date.now();
    const r = await this.obtenerPosicionesActuales();
    return {
      modo: this.modo,
      pasos: [{ paso: "Simulador", ok: r.ok, detalle: r.ok ? `${r.datos.length} vehículos simulados (CUSAT_MODO=mock)` : r.error, ms: Date.now() - t }],
    };
  }
}
