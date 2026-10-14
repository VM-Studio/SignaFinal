import type { ReactNode } from "react";

/**
 * Pantalla con mapa. Escritorio: columna de 400px con la información (con scroll propio) y el mapa
 * a la derecha, a todo el alto y el ancho que queda, de borde a borde. Celular (y dentro del panel de
 * 480 px de una lista): `arriba`, el mapa y `abajo`, en ese orden. Por container queries (@2xl), no por
 * el ancho de la ventana: así se ve bien a página completa y en el panel.
 */
export function ColumnaMapa({ arriba, abajo, mapa, altoCelular = "h-[50dvh]" }: { arriba: ReactNode; abajo?: ReactNode; mapa: ReactNode; altoCelular?: string }) {
  return (
    <div className="flex flex-col gap-4 @2xl:-m-4 @2xl:grid @2xl:h-[calc(100dvh-108px)] lg:-m-6 lg:h-[calc(100dvh-48px)] @2xl:grid-cols-[400px_minmax(0,1fr)] @2xl:gap-0">
      <div className="contents @2xl:flex @2xl:min-h-0 @2xl:flex-col @2xl:gap-4 @2xl:overflow-y-auto @2xl:border-r @2xl:border-linea @2xl:bg-papel @2xl:p-6">
        <div className="order-1 flex flex-col gap-4">{arriba}</div>
        {abajo && <div className="order-3 flex flex-col gap-4">{abajo}</div>}
      </div>
      <div className={`relative isolate order-2 overflow-hidden rounded-[var(--radius-caja)] border border-linea ${altoCelular} @2xl:h-full @2xl:rounded-none @2xl:border-0`}>{mapa}</div>
    </div>
  );
}
