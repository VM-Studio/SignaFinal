"use client";

import { useEffect } from "react";

export function SplashControl({ ms, clave }: { ms: number; clave: string }) {
  useEffect(() => {
    const raiz = document.documentElement;
    if (raiz.classList.contains("splash-visto")) return;
    const splash = document.getElementById("splash");
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const salir = window.setTimeout(() => splash?.classList.add("saliendo"), ms);
    const fin = window.setTimeout(() => {
      raiz.classList.add("splash-visto");
      document.body.style.overflow = overflowPrevio;
      try {
        sessionStorage.setItem(clave, "1");
      } catch {}
    }, ms + 300);

    return () => {
      window.clearTimeout(salir);
      window.clearTimeout(fin);
      document.body.style.overflow = overflowPrevio;
    };
  }, [ms, clave]);

  return null;
}
