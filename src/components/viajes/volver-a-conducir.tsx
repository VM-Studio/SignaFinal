"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CLAVE_CONDUCIENDO } from "./modo-conduccion";

/**
 * iPhone: si al volver de Google Maps la app arrancó de nuevo en el inicio, vuelve al modo conducción del
 * viaje que estaba manejando (la página del viaje decide si sigue en curso).
 */
export function VolverAConducir() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    let id: string | null = null;
    try {
      id = sessionStorage.getItem(CLAVE_CONDUCIENDO);
    } catch {}
    if (id && (pathname === "/inicio" || pathname === "/hoy")) router.replace(`/viaje/${id}/conducir`);
    // Una sola vez por arranque: si sale del modo conducción a propósito, se borra.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
