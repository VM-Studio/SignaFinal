"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cerrarSesion } from "@/lib/auth/acciones";

/** Endpoint push de este dispositivo (si tiene), para desactivarlo al cerrar sesión. */
function useEndpoint() {
  const [endpoint, setEndpoint] = useState("");
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistration().then((r) => r?.pushManager.getSubscription()).then((s) => s && setEndpoint(s.endpoint)).catch(() => {});
  }, []);
  return endpoint;
}

/** Formulario de "Cerrar sesión": manda el endpoint push del dispositivo para desactivarlo. */
export function FormularioSalir({ children, className }: { children: ReactNode; className?: string }) {
  const endpoint = useEndpoint();
  return (
    <form action={cerrarSesion} className={className}>
      <input type="hidden" name="endpoint" value={endpoint} />
      {children}
    </form>
  );
}
