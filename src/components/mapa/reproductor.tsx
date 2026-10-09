"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { Opciones } from "@/components/ui/opciones";
import { Vacio } from "@/components/ui/basicos";
import { claseBoton } from "@/components/ui/boton";
import { ColumnaMapa } from "@/components/ui/columna-mapa";
import { hora } from "@/lib/formato";
import type { ParadaDetectada, PuntoRastro, ViajeDelDia } from "@/lib/mapa/consultas";
import { COLORES_VIAJE } from "./colores";

const MapaReproduccion = dynamic(() => import("./mapa-reproduccion"), { ssr: false, loading: () => <SinMapa texto="Cargando mapa…" /> });

/** Velocidad de reproducción: puntos por segundo (×1 = 2 puntos por segundo). */
const VELOCIDADES = [{ valor: "2", titulo: "×1" }, { valor: "20", titulo: "×10" }, { valor: "60", titulo: "×30" }];
const duracion = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`);

/** Reproduce el día: el vehículo avanza por su rastro; paradas numeradas y los viajes del sistema en color. */
export function Reproductor({ nombre, rastro, paradas, km, viajes, cabecera }: { nombre: string; rastro: PuntoRastro[]; paradas: ParadaDetectada[]; km: number; viajes: ViajeDelDia[]; cabecera: ReactNode }) {
  const [i, setI] = useState(0);
  const [andando, setAndando] = useState(false);
  const [velocidad, setVelocidad] = useState("20");
  const enViaje = useMemo(() => rastro.map((p) => viajes.findIndex((v) => p.fecha >= v.desde && p.fecha <= v.hasta)), [rastro, viajes]);

  useEffect(() => {
    if (!andando) return;
    const t = window.setInterval(() => setI((x) => { if (x >= rastro.length - 1) { setAndando(false); return x; } return x + 1; }), 1000 / Number(velocidad));
    return () => window.clearInterval(t);
  }, [andando, velocidad, rastro.length]);

  if (rastro.length < 2) return <ColumnaMapa arriba={<>{cabecera}<Vacio titulo="Sin recorrido ese día">Cusat no tiene posiciones de {nombre} para esa fecha.</Vacio></>} mapa={<SinMapa />} />;
  const p = rastro[i];
  const viajeAhora = enViaje[i] >= 0 ? viajes[enViaje[i]] : null;
  const arriba = (
    <>
      {cabecera}
      <dl className="grid grid-cols-3 divide-x divide-linea rounded-[var(--radius-caja)] border border-linea bg-papel">
        <div className="p-3"><dt className="etiqueta">Km del día</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{km.toLocaleString("es-AR")}</dd></div>
        <div className="p-3"><dt className="etiqueta">Paradas</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{paradas.length}</dd></div>
        <div className="p-3"><dt className="etiqueta">Horario</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{hora(rastro[0].fecha)}–{hora(rastro.at(-1)!.fecha)}</dd></div>
      </dl>
    </>
  );
  const abajo = (
    <>
      <div className="flex flex-col gap-3 rounded-[var(--radius-caja)] border border-linea bg-papel p-3">
        <div className="flex items-center gap-3">
          <button onClick={() => { if (i >= rastro.length - 1) setI(0); setAndando(!andando); }} aria-label={andando ? "Pausar" : "Reproducir"} className={claseBoton("primario", "normal", false, "w-12 shrink-0 px-0 lg:w-9")}>
            {andando ? <Pause /> : <Play />}
          </button>
          <div className="min-w-0 flex-1">
            <input type="range" min={0} max={rastro.length - 1} value={i} onChange={(e) => { setI(Number(e.target.value)); setAndando(false); }} className="w-full accent-[#111827]" aria-label="Momento del día" />
            <p className="text-sm tabular-nums">{hora(p.fecha)} · {Math.round(p.velocidad)} km/h{viajeAhora ? ` · Viaje #${viajeAhora.numero}` : ""}</p>
          </div>
        </div>
        <Opciones nombre="Velocidad" columnas={3} valor={velocidad} onElegir={setVelocidad} opciones={VELOCIDADES} />
      </div>
      {viajes.length > 0 && (
        <section>
          <h2 className="mb-2 etiqueta">Viajes del sistema</h2>
          <ul className="divide-y divide-linea rounded-[var(--radius-caja)] border border-linea bg-papel">
            {viajes.map((v, k) => (
              <li key={v.pedidoId} className="flex min-h-11 items-center gap-3 px-3 py-2">
                <span aria-hidden className="inline-block h-1 w-5 shrink-0 rounded-full" style={{ background: COLORES_VIAJE[k % COLORES_VIAJE.length] }} />
                <Link href={`/solicitudes/${v.pedidoId}`} className="min-w-0 flex-1 truncate text-sm font-medium underline-offset-2 hover:underline">#{v.numero} · {v.descripcion} → Obra {v.obra}</Link>
                <span className="shrink-0 text-[12px] text-suave tabular-nums">{hora(v.desde)}–{hora(v.hasta)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2 className="mb-2 etiqueta">Paradas (más de 5 minutos)</h2>
        {paradas.length === 0 ? <p className="text-sm text-suave">No paró más de 5 minutos.</p> : (
          <ol className="divide-y divide-linea rounded-[var(--radius-caja)] border border-linea bg-papel">
            {paradas.map((s) => (
              <li key={s.numero}>
                <button onClick={() => { setAndando(false); setI(Math.max(0, rastro.findIndex((x) => x.fecha >= s.llegada))); }} className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left hover:bg-hover">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-black/[0.06] text-[12px] font-medium tabular-nums">{s.numero}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{s.direccion}</span><span className="text-[12px] text-suave">Llegó {hora(s.llegada)} · {duracion(s.minutos)}</span></span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
  return <ColumnaMapa arriba={arriba} abajo={abajo} altoCelular="h-[55dvh]" mapa={<MapaReproduccion rastro={rastro} paradas={paradas} actual={i} enViaje={enViaje} />} />;
}

/** Lugar del mapa cuando todavía no hay nada que mostrar. */
export function SinMapa({ texto = "Elegí un vehículo y un día." }: { texto?: string }) {
  return <div className="grid h-full place-items-center bg-fondo text-sm text-suave">{texto}</div>;
}
