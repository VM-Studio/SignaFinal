"use client";

import type { SugerenciaPlana } from "@/lib/viajes/combinar";
import { peso } from "@/lib/formato";

/**
 * "¿LLEVÁS ALGO MÁS?": una tarjeta grande por pedido, agrupadas con un título simple, y en cada una dos botones
 * grandes, "Sí, lo llevo" y "No". Sin casillas ni filtros. Si no entra en el vehículo, la tarjeta lo dice
 * ("No entra en el Camión Kia (3.000 kg)") y no tiene "Sí".
 */
export function ListaSugerencias({ sugerencias, elegidos, descartados = [], onCambiar, onDescartar, noEntra }: {
  sugerencias: SugerenciaPlana[];
  elegidos: string[];
  descartados?: string[];
  onCambiar: (ids: string[]) => void;
  onDescartar?: (ids: string[]) => void;
  /** Motivo si este pedido no entra con lo que ya lleva. */
  noEntra?: (s: SugerenciaPlana) => string | null;
}) {
  const grupos: { titulo: string; filas: SugerenciaPlana[] }[] = [];
  for (const s of sugerencias) {
    const titulo =
      s.grupo === "mismaObra" ? `Para la misma obra (${s.lugar}) también pidieron:` : s.grupo === "mismoLugar" ? `En el mismo lugar (${s.lugar}) hay para retirar:` : "Cerca de tu camino:";
    const g = grupos.find((x) => x.titulo === titulo);
    if (g) g.filas.push(s);
    else grupos.push({ titulo, filas: [s] });
  }
  const si = (id: string) => {
    onCambiar(elegidos.includes(id) ? elegidos : [...elegidos, id]);
    onDescartar?.(descartados.filter((x) => x !== id));
  };
  const no = (id: string) => {
    onCambiar(elegidos.filter((x) => x !== id));
    onDescartar?.(descartados.includes(id) ? descartados : [...descartados, id]);
  };

  return (
    <div className="flex flex-col gap-5">
      {grupos.map((g) => (
        <section key={g.titulo} className="flex flex-col gap-2">
          <p className="text-[17px] leading-snug font-semibold">{g.titulo}</p>
          <ul className="flex flex-col gap-3">
            {g.filas.map((s) => {
              const elegido = elegidos.includes(s.id);
              const descartado = descartados.includes(s.id);
              const motivo = elegido ? null : noEntra?.(s) ?? null;
              return (
                <li key={s.id} data-sugerencia={s.pedido.numero} className={`flex flex-col gap-3 rounded-[var(--radius-caja)] border p-4 ${elegido ? "border-tinta bg-hover" : descartado ? "border-linea bg-fondo text-suave" : "border-linea bg-papel"}`}>
                  <div className="min-w-0">
                    <p className="text-[19px] leading-tight font-semibold break-words">{s.titulo}</p>
                    <p className="mt-1 text-[15px] break-words">{s.detalle}</p>
                    <p className="mt-0.5 text-sm text-suave">{[`pidió ${s.pedido.solicitante}`, s.pedido.pesoKg ? peso(s.pedido.pesoKg) : null, s.pedido.oc, s.pedido.propio ? "ya es tuyo" : null].filter(Boolean).join(" · ")}</p>
                    {motivo && <p className="mt-1 text-[15px] font-semibold text-critico">{motivo}</p>}
                  </div>
                  <div className={`grid gap-2 ${motivo ? "grid-cols-1" : "grid-cols-2"}`}>
                    {!motivo && (
                      <button type="button" aria-pressed={elegido} onClick={() => si(s.id)} className={`min-h-12 rounded-md border text-[16px] font-semibold ${elegido ? "border-negro bg-negro text-white" : "border-linea-fuerte bg-papel"}`}>
                        Sí, lo llevo
                      </button>
                    )}
                    <button type="button" aria-pressed={descartado} onClick={() => no(s.id)} className={`min-h-12 rounded-md border text-[16px] font-semibold ${descartado ? "border-negro bg-negro text-white" : "border-linea-fuerte bg-papel"}`}>
                      No
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
