"use client";

import dynamic from "next/dynamic";
import { Radio } from "lucide-react";
import { Insignia } from "@/components/ui/basicos";
import type { MarcadorLugar, MarcadorVehiculo } from "@/lib/mapa/consultas";

const MapaLeaflet = dynamic(() => import("./mapa-leaflet"), {
  ssr: false,
  loading: () => <div className="grid h-full w-full place-items-center bg-[#e9e9e5] text-suave">Cargando mapa…</div>,
});

/** Mapa con la última posición de cada vehículo (Cusat; por ahora simulada). */
export function Mapa({ vehiculos, lugares, alto = "h-[50dvh]" }: { vehiculos: MarcadorVehiculo[]; lugares: MarcadorLugar[]; alto?: string }) {
  const orden = [...vehiculos].sort((a, b) => Number(b.enViaje) - Number(a.enViaje));
  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <div className={`relative isolate overflow-hidden rounded-[var(--radius-caja)] border border-linea lg:flex-1 ${alto}`}>
        <MapaLeaflet vehiculos={vehiculos} lugares={lugares} />
        <span className="pointer-events-none absolute top-3 left-3 z-[500] flex items-center gap-1.5 rounded-md bg-negro px-2.5 py-1.5 text-xs font-semibold text-white">
          <Radio className="size-3.5" /> Posiciones simuladas (Cusat sin conectar)
        </span>
      </div>
      <ul className="flex gap-2 overflow-x-auto pb-1 lg:w-72 lg:flex-col lg:overflow-visible">
        {orden.map((v) => (
          <li key={v.id} className="w-56 shrink-0 rounded-[var(--radius-caja)] border border-linea bg-papel px-3 py-2 lg:w-auto">
            <p className="flex items-center justify-between gap-2 font-bold">{v.nombre}{v.enViaje && <Insignia tono="activo">En viaje</Insignia>}</p>
            <p className="line-clamp-1 text-sm text-suave">{v.detalle}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
