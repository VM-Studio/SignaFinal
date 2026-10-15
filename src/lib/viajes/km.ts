import { distancia } from "@/lib/geo";

/**
 * KM DE UN VIAJE SIN QUE EL CHOFER ESCRIBA NADA (pura; la prueban los tests).
 * Con las posiciones GPS del viaje (Cusat o el teléfono) entre el inicio y el fin: se suman los tramos entre
 * lecturas, descartando saltos imposibles (más rápido que velocidadMaximaKmh) y lecturas imprecisas, y sin
 * contar el temblor del GPS parado (menos de ruidoM). Si no hubo posiciones (o cubren menos de la mitad de lo
 * que mide la ruta: el GPS se cortó), la distancia de la ruta calculada por lib/rutas.
 */
export const LIMITES_KM = { velocidadMaximaKmh: 140, precisionMaximaM: 150, ruidoM: 25, coberturaMinima: 0.5 };

export type PosicionKm = { lat: number; lng: number; fecha: Date; precisionM?: number | null };

/** Metros recorridos según el GPS, o null si no alcanzan las lecturas. */
export function metrosPorGps(posiciones: PosicionKm[]): number | null {
  const pts = posiciones
    .filter((p) => p.precisionM == null || p.precisionM <= LIMITES_KM.precisionMaximaM)
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  if (pts.length < 2) return null;
  let total = 0;
  let ultimo = pts[0];
  for (const p of pts.slice(1)) {
    const m = distancia(ultimo, p);
    const s = (p.fecha.getTime() - ultimo.fecha.getTime()) / 1000;
    if (s <= 0) continue;
    if ((m / s) * 3.6 > LIMITES_KM.velocidadMaximaKmh) continue; // salto imposible: se descarta esta lectura
    if (m < LIMITES_KM.ruidoM) continue; // parado: el GPS tiembla
    total += m;
    ultimo = p;
  }
  return total;
}

/** Los km que se cobran: GPS si cubre el recorrido; si no, la ruta. Enteros, nunca negativos. */
export function kmDelViaje(entrada: { posiciones: PosicionKm[]; rutaM: number | null }): { km: number; fuente: "GPS" | "RUTA" } {
  const gps = metrosPorGps(entrada.posiciones);
  const ruta = entrada.rutaM ?? 0;
  if (gps != null && gps > 0 && (ruta === 0 || gps >= ruta * LIMITES_KM.coberturaMinima)) return { km: Math.round(gps / 1000), fuente: "GPS" };
  return { km: Math.round(ruta / 1000), fuente: "RUTA" };
}
