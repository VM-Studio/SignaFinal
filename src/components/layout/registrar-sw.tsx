"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Registra el service worker (solo producción). En el login borra las pantallas guardadas: pueden ser de otra persona. */
export function RegistrarSW() {
  const pathname = usePathname();
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  useEffect(() => {
    if (pathname !== "/login" || !("caches" in window)) return;
    caches.keys().then((ks) => ks.filter((k) => k.includes("pantallas")).forEach((k) => caches.delete(k))).catch(() => {});
  }, [pathname]);
  return null;
}
