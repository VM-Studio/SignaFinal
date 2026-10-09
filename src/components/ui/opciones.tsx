"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

export type Opcion = { valor: string; titulo: ReactNode; detalle?: ReactNode; icono?: ReactNode; deshabilitada?: boolean; motivo?: string };

/** Elegir de una lista: filas de 56px (48 en escritorio) con borde de 1px. Los que no sirven, en gris con el motivo. */
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
            className={`flex min-h-14 w-full items-center gap-3 rounded-md border px-3 py-2 text-left lg:min-h-12 [&>svg]:size-5 lg:[&>svg]:size-4 ${
              elegida ? "border-tinta bg-hover shadow-[inset_0_0_0_1px_var(--color-tinta)]" : "border-linea bg-papel hover:border-linea-fuerte"
            } disabled:cursor-not-allowed disabled:border-linea disabled:bg-fondo disabled:text-suave`}
          >
            {o.icono}
            <span className="min-w-0 flex-1">
              <span className="block leading-tight font-medium">{o.titulo}</span>
              {(o.deshabilitada && o.motivo) || o.detalle ? (
                <span className={`mt-0.5 block text-sm ${o.deshabilitada ? "text-critico" : "text-suave"}`}>
                  {o.deshabilitada && o.motivo ? o.motivo : o.detalle}
                </span>
              ) : null}
            </span>
            {elegida && <Check aria-hidden className="shrink-0" strokeWidth={2.25} />}
          </button>
        );
      })}
    </div>
  );
}
