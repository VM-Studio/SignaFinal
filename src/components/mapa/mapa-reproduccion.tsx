"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import { useEffect, useMemo } from "react";
import type { ParadaDetectada, PuntoRastro } from "@/lib/mapa/consultas";
import { iconoParada } from "./iconos";
import { COLORES_VIAJE } from "./colores";

function Encuadre({ rastro }: { rastro: PuntoRastro[] }) {
  const mapa = useMap();
  useEffect(() => {
    mapa.fitBounds(L.latLngBounds(rastro.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 15 });
  }, [mapa, rastro]);
  return null;
}

/** Tramos consecutivos del rastro que pertenecen al mismo viaje del sistema. */
function tramosDeViaje(rastro: PuntoRastro[], enViaje: number[]) {
  const out: { viaje: number; puntos: [number, number][] }[] = [];
  rastro.forEach((p, i) => {
    if (enViaje[i] < 0) return;
    const ult = out.at(-1);
    if (ult && ult.viaje === enViaje[i] && enViaje[i - 1] === enViaje[i]) ult.puntos.push([p.lat, p.lng]);
    else out.push({ viaje: enViaje[i], puntos: [[p.lat, p.lng]] });
  });
  return out;
}

export default function MapaReproduccion({ rastro, paradas, actual, enViaje }: { rastro: PuntoRastro[]; paradas: ParadaDetectada[]; actual: number; enViaje: number[] }) {
  const p = rastro[actual];
  const tramos = useMemo(() => tramosDeViaje(rastro, enViaje), [rastro, enViaje]);
  return (
    <MapContainer center={[p.lat, p.lng]} zoom={13} className="h-full w-full">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
      <Polyline positions={rastro.map((x) => [x.lat, x.lng])} pathOptions={{ color: "#9a9a94", weight: 4 }} />
      {tramos.map((t, k) => <Polyline key={k} positions={t.puntos} pathOptions={{ color: COLORES_VIAJE[t.viaje % COLORES_VIAJE.length], weight: 6, opacity: 0.85 }} />)}
      <Polyline positions={rastro.slice(0, actual + 1).map((x) => [x.lat, x.lng])} pathOptions={{ color: "#000", weight: 2, dashArray: "4 6" }} />
      {paradas.map((s) => <Marker key={s.numero} position={[s.lat, s.lng]} icon={iconoParada(s.numero)} />)}
      <CircleMarker center={[p.lat, p.lng]} radius={10} pathOptions={{ color: "#fff", weight: 3, fillColor: "#000", fillOpacity: 1 }} />
      <Encuadre rastro={rastro} />
    </MapContainer>
  );
}
