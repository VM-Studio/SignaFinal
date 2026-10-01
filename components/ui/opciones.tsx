"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

export type Opcion = {
  valor: string;
  titulo: ReactNode;
  detalle?: ReactNode;
  deshabilitada?: boolean;
  motivo?: string;
};

/** Elegir de una lista con botones grandes. Nada de escribir a mano. */
export function Opciones({
  opciones,
  valor,
  onElegir,
  nombre,
  columnas = 1,
}: {
  opciones: Opcion[];
  valor: string | undefined;
  onElegir: (v: string) => void;
  nombre: string;
  columnas?: 1 | 2;
}) {
  return (
    <div role="radiogroup" aria-label={nombre} className={`grid gap-2 ${columnas === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
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
            className={`flex min-h-[56px] w-full items-center gap-3 rounded-[var(--radius-caja)] border-2 px-4 py-2.5 text-left ${
              elegida ? "border-negro bg-negro text-white" : "border-linea bg-papel hover:border-linea-fuerte"
            } disabled:cursor-not-allowed disabled:bg-fondo disabled:text-apagado`}
          >
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-tight">{o.titulo}</span>
              {(o.deshabilitada && o.motivo) || o.detalle ? (
                <span className={`mt-0.5 block text-sm ${elegida ? "text-white/75" : o.deshabilitada ? "text-critico" : "text-suave"}`}>
                  {o.deshabilitada && o.motivo ? o.motivo : o.detalle}
                </span>
              ) : null}
            </span>
            {elegida && <Check className="size-5 shrink-0" strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}
