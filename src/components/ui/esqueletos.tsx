import { Esqueleto } from "./basicos";

/** Esqueletos con la forma de cada pantalla: se ven al instante mientras llegan los datos. */
export function EsqueletoLista({ filas = 5, pestanas = false }: { filas?: number; pestanas?: boolean }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando">
      {pestanas && <Esqueleto className="h-10 lg:h-8 lg:w-80" />}
      {Array.from({ length: filas }, (_, i) => <Esqueleto key={i} className="h-14 lg:h-11" />)}
    </div>
  );
}

/** Tarjetas grandes del chofer (Hoy, Solicitudes). */
export function EsqueletoTarjetas({ cantidad = 2 }: { cantidad?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando">
      <Esqueleto className="h-10" />
      {Array.from({ length: cantidad }, (_, i) => <Esqueleto key={i} className="h-[240px]" />)}
    </div>
  );
}

/** Pantalla con mapa arriba (viaje, seguimiento, mapa). */
export function EsqueletoMapa({ alto = "h-[240px]" }: { alto?: string }) {
  return (
    <div className="flex flex-col gap-3 lg:grid lg:h-[calc(100dvh-96px)] lg:grid-cols-[400px_1fr]" aria-busy="true" aria-label="Cargando">
      <div className="flex flex-col gap-3 lg:order-1">
        <Esqueleto className="h-32" />
        <Esqueleto className="h-16" />
      </div>
      <Esqueleto className={`${alto} lg:order-2 lg:h-full`} />
    </div>
  );
}

/** Detalle de un pedido. */
export function EsqueletoDetalle() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]" aria-busy="true" aria-label="Cargando">
      <div className="flex flex-col gap-3">
        <Esqueleto className="h-5 w-40" />
        <Esqueleto className="h-7 w-2/3" />
        <Esqueleto className="h-[260px]" />
      </div>
      <Esqueleto className="h-40" />
    </div>
  );
}
