"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { guardarSuscripcion } from "@/lib/push/acciones";
import { Boton } from "@/components/ui/boton";

type Estado = "cargando" | "activadas" | "inactivas" | "bloqueadas" | "no-soportado";

const CLAVE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function aBytes(base64: string) {
  const b = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
}

/** Avisos push en este teléfono: activadas, o un botón para activarlas. */
export function EstadoPush() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || !CLAVE) {
      setEstado("no-soportado");
      return;
    }
    if (Notification.permission === "denied") {
      setEstado("bloqueadas");
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then((r) => (r ? r.pushManager.getSubscription() : null))
      .then((s) => setEstado(s && Notification.permission === "granted" ? "activadas" : "inactivas"))
      .catch(() => setEstado("inactivas"));
  }, []);

  async function activar() {
    setError(null);
    setEstado("cargando");
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        setEstado(Notification.permission === "denied" ? "bloqueadas" : "inactivas");
        return;
      }
      const r = await navigator.serviceWorker.ready;
      const s = (await r.pushManager.getSubscription()) ?? (await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(CLAVE) }));
      const j = s.toJSON();
      const res = await guardarSuscripcion({ endpoint: s.endpoint, p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "", userAgent: navigator.userAgent });
      if (!res.ok) throw new Error(res.error);
      setEstado("activadas");
    } catch {
      setError("No se pudieron activar. Probá de nuevo.");
      setEstado("inactivas");
    }
  }

  return (
    <div className="rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
      <p className="flex items-center gap-2 font-semibold">
        <BellRing className="size-5" /> Avisos en este teléfono
      </p>
      {estado === "activadas" && <p className="mt-1 font-semibold text-ok">Activados</p>}
      {estado === "bloqueadas" && <p className="mt-1 text-sm text-suave">Bloqueados en el navegador. Habilitalos en los permisos del sitio.</p>}
      {estado === "no-soportado" && <p className="mt-1 text-sm text-suave">Este navegador no los admite. Instalá la app en el inicio del teléfono.</p>}
      {(estado === "inactivas" || estado === "cargando") && (
        <Boton className="mt-3" ancho onClick={activar} cargando={estado === "cargando"}>
          Activar avisos
        </Boton>
      )}
      {error && <p role="alert" className="mt-2 text-sm font-medium text-critico">{error}</p>}
    </div>
  );
}
