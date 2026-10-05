"use client";

import { useEffect, useSyncExternalStore } from "react";

export const CLAVE_VISTO = "signa:solicitudes-vistas";
const EVENTO = "signa:solicitudes-vistas";

/** Al abrir Solicitudes: lo que había hasta ahora ya está visto (apaga el indicador de la barra). */
export function MarcarSolicitudesVistas() {
  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_VISTO, new Date().toISOString());
      window.dispatchEvent(new Event(EVENTO));
    } catch {}
  }, []);
  return null;
}

/** ¿Hay solicitudes nuevas desde la última vez que miró? */
export function useHaySolicitudesNuevas(ultima: string | null) {
  const visto = useSyncExternalStore(
    (fn) => {
      window.addEventListener(EVENTO, fn);
      window.addEventListener("storage", fn);
      return () => {
        window.removeEventListener(EVENTO, fn);
        window.removeEventListener("storage", fn);
      };
    },
    () => {
      try {
        return localStorage.getItem(CLAVE_VISTO);
      } catch {
        return null;
      }
    },
    () => "servidor",
  );
  if (!ultima || visto === "servidor") return false;
  return !visto || new Date(ultima) > new Date(visto);
}
