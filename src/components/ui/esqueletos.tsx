import { Esqueleto } from "./basicos";

/** Esqueletos con la forma de cada pantalla: se ven al instante mientras llegan los datos. */
export function EsqueletoLista({ filas = 5, pestanas = false, ancho = "max-w-3xl" }: { filas?: number; pestanas?: boolean; ancho?: string }) {
  return (
    <div className={`mx-auto flex flex-col gap-3 ${ancho}`} aria-busy="true" aria-label="Cargando">
      <Esqueleto className="h-9 w-48" />
      {pestanas && <Esqueleto className="h-11" />}
      {Array.from({ length: filas }, (_, i) => <Esqueleto key={i} className="h-[72px]" />)}
    </div>
  );
}

/** Tarjetas grandes del chofer (Hoy, Solicitudes). */
export function EsqueletoTarjetas({ cantidad = 2 }: { cantidad?: number }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3" aria-busy="true" aria-label="Cargando">
      <Esqueleto className="h-11" />
      {Array.from({ length: cantidad }, (_, i) => <Esqueleto key={i} className="h-[300px]" />)}
    </div>
  );
}

/** Pantalla con mapa arriba (viaje, seguimiento, mapa). */
export function EsqueletoMapa({ alto = "h-[240px]" }: { alto?: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3 lg:max-w-none" aria-busy="true" aria-label="Cargando">
      <Esqueleto className={alto} />
      <Esqueleto className="h-32" />
      <Esqueleto className="h-16" />
    </div>
  );
}

/** Detalle de un pedido. */
export function EsqueletoDetalle() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3" aria-busy="true" aria-label="Cargando">
      <Esqueleto className="h-5 w-40" />
      <Esqueleto className="h-9 w-3/4" />
      <Esqueleto className="h-[260px]" />
      <Esqueleto className="h-40" />
    </div>
  );
}
