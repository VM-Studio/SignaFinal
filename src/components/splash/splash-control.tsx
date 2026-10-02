"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { CLAVE_INGRESO, CLAVE_SPLASH } from "./claves";

const FUNDIDO_MS = 300;

/**
 * Corre la barra y el porcentaje de 0 a 100 % en `ms` y después cierra el splash.
 * Se dispara al abrir el sistema y otra vez al entrar después del login.
 */
export function SplashControl({ ms }: { ms: number }) {
  const pathname = usePathname();
  const corriendo = useRef(false);

  useEffect(() => {
    if (corriendo.current) return;
    let visto = false;
    let ingreso = false;
    try {
      visto = sessionStorage.getItem(CLAVE_SPLASH) === "1";
      ingreso = sessionStorage.getItem(CLAVE_INGRESO) === "1";
    } catch {}
    const porIngreso = ingreso && pathname !== "/login";
    if (visto && !porIngreso) return;

    try {
      sessionStorage.removeItem(CLAVE_INGRESO);
    } catch {}
    corriendo.current = true;

    const raiz = document.documentElement;
    const splash = document.getElementById("splash");
    const barra = document.getElementById("splash-barra");
    const porcentaje = document.getElementById("splash-porcentaje");
    splash?.classList.remove("saliendo");
    raiz.classList.remove("splash-visto");

    const inicio = performance.now();
    const paso = (ahora: number) => {
      const p = Math.min(1, (ahora - inicio) / ms);
      if (barra) barra.style.transform = `scaleX(${p})`;
      if (porcentaje) porcentaje.textContent = `${Math.round(p * 100)}%`;
      if (p < 1) {
        requestAnimationFrame(paso);
        return;
      }
      splash?.classList.add("saliendo");
      window.setTimeout(() => {
        raiz.classList.add("splash-visto");
        if (barra) barra.style.transform = "scaleX(0)";
        if (porcentaje) porcentaje.textContent = "0%";
        try {
          sessionStorage.setItem(CLAVE_SPLASH, "1");
        } catch {}
        corriendo.current = false;
      }, FUNDIDO_MS);
    };
    requestAnimationFrame(paso);
  }, [pathname, ms]);

  return null;
}
