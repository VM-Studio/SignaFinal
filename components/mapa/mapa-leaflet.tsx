"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { useEffect, useMemo } from "react";
import type { DatosMapa, VehiculoEnMapa, PuntoEnMapa } from "@/lib/datos/mapa";

const TIPO_CORTO = { CAMION: "C", CAMIONETA: "P", AUTO: "A" } as const;

function iconoVehiculo(v: VehiculoEnMapa, elegido: boolean) {
  const fondo = v.enViaje ? "#0a0a0a" : v.velocidadKmh > 0 ? "#3a3a3a" : "#ffffff";
  const texto = v.enViaje || v.velocidadKmh > 0 ? "#ffffff" : "#0a0a0a";
  const borde = elegido ? "#b7791f" : "#0a0a0a";
  return L.divIcon({
    className: "marcador",
    iconSize: [0, 0],
    html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center">
      <div style="display:flex;align-items:center;gap:6px;background:${fondo};color:${texto};border:2px solid ${borde};border-radius:8px;padding:4px 8px;font:600 13px/1.1 var(--font-archivo),system-ui;white-space:nowrap">
        <span style="display:inline-grid;place-items:center;width:18px;height:18px;border-radius:4px;background:${texto};color:${fondo};font-size:11px;font-weight:800">${TIPO_CORTO[v.tipo]}</span>
        ${v.nombre}
      </div>
      <div style="width:2px;height:8px;background:${borde}"></div>
      <div style="width:8px;height:8px;border-radius:50%;background:${borde};margin-top:-2px"></div>
    </div>`,
  });
}

function iconoPunto(p: PuntoEnMapa) {
  const esObra = p.tipo === "obra";
  const forma = esObra
    ? `<div style="width:14px;height:14px;background:#fff;border:3px solid #0a0a0a;transform:rotate(45deg)"></div>`
    : `<div style="width:16px;height:16px;background:#0a0a0a;border:3px solid #fff;outline:2px solid #0a0a0a;border-radius:3px"></div>`;
  return L.divIcon({
    className: "marcador",
    iconSize: [0, 0],
    html: `<div style="transform:translate(-50%,-50%);display:flex;align-items:center;gap:6px">${forma}<span style="font:600 12px/1 var(--font-archivo),system-ui;color:#0a0a0a;background:rgba(255,255,255,.9);padding:2px 4px;border-radius:4px;white-space:nowrap">${p.nombre}</span></div>`,
  });
}

function Encuadre({ datos, elegido }: { datos: DatosMapa; elegido?: string }) {
  const mapa = useMap();
  useEffect(() => {
    const v = datos.vehiculos.find((x) => x.id === elegido);
    if (v) mapa.setView([v.lat, v.lng], Math.max(mapa.getZoom(), 14));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elegido]);
  useEffect(() => {
    const puntos = [...datos.vehiculos.map((v) => [v.lat, v.lng]), ...datos.puntos.map((p) => [p.lat, p.lng])] as [number, number][];
    if (puntos.length) mapa.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 13 });
    // Solo al cargar: después la persona maneja el mapa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function MapaLeaflet({ datos, elegido, onElegir }: { datos: DatosMapa; elegido?: string; onElegir?: (id: string) => void }) {
  const centro = useMemo<[number, number]>(() => [-34.5, -58.52], []);
  return (
    <MapContainer center={centro} zoom={12} className="h-full w-full" zoomControl={false} attributionControl>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />
      {datos.puntos.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={iconoPunto(p)}>
          <Popup>
            <strong>{p.nombre}</strong>
            <br />
            {p.detalle}
          </Popup>
        </Marker>
      ))}
      {datos.vehiculos.map((v) => (
        <Marker
          key={v.id}
          position={[v.lat, v.lng]}
          icon={iconoVehiculo(v, v.id === elegido)}
          zIndexOffset={v.enViaje ? 1000 : 500}
          eventHandlers={{ click: () => onElegir?.(v.id) }}
        >
          <Popup>
            <strong>{v.nombre}</strong>
            <br />
            {v.estado}
          </Popup>
        </Marker>
      ))}
      <Encuadre datos={datos} elegido={elegido} />
    </MapContainer>
  );
}
