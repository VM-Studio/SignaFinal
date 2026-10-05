"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, History, Radio, Route, X } from "lucide-react";
import { Insignia } from "@/components/ui/basicos";
import { Boton } from "@/components/ui/boton";
import { cuando, diaISO, hace, hora } from "@/lib/formato";
import type { DatosMapa, ParadaNumerada, PuntoRastro, VehiculoMapa } from "@/lib/mapa/consultas";
import { COLOR_ESTADO } from "./colores";

const MapaLeaflet = dynamic(() => import("./mapa-leaflet"), { ssr: false, loading: () => <div className="grid h-full w-full place-items-center bg-[#e9e9e5] text-suave">Cargando mapa…</div> });

const CADA_MS = 30_000;
const ESTADO = { EN_VIAJE: { t: "En viaje", tono: "ok" }, DISPONIBLE: { t: "Disponible", tono: "neutro" }, EN_TALLER: { t: "En el taller", tono: "activo" }, FUERA_DE_SERVICIO: { t: "Fuera de servicio", tono: "activo" } } as const;
type Recorrido = { paradas: ParadaNumerada[]; rastro: PuntoRastro[] };

function Punto({ estado }: { estado: VehiculoMapa["estado"] }) {
  return <span aria-hidden className="inline-block size-3 shrink-0 rounded-full" style={{ background: COLOR_ESTADO[estado] }} />;
}

function Lista({ datos, onElegir }: { datos: DatosMapa; onElegir: (id: string) => void }) {
  const orden = [...datos.vehiculos].sort((a, b) => Number(b.estado === "EN_VIAJE") - Number(a.estado === "EN_VIAJE") || a.nombre.localeCompare(b.nombre));
  return (
    <ul className="divide-y divide-linea">
      {orden.map((v) => (
        <li key={v.id}>
          <button onClick={() => onElegir(v.id)} className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left hover:bg-fondo">
            <Punto estado={v.estado} />
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{v.nombre}</span>
              <span className="block truncate text-sm text-suave">{v.viaje ? `${v.chofer} → Obra ${v.viaje.obra}` : v.chofer ?? ESTADO[v.estado].t}</span>
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">{v.velocidad > 0 ? `${v.velocidad} km/h` : "Quieto"}</span>
          </button>
        </li>
      ))}
      {datos.sinGps.length > 0 && <li className="px-4 py-3 text-sm text-suave">Sin GPS: {datos.sinGps.join(", ")}</li>}
    </ul>
  );
}

function Tarjeta({ v, recorrido, cargando, onRecorrido, onCerrar }: { v: VehiculoMapa; recorrido: Recorrido | null; cargando: boolean; onRecorrido: () => void; onCerrar: () => void }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xl font-bold">{v.nombre}</p>
          <p className="text-sm text-suave">{v.patente}</p>
        </div>
        <button onClick={onCerrar} aria-label="Cerrar" className="grid size-11 place-items-center rounded-md hover:bg-black/5"><X className="size-5" /></button>
      </div>
      <Insignia tono={ESTADO[v.estado].tono} className="w-fit">{ESTADO[v.estado].t}</Insignia>
      <dl className="grid grid-cols-2 gap-3 text-[15px]">
        <div><dt className="text-xs font-semibold tracking-wider text-suave uppercase">Chofer</dt><dd className="font-medium">{v.chofer ?? "—"}</dd></div>
        <div><dt className="text-xs font-semibold tracking-wider text-suave uppercase">Velocidad</dt><dd className="font-medium tabular-nums">{v.velocidad} km/h</dd></div>
        <div className="col-span-2"><dt className="text-xs font-semibold tracking-wider text-suave uppercase">Viaje actual</dt><dd className="font-medium">{v.viaje ? <Link href={`/solicitudes/${v.viaje.pedidoId}`} className="underline">{v.viaje.descripcion}</Link> : "Sin viaje"}</dd></div>
        {v.viaje && <div className="col-span-2"><dt className="text-xs font-semibold tracking-wider text-suave uppercase">Obra destino</dt><dd className="font-medium">Obra {v.viaje.obra}{v.viaje.llegoPorGps ? " · ya llegó (GPS)" : ""}</dd></div>}
        <div className="col-span-2"><dt className="text-xs font-semibold tracking-wider text-suave uppercase">Última actualización</dt><dd className="font-medium">{hora(v.fecha)} · {hace(v.fecha)}</dd></div>
      </dl>
      <Boton ancho variante={recorrido ? "secundario" : "primario"} cargando={cargando} icono={<Route className="size-5" />} onClick={onRecorrido}>
        {recorrido ? "Ocultar recorrido" : "Ver recorrido de hoy"}
      </Boton>
      {recorrido && (
        <div className="rounded-[var(--radius-caja)] bg-fondo p-3 text-sm">
          <p className="mb-1 flex items-center gap-3 font-semibold">
            <span className="inline-block h-0 w-6 border-t-[3px] border-dashed border-black" /> Planificado
            <span className="inline-block h-0 w-6 border-t-[4px] border-ok" /> Real ({recorrido.rastro.length} puntos)
          </p>
          {recorrido.paradas.length === 0 ? <p className="text-suave">Sin viajes hoy.</p> : (
            <ol className="mt-1 flex flex-col gap-1">
              {recorrido.paradas.map((p) => <li key={p.numero}><span className="font-bold">{p.numero}.</span> {p.nombre}</li>)}
            </ol>
          )}
          <Link href={`/mapa/historial?vehiculo=${v.id}&dia=${diaISO()}`} className="mt-2 inline-flex min-h-11 items-center gap-1 font-semibold underline"><History className="size-4" /> Reproducir el día</Link>
        </div>
      )}
    </div>
  );
}

