"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Opciones } from "@/components/ui/opciones";
import { Vacio } from "@/components/ui/basicos";
import { hora } from "@/lib/formato";
import type { ParadaDetectada, PuntoRastro, ViajeDelDia } from "@/lib/mapa/consultas";
import { COLORES_VIAJE } from "./colores";

const MapaReproduccion = dynamic(() => import("./mapa-reproduccion"), { ssr: false, loading: () => <div className="grid h-full place-items-center bg-[#e9e9e5] text-suave">Cargando mapa…</div> });

/** Velocidad de reproducción: puntos por segundo (×1 = 2 puntos por segundo). */
const VELOCIDADES = [{ valor: "2", titulo: "×1" }, { valor: "20", titulo: "×10" }, { valor: "60", titulo: "×30" }];
const duracion = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`);

/** Reproduce el día: el vehículo avanza por su rastro; paradas numeradas y los viajes del sistema en color. */
export function Reproductor({ nombre, rastro, paradas, km, viajes }: { nombre: string; rastro: PuntoRastro[]; paradas: ParadaDetectada[]; km: number; viajes: ViajeDelDia[] }) {
  const [i, setI] = useState(0);
  const [andando, setAndando] = useState(false);
  const [velocidad, setVelocidad] = useState("20");
  const enViaje = useMemo(() => rastro.map((p) => viajes.findIndex((v) => p.fecha >= v.desde && p.fecha <= v.hasta)), [rastro, viajes]);

  useEffect(() => {
    if (!andando) return;
    const t = window.setInterval(() => setI((x) => { if (x >= rastro.length - 1) { setAndando(false); return x; } return x + 1; }), 1000 / Number(velocidad));
    return () => window.clearInterval(t);
  }, [andando, velocidad, rastro.length]);

  if (rastro.length < 2) return <Vacio titulo="Sin recorrido ese día">Cusat no tiene posiciones de {nombre} para esa fecha.</Vacio>;
  const p = rastro[i];
  const viajeAhora = enViaje[i] >= 0 ? viajes[enViaje[i]] : null;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-[var(--radius-caja)] border border-linea bg-papel p-3"><p className="text-xs font-semibold tracking-wider text-suave uppercase">Km del día</p><p className="text-2xl font-bold tabular-nums">{km.toLocaleString("es-AR")}</p></div>
        <div className="rounded-[var(--radius-caja)] border border-linea bg-papel p-3"><p className="text-xs font-semibold tracking-wider text-suave uppercase">Paradas</p><p className="text-2xl font-bold tabular-nums">{paradas.length}</p></div>
        <div className="rounded-[var(--radius-caja)] border border-linea bg-papel p-3"><p className="text-xs font-semibold tracking-wider text-suave uppercase">Horario</p><p className="text-lg font-bold tabular-nums">{hora(rastro[0].fecha)}–{hora(rastro.at(-1)!.fecha)}</p></div>
      </div>
      <div className="relative isolate h-[55dvh] overflow-hidden rounded-[var(--radius-caja)] border border-linea">
        <MapaReproduccion rastro={rastro} paradas={paradas} actual={i} enViaje={enViaje} />
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-caja)] border border-linea bg-papel p-3">
        <button onClick={() => { if (i >= rastro.length - 1) setI(0); setAndando(!andando); }} aria-label={andando ? "Pausar" : "Reproducir"} className="grid size-[52px] shrink-0 place-items-center rounded-[var(--radius-caja)] bg-negro text-white">
          {andando ? <Pause className="size-6" /> : <Play className="size-6" />}
        </button>
        <div className="min-w-[10rem] flex-1">
          <input type="range" min={0} max={rastro.length - 1} value={i} onChange={(e) => { setI(Number(e.target.value)); setAndando(false); }} className="w-full accent-negro" aria-label="Momento del día" />
          <p className="text-sm font-semibold tabular-nums">{hora(p.fecha)} · {Math.round(p.velocidad)} km/h{viajeAhora ? ` · Viaje #${viajeAhora.numero}` : ""}</p>
        </div>
        <div className="w-full sm:w-64"><Opciones nombre="Velocidad" columnas={3} valor={velocidad} onElegir={setVelocidad} opciones={VELOCIDADES} /></div>
      </div>
      {viajes.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold tracking-wider text-suave uppercase">Viajes del sistema</h2>
          <ul className="divide-y divide-linea rounded-[var(--radius-caja)] border border-linea bg-papel">
            {viajes.map((v, k) => (
              <li key={v.pedidoId} className="flex items-center gap-3 px-4 py-3">
                <span aria-hidden className="inline-block h-1.5 w-6 shrink-0 rounded-full" style={{ background: COLORES_VIAJE[k % COLORES_VIAJE.length] }} />
                <Link href={`/solicitudes/${v.pedidoId}`} className="min-w-0 flex-1 truncate font-semibold underline-offset-2 hover:underline">#{v.numero} · {v.descripcion} → Obra {v.obra}</Link>
                <span className="shrink-0 text-sm text-suave tabular-nums">{hora(v.desde)}–{hora(v.hasta)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2 className="mb-2 text-sm font-bold tracking-wider text-suave uppercase">Paradas (más de 5 minutos)</h2>
        {paradas.length === 0 ? <p className="text-suave">No paró más de 5 minutos.</p> : (
          <ol className="divide-y divide-linea rounded-[var(--radius-caja)] border border-linea bg-papel">
            {paradas.map((s) => (
              <li key={s.numero}>
                <button onClick={() => { setAndando(false); setI(Math.max(0, rastro.findIndex((x) => x.fecha >= s.llegada))); }} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-fondo">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-negro text-sm font-bold text-white">{s.numero}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{s.direccion}</span><span className="text-sm text-suave">Llegó {hora(s.llegada)} · {duracion(s.minutos)}</span></span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
