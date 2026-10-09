"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";

const pin = (texto: string, negro: boolean) =>
  L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center">
      <span style="font:600 12px/1 var(--font-archivo),system-ui;background:${negro ? "#000" : "#fff"};color:${negro ? "#fff" : "#000"};border:1px solid #111827;padding:3px 6px;border-radius:4px;white-space:nowrap">${texto.replace(/[<>&]/g, "")}</span>
      <span style="width:2px;height:8px;background:#000"></span></div>`,
  });

function Encuadre({ puntos }: { puntos: [number, number][] }) {
  const mapa = useMap();
  useEffect(() => {
    mapa.fitBounds(L.latLngBounds(puntos), { padding: [28, 28], maxZoom: 16 });
  }, [mapa, puntos]);
  return null;
}

/** Mapa chico del tramo actual: de dónde sale, a dónde va y por dónde. */
export default function MapaTramo({ geometria, desde, hasta, nombreHasta }: {
  geometria: [number, number][]; desde: { lat: number; lng: number }; hasta: { lat: number; lng: number }; nombreHasta: string;
}) {
  const puntos: [number, number][] = [[desde.lat, desde.lng], [hasta.lat, hasta.lng], ...geometria];
  return (
    <MapContainer center={[hasta.lat, hasta.lng]} zoom={13} zoomControl={false} attributionControl={false} className="h-full w-full">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Polyline positions={geometria} pathOptions={{ color: "#000", weight: 5, opacity: 0.85 }} />
      <CircleMarker center={[desde.lat, desde.lng]} radius={8} pathOptions={{ color: "#fff", weight: 3, fillColor: "#1F7A4D", fillOpacity: 1 }} />
      <Marker position={[hasta.lat, hasta.lng]} icon={pin(nombreHasta, true)} />
      <Encuadre puntos={puntos} />
    </MapContainer>
  );
}
