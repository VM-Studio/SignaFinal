"use client";

import { useEffect } from "react";

/**
 * Celular: al tocar un campo, el teclado tapa media pantalla. Cuando termina de abrirse, el campo se
 * centra en lo que queda visible (scrollIntoView, block "center"). En escritorio no hace nada.
 */
export function AjusteTeclado() {
  useEffect(() => {
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const alEnfocar = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.matches?.("input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]), textarea, select, [contenteditable=true]")) return;
      clearTimeout(t);
      // El teclado tarda ~300 ms en abrir (y cambia el visualViewport).
      t = setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 320);
    };
    document.addEventListener("focusin", alEnfocar);
    return () => {
      clearTimeout(t);
      document.removeEventListener("focusin", alEnfocar);
    };
  }, []);
  return null;
}
