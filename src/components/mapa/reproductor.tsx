"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Opciones } from "@/components/ui/opciones";
import { Vacio } from "@/components/ui/basicos";
import { hora } from "@/lib/formato";
import { distancia } from "@/lib/geo";
import type { ParadaNumerada, PuntoRastro } from "@/lib/mapa/consultas";

const MapaReproduccion = dynamic(() => import("./mapa-reproduccion"), { ssr: false, loading: () => <div className="grid h-full place-items-center bg-[#e9e9e5] text-suave">Cargando mapa…</div> });

/** Reproduce el día: el vehículo avanza por su rastro, con velocidad elegible. */
export function Reproductor({ nombre, rastro, paradas }: { nombre: string; rastro: PuntoRastro[]; paradas: ParadaNumerada[] }) {
  const [i, setI] = useState(0);
  const [andando, setAndando] = useState(false);
  const [velocidad, setVelocidad] = useState("4");
  const km = useMemo(() => rastro.slice(1).reduce((s, p, k) => s + distancia(rastro[k], p), 0) / 1000, [rastro]);

  useEffect(() => {
    if (!andando) return;
    const t = window.setInterval(() => setI((x) => { if (x >= rastro.length - 1) { setAndando(false); return x; } return x + 1; }), 1000 / Number(velocidad));
    return () => window.clearInterval(t);
  }, [andando, velocidad, rastro.length]);

  if (rastro.length < 2) return <Vacio titulo="Sin recorrido ese día">No hay posiciones guardadas para {nombre}.</Vacio>;
  const p = rastro[i];
  return (
    <div className="flex flex-col gap-3">
      <div className="relative isolate h-[55dvh] overflow-hidden rounded-[var(--radius-caja)] border border-linea">
        <MapaReproduccion rastro={rastro} paradas={paradas} actual={i} />
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-caja)] border border-linea bg-papel p-3">
        <button onClick={() => { if (i >= rastro.length - 1) setI(0); setAndando(!andando); }} aria-label={andando ? "Pausar" : "Reproducir"} className="grid size-[52px] shrink-0 place-items-center rounded-[var(--radius-caja)] bg-negro text-white">
          {andando ? <Pause className="size-6" /> : <Play className="size-6" />}
        </button>
        <div className="min-w-[10rem] flex-1">
          <input type="range" min={0} max={rastro.length - 1} value={i} onChange={(e) => { setI(Number(e.target.value)); setAndando(false); }} className="w-full accent-negro" aria-label="Momento del día" />
          <p className="text-sm font-semibold tabular-nums">{hora(p.fecha)} · {Math.round(p.velocidad)} km/h · {hora(rastro[0].fecha)}–{hora(rastro.at(-1)!.fecha)} · {km.toFixed(1)} km</p>
        </div>
        <div className="w-full sm:w-64"><Opciones nombre="Velocidad" columnas={3} valor={velocidad} onElegir={setVelocidad} opciones={[{ valor: "4", titulo: "×1" }, { valor: "12", titulo: "×3" }, { valor: "30", titulo: "×8" }]} /></div>
      </div>
    </div>
  );
}
