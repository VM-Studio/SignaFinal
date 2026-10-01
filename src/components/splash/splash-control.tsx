"use client";

import { useEffect } from "react";

/** Cierra el splash al terminar la barra (o enseguida si se pidió movimiento reducido). */
export function SplashControl({ ms, clave }: { ms: number; clave: string }) {
  useEffect(() => {
    const raiz = document.documentElement;
    if (raiz.classList.contains("splash-visto")) return;
    const splash = document.getElementById("splash");
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duracion = reducido ? 600 : ms;
    const fundido = reducido ? 0 : 300;

    const salir = window.setTimeout(() => splash?.classList.add("saliendo"), duracion);
    const fin = window.setTimeout(() => {
      raiz.classList.add("splash-visto");
      try {
        sessionStorage.setItem(clave, "1");
      } catch {}
    }, duracion + fundido);
    return () => {
      window.clearTimeout(salir);
      window.clearTimeout(fin);
    };
  }, [ms, clave]);
  return null;
}
