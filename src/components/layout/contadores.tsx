"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { ClaveContador } from "@/lib/navegacion";
import { useCantidadAvisos } from "./avisos-en-vivo";
import { useEventosCambio } from "./tiempo-real";

type Contadores = Partial<Record<ClaveContador, number>>;
const Ctx = createContext<Contadores>({});

/**
 * Contadores de la barra en vivo: arrancan con lo que trajo el servidor y se vuelven a pedir (una vez
 * cada tanto, sin refrescar la pantalla) cuando llega un cambio de pedidos, órdenes, viajes o materiales.
 * Los avisos sin leer salen de la campana.
 */
export function ContadoresEnVivo({ inicial, children }: { inicial: Contadores; children: ReactNode }) {
  const [c, setC] = useState(inicial);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pedir = useCallback(() => {
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(() => {
      fetch("/api/contadores").then((r) => (r.ok ? r.json() : null)).then((x) => x && setC(x)).catch(() => {});
    }, 800);
  }, []);
  useEventosCambio((e) => {
    if (e === "reconexion" || ["PEDIDO_MATERIAL", "ORDEN_COMPRA", "PEDIDO_VIAJE", "MATERIAL_LISTO"].includes(e.entidad)) pedir();
  });
  return <Ctx.Provider value={c}>{children}</Ctx.Provider>;
}

export function useContador(clave: ClaveContador | undefined) {
  const c = useContext(Ctx);
  const avisos = useCantidadAvisos();
  if (!clave) return 0;
  return clave === "avisos" ? avisos : c[clave] ?? 0;
}

/** Para leer varios contadores a la vez (el punto de "Más"). */
export function useLeerContador() {
  const c = useContext(Ctx);
  const avisos = useCantidadAvisos();
  return (clave: ClaveContador) => (clave === "avisos" ? avisos : c[clave] ?? 0);
}
