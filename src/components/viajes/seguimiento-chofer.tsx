"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAviso } from "@/components/ui/avisos";
import { distancia } from "@/lib/geo";

const CADA_MS = 30_000;
const CADA_M = 200;
const AVISADO = "signa:gps-negado-avisado";

/**
 * Mientras el chofer tiene un viaje en curso, manda la posición del teléfono cada 30 s o 200 m.
 * Va en el layout del chofer, así sigue aunque navegue. Si niega la ubicación, se le dice una
 * sola vez y la app sigue funcionando (los avisos salen con los tiempos estimados).
 */
export function SeguimientoChofer({ activo }: { activo: boolean }) {
  const router = useRouter();
  const aviso = useAviso();
  const ultimo = useRef<{ t: number; lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!activo || !("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      async (p) => {
        const aqui = { lat: p.coords.latitude, lng: p.coords.longitude };
        const u = ultimo.current;
        if (u && Date.now() - u.t < CADA_MS && distancia(u, aqui) < CADA_M) return;
        ultimo.current = { t: Date.now(), ...aqui };
        try {
          const r = await fetch("/api/posiciones/telefono", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...aqui, precisionM: p.coords.accuracy, velocidadMs: p.coords.speed, rumbo: p.coords.heading }),
          });
          const j = (await r.json()) as { cambioDeEtapa?: boolean };
          if (j.cambioDeEtapa) router.refresh(); // salió del retiro: la pantalla pasa al tramo a la obra
        } catch {
          // Sin señal: la próxima posición vuelve a intentar.
        }
      },
      (e) => {
        if (e.code !== e.PERMISSION_DENIED) return;
        try {
          if (localStorage.getItem(AVISADO)) return;
          localStorage.setItem(AVISADO, "1");
        } catch {}
        aviso({ mensaje: "Sin permiso de ubicación: el viaje sigue igual, pero no se ve en el mapa. Podés activarla en los permisos del navegador.", tono: "error" });
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [activo, aviso, router]);

  return null;
}

/** Posición para los botones del viaje: rápida, y si no hay (sin permiso o sin GPS), sigue sin ella. */
export function posicionActual(): Promise<{ lat: number; lng: number; precisionM: number } | null> {
  return new Promise((ok) => {
    if (!("geolocation" in navigator)) return ok(null);
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude, precisionM: p.coords.accuracy }),
      () => ok(null),
      { enableHighAccuracy: true, timeout: 5_000, maximumAge: 30_000 },
    );
  });
}
