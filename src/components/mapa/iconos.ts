import L from "leaflet";
import type { TipoUbicacion } from "@prisma/client";

/** Marcadores propios (SVG en línea). Color por estado: verde en viaje, gris disponible, negro taller. */

import { COLOR_ESTADO } from "./colores";

const FIGURA = {
  CAMION: '<path d="M2 6h12v9H2z"/><path d="M14 9h4.5l3.5 3.5V15h-8z"/><circle cx="6.5" cy="17" r="2"/><circle cx="17.5" cy="17" r="2"/>',
  CAMIONETA: '<path d="M2 11.5 4.5 7H11l3 4.5h7.5V15H2z"/><circle cx="6.5" cy="17" r="2"/><circle cx="17.5" cy="17" r="2"/>',
  AUTO: '<path d="M3 12.5 5.5 8h13l2.5 4.5V15H3z"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/>',
  MAQUINA: '<path d="M3 9h10v6H3z"/><path d="M13 11h6l2 4h-8z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
} as const;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function iconoVehiculo(v: { nombre: string; tipo: keyof typeof FIGURA; estado: keyof typeof COLOR_ESTADO; rumbo: number; velocidad: number }, elegido: boolean) {
  const color = COLOR_ESTADO[v.estado];
  const flecha = v.velocidad > 0 ? `<div style="position:absolute;top:-9px;left:50%;transform:translateX(-50%) rotate(${v.rumbo}deg);transform-origin:50% 27px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:8px solid ${color}"></div>` : "";
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<div style="transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px">
      <div style="position:relative;width:38px;height:38px;border-radius:10px;background:${color};border:${elegido ? "3px solid #B7791F" : "2px solid #fff"};box-shadow:0 0 0 1px ${color};display:grid;place-items:center">${flecha}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff" stroke="none">${FIGURA[v.tipo]}</svg>
      </div>
      <span style="font:700 12px/1.1 var(--font-inter),system-ui;background:#fff;color:#000;border:1px solid #000;border-radius:4px;padding:1px 4px;white-space:nowrap">${esc(v.nombre)}</span>
    </div>`,
  });
}

export function iconoObra(nombre: string) {
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<div style="transform:translate(-14px,-14px);display:flex;align-items:center;gap:4px">
      <svg width="28" height="28" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" fill="#fff" stroke="#000" stroke-width="2"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" stroke="#000" stroke-width="2"/><path d="M10 21v-3h4v3" stroke="#000" stroke-width="2" fill="none"/></svg>
      <span style="font:600 12px/1 var(--font-inter),system-ui;background:rgba(255,255,255,.92);padding:2px 4px;border-radius:4px;white-space:nowrap">${esc(nombre)}</span></div>`,
  });
}

export function iconoLugar(nombre: string, tipo: TipoUbicacion) {
  const figura = tipo === "DESCARGA" || tipo === "VARIOS"
    ? '<circle cx="12" cy="12" r="8" fill="#000"/><circle cx="12" cy="12" r="3" fill="#fff"/>'
    : tipo === "DEPOSITO"
    ? '<path d="M3 10 12 4l9 6v11H3z" fill="#000"/><path d="M7 21v-7h10v7M7 17h10" stroke="#fff" stroke-width="1.6" fill="none"/>'
    : '<rect x="3" y="7" width="18" height="14" fill="#000"/><path d="M3 7 12 3l9 4" fill="#000"/><path d="M7 21v-8h10v8" stroke="#fff" stroke-width="1.6" fill="none"/><path d="M7 16h10" stroke="#fff" stroke-width="1.6"/>';
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<div style="transform:translate(-15px,-15px);display:flex;align-items:center;gap:4px">
      <svg width="30" height="30" viewBox="0 0 24 24">${figura}</svg>
      <span style="font:700 12px/1 var(--font-inter),system-ui;background:#000;color:#fff;padding:3px 5px;border-radius:4px;white-space:nowrap">${esc(nombre)}</span></div>`,
  });
}

export function iconoParada(numero: number) {
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<div style="transform:translate(-50%,-50%);width:26px;height:26px;border-radius:50%;background:#000;color:#fff;border:2px solid #fff;display:grid;place-items:center;font:800 13px/1 var(--font-inter),system-ui">${numero}</div>`,
  });
}
