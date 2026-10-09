"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import { useEffect, useRef } from "react";

const etiqueta = (texto: string, negro: boolean) =>
  L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center">
      <span style="font:600 12px/1 var(--font-archivo),system-ui;background:${negro ? "#000" : "#fff"};color:${negro ? "#fff" : "#000"};border:1px solid #111827;padding:3px 6px;border-radius:4px;white-space:nowrap">${texto.replace(/[<>&]/g, "")}</span>
      <span style="width:2px;height:8px;background:#000"></span></div>`,
  });

const camion = L.divIcon({
  className: "",
  iconSize: [0, 0],
  html: `<div style="transform:translate(-50%,-50%);width:34px;height:34px;border-radius:50%;background:#1F7A4D;border:3px solid #fff;box-shadow:0 0 0 2px #1F7A4D;display:grid;place-items:center">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17" r="1.6" fill="#fff"/><circle cx="17" cy="17" r="1.6" fill="#fff"/></svg></div>`,
});

/** Encuadra una sola vez al abrir; después no le mueve el mapa a quien lo está mirando. */
function Encuadre({ puntos }: { puntos: [number, number][] }) {
  const mapa = useMap();
  const hecho = useRef(false);
  useEffect(() => {
    if (hecho.current) return;
    hecho.current = true;
    mapa.fitBounds(L.latLngBounds(puntos), { padding: [30, 30], maxZoom: 15 });
  }, [mapa, puntos]);
  return null;
}

export default function MapaSeguimiento({ retiro, destino, vehiculo, ruta, etapaRetiro }: {
  retiro: { nombre: string; lat: number; lng: number };
  destino: { nombre: string; lat: number; lng: number };
  vehiculo: { lat: number; lng: number };
  ruta: [number, number][] | null;
  etapaRetiro: boolean;
}) {
  const puntos: [number, number][] = [[retiro.lat, retiro.lng], [destino.lat, destino.lng], [vehiculo.lat, vehiculo.lng]];
  return (
    <MapContainer center={[vehiculo.lat, vehiculo.lng]} zoom={13} zoomControl={false} attributionControl={false} className="h-full w-full">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {ruta && <Polyline positions={ruta} pathOptions={{ color: "#000", weight: 5, opacity: 0.85 }} />}
      <Marker position={[retiro.lat, retiro.lng]} icon={etiqueta(retiro.nombre, etapaRetiro)} />
      <Marker position={[destino.lat, destino.lng]} icon={etiqueta(destino.nombre, !etapaRetiro)} />
      <Marker position={[vehiculo.lat, vehiculo.lng]} icon={camion} />
      <Encuadre puntos={puntos} />
    </MapContainer>
  );
}
