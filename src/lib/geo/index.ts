/** Geometría simple sobre lat/lng (distancias cortas, zona norte de Buenos Aires). Pura. */

export type Punto = { lat: number; lng: number };

const R = 6_371_000; // radio de la Tierra en metros
const rad = (g: number) => (g * Math.PI) / 180;

/** Distancia en metros (haversine). */
export function distancia(a: Punto, b: Punto) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rumbo en grados (0 = norte, 90 = este). */
export function rumbo(a: Punto, b: Punto) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Largo total de un recorrido en metros. */
export const largo = (ruta: Punto[]) => ruta.slice(1).reduce((s, p, i) => s + distancia(ruta[i], p), 0);

/** Punto a "metros" del inicio del recorrido (y el rumbo del tramo). Más allá del final, queda en el final. */
export function puntoEn(ruta: Punto[], metros: number): { punto: Punto; rumbo: number; tramo: number } {
  let resto = Math.max(0, metros);
  for (let i = 1; i < ruta.length; i++) {
    const d = distancia(ruta[i - 1], ruta[i]);
    if (resto <= d && d > 0) {
      const f = resto / d;
      return { punto: { lat: ruta[i - 1].lat + (ruta[i].lat - ruta[i - 1].lat) * f, lng: ruta[i - 1].lng + (ruta[i].lng - ruta[i - 1].lng) * f }, rumbo: rumbo(ruta[i - 1], ruta[i]), tramo: i - 1 };
    }
    resto -= d;
  }
  const n = ruta.length;
  return { punto: ruta[n - 1], rumbo: n > 1 ? rumbo(ruta[n - 2], ruta[n - 1]) : 0, tramo: Math.max(0, n - 2) };
}
