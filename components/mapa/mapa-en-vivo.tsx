"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { Estado } from "@/components/ui/estado";
import { hora } from "@/lib/formato";
import type { DatosMapa } from "@/lib/datos/mapa";

const MapaLeaflet = dynamic(() => import("./mapa-leaflet"), {
  ssr: false,
  loading: () => <div className="grid h-full w-full place-items-center bg-[#e8e8e4] text-suave">Cargando mapa…</div>,
});

const CADA_MS = 15_000;

/** Mapa con las posiciones de Cusat, actualizado cada 15 segundos. */
export function MapaEnVivo({ inicial, alto = "h-[60dvh]" }: { inicial: DatosMapa; alto?: string }) {
  const [datos, setDatos] = useState(inicial);
  const [elegido, setElegido] = useState<string>();

  useEffect(() => {
    let vivo = true;
    const traer = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/posiciones", { cache: "no-store" });
        if (r.ok && vivo) setDatos(await r.json());
      } catch {}
    };
    const t = window.setInterval(traer, CADA_MS);
    return () => {
      vivo = false;
      window.clearInterval(t);
    };
  }, []);

  const ordenados = [...datos.vehiculos].sort((a, b) => Number(b.enViaje) - Number(a.enViaje) || a.nombre.localeCompare(b.nombre));

  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <div className={`relative isolate overflow-hidden rounded-[var(--radius-caja)] border border-linea lg:flex-1 ${alto}`}>
        <MapaLeaflet datos={datos} elegido={elegido} onElegir={setElegido} />
        <div className="pointer-events-none absolute top-3 left-3 z-[500] flex items-center gap-1.5 rounded-md bg-negro px-2.5 py-1.5 text-xs font-semibold text-white">
          <Radio className="size-3.5" />
          {datos.origen === "mock" ? "Simulado (Cusat sin conectar)" : "Cusat en vivo"} · {hora(datos.actualizado)}
        </div>
      </div>
      <ul className="flex gap-2 overflow-x-auto pb-1 lg:w-80 lg:flex-col lg:overflow-visible">
        {ordenados.map((v) => (
          <li key={v.id} className="shrink-0 lg:shrink">
            <button
              onClick={() => setElegido(v.id)}
              className={`flex min-h-[60px] w-56 flex-col items-start gap-1 rounded-[var(--radius-caja)] border-2 px-3 py-2 text-left lg:w-full ${elegido === v.id ? "border-negro bg-papel" : "border-linea bg-papel"}`}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="font-bold">{v.nombre}</span>
                {v.enViaje ? <Estado tono="activo">En viaje</Estado> : v.velocidadKmh > 0 ? <Estado tono="neutro">Andando</Estado> : <Estado tono="neutro">Quieto</Estado>}
              </span>
              <span className="line-clamp-1 text-sm text-suave">{v.estado}</span>
            </button>
          </li>
        ))}
        {datos.sinGps.length > 0 && (
          <li className="shrink-0 self-center px-2 text-sm text-suave lg:shrink">Sin GPS: {datos.sinGps.join(", ")}</li>
        )}
      </ul>
    </div>
  );
}
