"use client";

import { useSyncExternalStore } from "react";

const CONSULTA = "(min-width: 1024px)";

/**
 * true en escritorio (1024px+). Para no montar dos veces lo pesado (un mapa) cuando celular y
 * escritorio lo ponen en lugares distintos. En el servidor, false.
 */
export function useEscritorio() {
  return useSyncExternalStore(
    (avisar) => {
      const m = window.matchMedia(CONSULTA);
      m.addEventListener("change", avisar);
      return () => m.removeEventListener("change", avisar);
    },
    () => window.matchMedia(CONSULTA).matches,
    () => false,
  );
}