/** Mapa en vivo: se actualiza cada 30 segundos sin recargar. En celular, pantalla completa con hoja inferior. */
export function MapaEnVivo({ inicial, elegidoInicial, compacto = false }: { inicial: DatosMapa; elegidoInicial?: string; compacto?: boolean }) {
  const [datos, setDatos] = useState(inicial);
  const [elegido, setElegido] = useState<string | undefined>(elegidoInicial);
  const [recorrido, setRecorrido] = useState<Recorrido | null>(null);
  const [cargando, setCargando] = useState(false);
  const [alto, setAlto] = useState(120); // hoja inferior del celular (px)
  const arrastre = useRef<{ y: number; alto: number } | null>(null);

  useEffect(() => {
    let vivo = true;
    const t = window.setInterval(async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/mapa", { cache: "no-store" });
        if (r.ok && vivo) setDatos(await r.json());
      } catch {}
    }, CADA_MS);
    return () => { vivo = false; window.clearInterval(t); };
  }, []);

  const elegir = useCallback((id: string) => { setElegido(id); setRecorrido(null); setAlto((a) => Math.max(a, Math.round(window.innerHeight * 0.45))); }, []);
  const v = datos.vehiculos.find((x) => x.id === elegido);

  async function alternarRecorrido() {
    if (recorrido) return setRecorrido(null);
    if (!v) return;
    setCargando(true);
    try {
      const r = await fetch(`/api/mapa/recorrido?vehiculo=${v.id}&dia=${diaISO()}`, { cache: "no-store" });
      if (r.ok) setRecorrido(await r.json());
    } finally {
      setCargando(false);
    }
  }

  const panel = v ? <Tarjeta v={v} recorrido={recorrido} cargando={cargando} onRecorrido={alternarRecorrido} onCerrar={() => { setElegido(undefined); setRecorrido(null); }} /> : <Lista datos={datos} onElegir={elegir} />;
  const insignia = (
    <span className="pointer-events-none absolute top-3 left-3 z-[500] flex items-center gap-1.5 rounded-md bg-negro px-2.5 py-1.5 text-xs font-semibold text-white">
      <Radio className="size-3.5" /> {datos.origen === "mock" ? "Simulado · Cusat sin conectar" : "Cusat en vivo"} · {hora(datos.actualizado)}
    </span>
  );

  if (compacto) {
    return (
      <div className="relative isolate h-[46dvh] overflow-hidden rounded-[var(--radius-caja)] border border-linea lg:h-[56dvh]">
        <MapaLeaflet datos={datos} elegido={elegido} onElegir={elegir} />
        {insignia}
        <Link href="/mapa" className="absolute right-3 bottom-3 z-[500] rounded-md bg-negro px-3 py-2 text-sm font-semibold text-white">Abrir mapa</Link>
      </div>
    );
  }

  return (
    <>
      {/* Escritorio */}
      <div className="hidden h-[calc(100dvh-8rem)] gap-4 lg:flex">
        <div className="relative isolate flex-1 overflow-hidden rounded-[var(--radius-caja)] border border-linea">
          <MapaLeaflet datos={datos} elegido={elegido} onElegir={elegir} recorrido={recorrido} />
          {insignia}
        </div>
        <aside className="w-[340px] shrink-0 overflow-y-auto rounded-[var(--radius-caja)] border border-linea bg-papel">{panel}</aside>
      </div>

      {/* Celular: pantalla completa y hoja inferior deslizable */}
      <div className="fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 lg:hidden">
        <div className="absolute inset-0 isolate">
          <MapaLeaflet datos={datos} elegido={elegido} onElegir={elegir} recorrido={recorrido} />
          {insignia}
        </div>
        <div className="absolute inset-x-0 bottom-0 z-[600] flex flex-col rounded-t-2xl border-t border-linea bg-papel" style={{ height: alto }}>
          <div
            role="separator"
            aria-label="Deslizar para ver más"
            className="flex h-8 shrink-0 cursor-grab touch-none items-center justify-center"
            onPointerDown={(e) => { arrastre.current = { y: e.clientY, alto }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => { if (arrastre.current) setAlto(Math.min(window.innerHeight * 0.8, Math.max(72, arrastre.current.alto + arrastre.current.y - e.clientY))); }}
            onPointerUp={() => {
              arrastre.current = null;
              const h = window.innerHeight;
              const puntos = [96, Math.round(h * 0.45), Math.round(h * 0.75)];
              setAlto((a) => puntos.reduce((m, p) => (Math.abs(p - a) < Math.abs(m - a) ? p : m), puntos[0]));
            }}
            onClick={() => setAlto((a) => (a < 200 ? Math.round(window.innerHeight * 0.45) : 96))}
          >
            <span className="h-1.5 w-10 rounded-full bg-black/25" />
          </div>
          {!v && <p className="shrink-0 px-4 pb-1 text-sm font-semibold text-suave">{datos.vehiculos.filter((x) => x.estado === "EN_VIAJE").length} en viaje · {datos.vehiculos.length} con GPS · {cuando(datos.actualizado)}</p>}
          <div className="flex-1 overflow-y-auto">{panel}</div>
        </div>
      </div>
    </>
  );
}

export function VolverAlMapa() {
  return <Link href="/mapa" className="inline-flex min-h-11 items-center gap-1 font-semibold text-suave"><ArrowLeft className="size-5" /> Mapa</Link>;
}
