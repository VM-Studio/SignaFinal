"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Circle, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useEffect, useRef } from "react";
import type { DatosMapa, ParadaNumerada, PuntoRastro } from "@/lib/mapa/consultas";
import { iconoLugar, iconoObra, iconoParada, iconoVehiculo } from "./iconos";

function Encuadre({ datos, elegido, recorrido }: { datos: DatosMapa; elegido?: string; recorrido?: { paradas: ParadaNumerada[]; rastro: PuntoRastro[] } | null }) {
  const mapa = useMap();
  const primera = useRef(true);
  useEffect(() => {
    if (!primera.current) return;
    primera.current = false;
    // El encuadre inicial es zona norte: los vehículos del interior no achican el mapa.
    const base = datos.lugares.find((l) => l.tipo === "BASE_VEHICULOS") ?? { lat: -34.5, lng: -58.52 };
    const cerca = (lat: number, lng: number) => L.latLng(lat, lng).distanceTo([base.lat, base.lng]) < 40_000;
    const puntos = [...datos.vehiculos.filter((v) => cerca(v.lat, v.lng)).map((v) => [v.lat, v.lng]), ...datos.obras.map((o) => [o.lat, o.lng]), ...datos.lugares.map((l) => [l.lat, l.lng])] as [number, number][];
    if (puntos.length) mapa.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 13 });
  }, [datos, mapa]);
  useEffect(() => {
    const v = datos.vehiculos.find((x) => x.id === elegido);
    if (v && !recorrido) mapa.setView([v.lat, v.lng], Math.max(mapa.getZoom(), 13));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elegido]);
  useEffect(() => {
    if (!recorrido) return;
    const puntos = [...recorrido.paradas.map((p) => [p.lat, p.lng]), ...recorrido.rastro.map((p) => [p.lat, p.lng])] as [number, number][];
    if (puntos.length) mapa.fitBounds(L.latLngBounds(puntos), { padding: [50, 50], maxZoom: 14 });
  }, [recorrido, mapa]);
  return null;
}

export default function MapaLeaflet({ datos, elegido, onElegir, recorrido }: {
  datos: DatosMapa; elegido?: string; onElegir?: (id: string) => void; recorrido?: { paradas: ParadaNumerada[]; rastro: PuntoRastro[] } | null;
}) {
  return (
    <MapContainer center={[-34.5, -58.52]} zoom={11} className="h-full w-full" zoomControl={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' maxZoom={19} />
      {datos.obras.map((o) => (
        <Circle key={`g-${o.id}`} center={[o.lat, o.lng]} radius={o.radio} pathOptions={{ color: "#000", weight: 1.5, dashArray: "6 6", fillColor: "#000", fillOpacity: 0.04 }} />
      ))}
      {datos.obras.map((o) => <Marker key={o.id} position={[o.lat, o.lng]} icon={iconoObra(`Obra ${o.nombre}`)} />)}
      {datos.lugares.map((l) => <Marker key={l.id} position={[l.lat, l.lng]} icon={iconoLugar(l.nombre, l.tipo)} />)}
      {recorrido && recorrido.paradas.length > 1 && (
        <Polyline positions={recorrido.paradas.map((p) => [p.lat, p.lng])} pathOptions={{ color: "#000", weight: 3, dashArray: "8 8", opacity: 0.8 }} />
      )}
      {recorrido && recorrido.rastro.length > 1 && (
        <Polyline positions={recorrido.rastro.map((p) => [p.lat, p.lng])} pathOptions={{ color: "#1F7A4D", weight: 5, opacity: 0.9 }} />
      )}
      {recorrido?.paradas.map((p) => (
        <Marker key={`p-${p.numero}`} position={[p.lat, p.lng]} icon={iconoParada(p.numero)} zIndexOffset={2000}>
          <Tooltip direction="top" offset={[0, -14]}>{p.numero}. {p.nombre}</Tooltip>
        </Marker>
      ))}
      {datos.vehiculos.map((v) => (
        <Marker key={v.id} position={[v.lat, v.lng]} icon={iconoVehiculo(v, v.id === elegido)} zIndexOffset={v.id === elegido ? 3000 : v.estado === "EN_VIAJE" ? 1500 : 1000} eventHandlers={{ click: () => onElegir?.(v.id) }} />
      ))}
      <Encuadre datos={datos} elegido={elegido} recorrido={recorrido} />
    </MapContainer>
  );
}
