/**
 * "Abrir en Google Maps" (cliente): a la parada actual con las siguientes como paradas intermedias.
 * - iPhone: la app de Google Maps (comgooglemaps://) si está instalada; si en 1,2 s no se fue de Signa, la web.
 * - Android: el intent de Google Maps (abre la app en navegación; si no está, la web).
 * - Resto: la web en otra pestaña.
 */
export type PuntoNav = { lat: number; lng: number };

export function urlWeb(puntos: PuntoNav[]) {
  const ps = puntos.slice(0, 10);
  const destino = ps[ps.length - 1];
  const intermedios = ps.slice(0, -1);
  const q = new URLSearchParams({ api: "1", destination: `${destino.lat},${destino.lng}`, travelmode: "driving", dir_action: "navigate" });
  if (intermedios.length) q.set("waypoints", intermedios.map((p) => `${p.lat},${p.lng}`).join("|"));
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}

/** comgooglemaps://?daddr=a+to:b+to:c (Google Maps para iOS acepta destinos encadenados con "+to:"). */
export const urlIOS = (puntos: PuntoNav[]) => `comgooglemaps://?daddr=${puntos.slice(0, 10).map((p) => `${p.lat},${p.lng}`).join("+to:")}&directionsmode=driving`;

/** intent:// para Android: la app de Google Maps con el recorrido; si no está, la web. */
export function urlAndroid(puntos: PuntoNav[]) {
  const web = urlWeb(puntos);
  return `intent://${web.replace(/^https:\/\//, "")}#Intent;scheme=https;package=com.google.android.apps.maps;S.browser_fallback_url=${encodeURIComponent(web)};end`;
}

export function abrirEnGoogleMaps(puntos: PuntoNav[]) {
  if (!puntos.length) return;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) {
    const salio = () => document.hidden;
    window.location.href = urlIOS(puntos);
    window.setTimeout(() => {
      if (!salio()) window.location.href = urlWeb(puntos);
    }, 1200);
    return;
  }
  if (/Android/i.test(ua)) {
    window.location.href = urlAndroid(puntos);
    return;
  }
  window.open(urlWeb(puntos), "_blank", "noopener");
}
