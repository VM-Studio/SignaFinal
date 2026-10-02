"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { ParadaNumerada, PuntoRastro } from "@/lib/mapa/consultas";
import { iconoParada } from "./iconos";

function Encuadre({ rastro }: { rastro: PuntoRastro[] }) {
  const mapa = useMap();
  useEffect(() => {
    mapa.fitBounds(L.latLngBounds(rastro.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 15 });
  }, [mapa, rastro]);
  return null;
}

export default function MapaReproduccion({ rastro, paradas, actual }: { rastro: PuntoRastro[]; paradas: ParadaNumerada[]; actual: number }) {
  const p = rastro[actual];
  return (
    <MapContainer center={[p.lat, p.lng]} zoom={13} className="h-full w-full">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
      <Polyline positions={rastro.map((x) => [x.lat, x.lng])} pathOptions={{ color: "#9a9a94", weight: 4 }} />
      <Polyline positions={rastro.slice(0, actual + 1).map((x) => [x.lat, x.lng])} pathOptions={{ color: "#1F7A4D", weight: 5 }} />
      {paradas.map((s) => <Marker key={s.numero} position={[s.lat, s.lng]} icon={iconoParada(s.numero)} />)}
      <CircleMarker center={[p.lat, p.lng]} radius={10} pathOptions={{ color: "#fff", weight: 3, fillColor: "#000", fillOpacity: 1 }} />
      <Encuadre rastro={rastro} />
    </MapContainer>
  );
}
