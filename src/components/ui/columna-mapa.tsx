import type { ReactNode } from "react";

/**
 * Pantalla con mapa. Escritorio: columna de 400px con la información (con scroll propio) y el mapa
 * a la derecha, a todo el alto, de borde a borde. Celular: `arriba`, el mapa y `abajo`, en ese orden.
 */
export function ColumnaMapa({ arriba, abajo, mapa, altoCelular = "h-[50dvh]" }: { arriba: ReactNode; abajo?: ReactNode; mapa: ReactNode; altoCelular?: string }) {
  return (
    <div className="flex flex-col gap-4 lg:-m-6 lg:grid lg:h-[calc(100dvh-48px)] lg:grid-cols-[400px_1fr] lg:gap-0">
      <div className="contents lg:flex lg:min-h-0 lg:flex-col lg:gap-4 lg:overflow-y-auto lg:border-r lg:border-linea lg:bg-papel lg:p-6">
        <div className="order-1 flex flex-col gap-4">{arriba}</div>
        {abajo && <div className="order-3 flex flex-col gap-4">{abajo}</div>}
      </div>
      <div className={`relative isolate order-2 overflow-hidden rounded-[var(--radius-caja)] border border-linea ${altoCelular} lg:h-full lg:rounded-none lg:border-0`}>{mapa}</div>
    </div>
  );
}
