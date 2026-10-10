/** Formatos de ruteo (puros: sirven en cliente y servidor). */

/** "12 min", "1 h 05 min". */
export function minutos(s: number) {
  const m = Math.max(1, Math.round(s / 60));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}

/** "3,4 km", "800 m". */
export function metros(m: number) {
  return m < 1000 ? `${Math.round(m / 50) * 50} m` : `${(m / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} km`;
}

/** Polyline codificada de Google → [lat, lng][]. */
export function decodificarPolyline(s: string): [number, number][] {
  const puntos: [number, number][] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  const siguiente = () => {
    let resultado = 0;
    let corrimiento = 0;
    let b: number;
    do {
      b = s.charCodeAt(i++) - 63;
      resultado |= (b & 0x1f) << corrimiento;
      corrimiento += 5;
    } while (b >= 0x20);
    return resultado & 1 ? ~(resultado >> 1) : resultado >> 1;
  };
  while (i < s.length) {
    lat += siguiente();
    lng += siguiente();
    puntos.push([lat / 1e5, lng / 1e5]);
  }
  return puntos;
}
