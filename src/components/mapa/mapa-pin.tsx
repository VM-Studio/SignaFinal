"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useEffect, useMemo } from "react";

/** Centro por defecto: zona norte del Gran Buenos Aires (donde están las obras). */
const CENTRO: [number, number] = [-34.55, -58.5];

const icono = L.divIcon({
  className: "",
  iconSize: [0, 0],
  html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;cursor:grab">
    <span style="width:18px;height:18px;border-radius:50%;background:#111827;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>
    <span style="width:2px;height:10px;background:#111827"></span></div>`,
});

function Seguir({ punto }: { punto: [number, number] | null }) {
  const mapa = useMap();
  useEffect(() => {
    if (punto) mapa.setView(punto, Math.max(mapa.getZoom(), 16), { animate: false });
  }, [mapa, punto]);
  return null;
}

function Clic({ onMover }: { onMover: (p: { lat: number; lng: number }) => void }) {
  useMapEvents({ click: (e) => onMover({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Mapa chico con el pin: se arrastra (o se toca el mapa) para ajustar dónde queda la dirección. */
export default function MapaPin({ punto, onMover }: { punto: { lat: number; lng: number } | null; onMover: (p: { lat: number; lng: number }) => void }) {
  const pos = useMemo<[number, number] | null>(() => (punto ? [punto.lat, punto.lng] : null), [punto]);
  return (
    <MapContainer center={pos ?? CENTRO} zoom={pos ? 16 : 11} attributionControl={false} className="h-full w-full">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {pos && (
        <Marker
          position={pos}
          icon={icono}
          draggable
          eventHandlers={{ dragend: (e) => { const ll = (e.target as L.Marker).getLatLng(); onMover({ lat: ll.lat, lng: ll.lng }); } }}
        />
      )}
      <Seguir punto={pos} />
      <Clic onMover={onMover} />
    </MapContainer>
  );
}
