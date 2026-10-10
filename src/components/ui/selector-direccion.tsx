"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";
import { Check, Loader2, MapPin } from "lucide-react";
import { claseCampo } from "./campos";

const MapaPin = dynamic(() => import("@/components/mapa/mapa-pin"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-fondo text-sm text-suave">Cargando mapa…</div>,
});

export type ValorDireccion = { direccion: string; localidad: string; lat: number | null; lng: number | null };

type Candidato = { direccion: string; lat: number; lng: number; localidad: string | null };

/**
 * Dirección con sugerencias mientras se escribe (Nominatim, 600 ms después de dejar de tipear), un mapa
 * chico con el pin para confirmarla y arrastrarlo si quedó corrido, y lat/lng en campos ocultos.
 * Si el buscador no responde, se toca el mapa para poner el pin a mano. Se usa en TODAS las altas de
 * lugares (obras, sedes, sucursales, depósitos).
 */
export function SelectorDireccion({ valor, onCambio, nombre = "direccion", etiqueta = "Dirección", obligatoria = true }: {
  valor: ValorDireccion; onCambio: (v: ValorDireccion) => void; nombre?: string; etiqueta?: string; obligatoria?: boolean;
}) {
  const id = useId();
  const [texto, setTexto] = useState(valor.direccion);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [sinRespuesta, setSinRespuesta] = useState(false);
  const elegido = useRef(valor.lat != null ? valor.direccion : "");

  useEffect(() => {
    const q = texto.trim();
    if (q.length < 5 || q === elegido.current) return;
    const t = window.setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await fetch(`/api/geo/buscar?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const d = r.ok ? ((await r.json()) as { candidatos: Candidato[] }) : { candidatos: [] };
        setCandidatos(d.candidatos);
        setSinRespuesta(!d.candidatos.length);
        setAbierto(true);
      } catch {
        setCandidatos([]);
        setSinRespuesta(true);
      } finally {
        setBuscando(false);
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [texto]);

  function elegir(c: Candidato) {
    elegido.current = c.direccion;
    setTexto(c.direccion);
    setAbierto(false);
    setSinRespuesta(false);
    onCambio({ direccion: c.direccion, localidad: c.localidad ?? valor.localidad, lat: c.lat, lng: c.lng });
  }

  const punto = valor.lat != null && valor.lng != null ? { lat: valor.lat, lng: valor.lng } : null;
  return (
    <div className="flex flex-col gap-2">
      <div className="relative flex flex-col gap-1">
        <label htmlFor={id} className="text-[12px] leading-4 font-medium text-suave">{etiqueta}{obligatoria ? "" : " (opcional)"}</label>
        <div className="relative">
          <MapPin aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-suave" />
          <input
            id={id}
            value={texto}
            autoComplete="off"
            role="combobox"
            aria-expanded={abierto}
            aria-controls={`${id}-lista`}
            placeholder="Calle y número, localidad"
            className={`${claseCampo} pr-9 pl-9`}
            onChange={(e) => {
              setTexto(e.target.value);
              onCambio({ ...valor, direccion: e.target.value });
            }}
            onFocus={() => candidatos.length && setAbierto(true)}
            onBlur={() => window.setTimeout(() => setAbierto(false), 150)}
          />
          {buscando ? (
            <Loader2 aria-hidden className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-suave" />
          ) : punto ? (
            <Check aria-label="Ubicada en el mapa" className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ok" />
          ) : null}
        </div>
        {abierto && candidatos.length > 0 && (
          <ul id={`${id}-lista`} role="listbox" className="absolute top-full right-0 left-0 z-[700] mt-1 max-h-64 overflow-y-auto rounded-md border border-linea bg-papel py-1 shadow-[var(--shadow-flotante)]">
            {candidatos.map((c) => (
              <li key={`${c.lat},${c.lng}`}>
                <button type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(c)} className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-hover">
                  <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-suave" />
                  {c.direccion}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {sinRespuesta && !punto && (
        <p className="text-[12px] text-aviso-texto">No encontramos esa dirección. Tocá el mapa donde queda para poner el pin a mano.</p>
      )}
      <div className="relative isolate h-[200px] overflow-hidden rounded-md border border-linea">
        <MapaPin punto={punto} onMover={(p) => onCambio({ ...valor, direccion: texto, lat: p.lat, lng: p.lng })} />
      </div>
      <p className="text-[12px] text-suave">{punto ? "Si el pin quedó corrido, arrastralo a la puerta." : "Elegí una sugerencia o tocá el mapa."}</p>
      <input type="hidden" name={`${nombre}Lat`} value={valor.lat ?? ""} />
      <input type="hidden" name={`${nombre}Lng`} value={valor.lng ?? ""} />
    </div>
  );
}
