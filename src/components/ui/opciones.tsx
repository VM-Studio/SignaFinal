"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

export type Opcion = { valor: string; titulo: ReactNode; detalle?: ReactNode; icono?: ReactNode; deshabilitada?: boolean; motivo?: string };

/** Elegir de una lista con botones grandes (mínimo 56px). Los que no sirven, en gris con el motivo. */
export function Opciones({ opciones, valor, onElegir, nombre, columnas = 1 }: {
  opciones: Opcion[]; valor: string | undefined; onElegir: (v: string) => void; nombre: string; columnas?: 1 | 2 | 3 | 4;
}) {
  const cols = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" }[columnas];
  return (
    <div role="radiogroup" aria-label={nombre} className={`grid gap-2 ${cols}`}>
      {opciones.map((o) => {
        const elegida = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={elegida}
            disabled={o.deshabilitada}
            onClick={() => onElegir(o.valor)}
            className={`flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-caja)] border-2 px-4 py-2.5 text-left ${
              elegida ? "border-negro bg-negro text-white" : "border-linea bg-papel hover:border-linea-fuerte"
            } disabled:cursor-not-allowed disabled:border-linea disabled:bg-fondo disabled:text-apagado`}
          >
            {o.icono}
            <span className="min-w-0 flex-1">
              <span className="block leading-tight font-semibold">{o.titulo}</span>
              {(o.deshabilitada && o.motivo) || o.detalle ? (
                <span className={`mt-0.5 block text-sm ${elegida ? "text-white/75" : o.deshabilitada ? "font-medium text-critico" : "text-suave"}`}>
                  {o.deshabilitada && o.motivo ? o.motivo : o.detalle}
                </span>
              ) : null}
            </span>
            {elegida && <Check aria-hidden className="size-5 shrink-0" strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}
