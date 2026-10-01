"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { MarcadorLugar, MarcadorVehiculo } from "@/lib/mapa/consultas";

const html = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function iconoVehiculo(v: MarcadorVehiculo) {
  const fondo = v.enViaje ? "#000" : "#fff";
  const texto = v.enViaje ? "#fff" : "#000";
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center">
      <div style="background:${fondo};color:${texto};border:2px solid #000;border-radius:8px;padding:4px 8px;font:600 13px/1.1 var(--font-archivo),system-ui;white-space:nowrap">${html(v.nombre)}</div>
      <div style="width:2px;height:8px;background:#000"></div><div style="width:8px;height:8px;border-radius:50%;background:#000;margin-top:-2px"></div></div>`,
  });
}

function iconoLugar(l: MarcadorLugar) {
  const forma = l.tipo === "obra"
    ? `<div style="width:12px;height:12px;background:#fff;border:3px solid #000;transform:rotate(45deg)"></div>`
    : `<div style="width:14px;height:14px;background:#000;border:2px solid #fff;outline:2px solid #000"></div>`;
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<div style="transform:translate(-8px,-50%);display:flex;align-items:center;gap:6px">${forma}<span style="font:600 12px/1 var(--font-archivo),system-ui;background:rgba(255,255,255,.9);padding:2px 4px;border-radius:4px;white-space:nowrap">${html(l.nombre)}</span></div>`,
  });
}

function Encuadre({ puntos }: { puntos: [number, number][] }) {
  const mapa = useMap();
  useEffect(() => {
    if (puntos.length) mapa.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 13 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function MapaLeaflet({ vehiculos, lugares }: { vehiculos: MarcadorVehiculo[]; lugares: MarcadorLugar[] }) {
  return (
    <MapContainer center={[-34.5, -58.52]} zoom={11} className="h-full w-full" zoomControl={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' maxZoom={19} />
      {lugares.map((l) => (
        <Marker key={l.id} position={[l.lat, l.lng]} icon={iconoLugar(l)}><Popup>{l.nombre}</Popup></Marker>
      ))}
      {vehiculos.map((v) => (
        <Marker key={v.id} position={[v.lat, v.lng]} icon={iconoVehiculo(v)} zIndexOffset={v.enViaje ? 1000 : 500}>
          <Popup><strong>{v.nombre}</strong><br />{v.detalle}</Popup>
        </Marker>
      ))}
      <Encuadre puntos={[...vehiculos.filter((v) => Math.abs(v.lat + 34.5) < 1).map((v) => [v.lat, v.lng] as [number, number]), ...lugares.map((l) => [l.lat, l.lng] as [number, number])]} />
    </MapContainer>
  );
}
