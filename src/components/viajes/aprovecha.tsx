"use client";

import { Check } from "lucide-react";
import type { SugerenciaPlana } from "@/lib/viajes/combinar";
import { peso } from "@/lib/formato";
import { fechaViaje } from "@/lib/viajes/fecha";

/**
 * "Aprovechá el viaje": dos grupos con casilla. MISMO LUGAR ("En Corralón San Martín también hay para
 * retirar: …") y CERCA DE TU CAMINO ("A 1,2 km del corralón: …"). Cada uno con fecha, peso y para quién.
 * Los de otro día (o personas con escombros) aparecen en gris con el motivo.
 */
export function ListaSugerencias({ sugerencias, elegidos, onCambiar }: { sugerencias: SugerenciaPlana[]; elegidos: string[]; onCambiar: (ids: string[]) => void }) {
  const mismo = sugerencias.filter((s) => s.grupo === "mismoLugar");
  const cerca = sugerencias.filter((s) => s.grupo === "cerca");
  const lugares = [...new Set(mismo.map((s) => s.lugar))];
  const alternar = (id: string) => onCambiar(elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id]);
  const fila = (s: SugerenciaPlana) => {
    const elegido = elegidos.includes(s.id);
    const f = fechaViaje(new Date(s.pedido.paraCuando), "HORA_EXACTA");
    return (
      <li key={s.id}>
        <button
          type="button"
          role="checkbox"
          aria-checked={elegido}
          disabled={!!s.gris}
          onClick={() => alternar(s.id)}
          className={`flex min-h-16 w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left ${elegido ? "border-tinta bg-hover shadow-[inset_0_0_0_1px_var(--color-tinta)]" : "border-linea bg-papel hover:border-linea-fuerte"} disabled:cursor-not-allowed disabled:bg-fondo disabled:text-suave`}
        >
          <span aria-hidden className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border ${elegido ? "border-tinta bg-tinta text-white" : "border-linea-fuerte bg-papel"}`}>
            {elegido && <Check className="size-3.5" strokeWidth={3} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block leading-snug font-medium">{s.texto}</span>
            <span suppressHydrationWarning className={`mt-0.5 block text-sm ${s.gris ? "text-critico" : "text-suave"}`}>
              {s.gris ?? [f.texto.toLowerCase().replace(" · ", " "), s.pedido.pesoKg ? peso(s.pedido.pesoKg) : null, `para ${s.pedido.solicitante}`, s.pedido.propio ? "ya es tuyo" : null].filter(Boolean).join(" · ")}
            </span>
          </span>
        </button>
      </li>
    );
  };
  return (
    <div className="flex flex-col gap-4">
      {lugares.map((l) => (
        <section key={l}>
          <p className="mb-2 text-[15px] font-semibold">En {l} también hay para retirar:</p>
          <ul className="flex flex-col gap-2">{mismo.filter((s) => s.lugar === l).map(fila)}</ul>
        </section>
      ))}
      {cerca.length > 0 && (
        <section>
          <p className="mb-2 text-[15px] font-semibold">Cerca de tu camino</p>
          <ul className="flex flex-col gap-2">{cerca.map(fila)}</ul>
        </section>
      )}
    </div>
  );
}
