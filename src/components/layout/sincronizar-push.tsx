"use client";

import { useEffect } from "react";

/**
 * Al abrir la app con sesión: si este dispositivo ya tiene una suscripción push (y permiso), se le
 * reenvía al servidor para que quede a nombre del usuario que está usando la app AHORA. Silencioso:
 * no pide permiso ni muestra nada. Así, el que entra con su usuario recibe sus avisos con el
 * celular apagado, aunque antes haya entrado otro en el mismo teléfono.
 */
export function SincronizarPush() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("Notification" in window) || Notification.permission !== "granted") return;
    navigator.serviceWorker.ready
      .then((r) => r.pushManager.getSubscription())
      .then((s) => s && fetch("/api/push/suscribir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s.toJSON()) }))
      .catch(() => {});
  }, []);
  return null;
}
