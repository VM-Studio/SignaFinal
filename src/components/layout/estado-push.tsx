"use client";

import { useEffect, useState } from "react";
import { BellRing, Send } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { enviarmePrueba } from "@/lib/avisos/acciones";

type Estado = "cargando" | "activadas" | "inactivas" | "bloqueadas" | "no-soportado" | "ios-sin-instalar";

const CLAVE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function aBytes(base64: string) {
  const b = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
}

/** En iPhone los avisos solo andan con la app instalada en la pantalla de inicio. */
function iosSinInstalar() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !instalada;
}

/** "Activar avisos en este celular": pide permiso, guarda la suscripción y muestra el estado. */
export function EstadoPush() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (iosSinInstalar()) return setEstado("ios-sin-instalar");
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || !CLAVE) return setEstado("no-soportado");
    if (Notification.permission === "denied") return setEstado("bloqueadas");
    navigator.serviceWorker
      .getRegistration()
      .then((r) => (r ? r.pushManager.getSubscription() : null))
      .then(async (s) => {
        const activas = !!s && Notification.permission === "granted";
        setEstado(activas ? "activadas" : "inactivas");
        // Si en este celular entró otra persona, la suscripción pasa a ser suya (una por usuario y dispositivo).
        if (activas) await fetch("/api/push/suscribir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s!.toJSON()) }).catch(() => {});
      })
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
      const res = await fetch("/api/push/suscribir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s.toJSON()) });
      if (!res.ok) throw new Error();
      setEstado("activadas");
    } catch {
      setError("No se pudieron activar. Probá de nuevo.");
      setEstado("inactivas");
    }
  }

  const [prueba, setPrueba] = useState<{ cargando: boolean; texto: string | null; ok: boolean }>({ cargando: false, texto: null, ok: true });
  async function probar() {
    setPrueba({ cargando: true, texto: null, ok: true });
    const r = await enviarmePrueba();
    setPrueba(r.ok ? { cargando: false, ok: true, texto: `Listo: te la mandamos a ${r.datos.enviadas === 1 ? "tu celular" : `${r.datos.enviadas} celulares`}. Tiene que llegar en unos segundos.` } : { cargando: false, ok: false, texto: r.error });
  }

  async function desactivar() {
    setEstado("cargando");
    try {
      const r = await navigator.serviceWorker.getRegistration();
      const s = await r?.pushManager.getSubscription();
      if (s) {
        await fetch("/api/push/baja", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: s.endpoint }) });
        await s.unsubscribe();
      }
    } finally {
      setEstado("inactivas");
    }
  }

  return (
    <div className="rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
      <p className="flex items-center gap-2 font-semibold">
        <BellRing className="size-5" /> Avisos en este celular
      </p>
      {estado === "activadas" && (
        <>
          <p className="mt-1 font-semibold text-ok">Activados en este dispositivo: te llegan aunque no tengas la app abierta.</p>
          <Boton className="mt-3" ancho variante="secundario" cargando={prueba.cargando} icono={<Send className="size-4" />} onClick={probar}>Enviarme una prueba</Boton>
          {prueba.texto && <p role="status" className={`mt-2 text-sm font-medium ${prueba.ok ? "text-ok" : "text-critico"}`}>{prueba.texto}</p>}
          <button onClick={desactivar} className="mt-2 text-sm font-semibold text-suave underline">Desactivar en este celular</button>
        </>
      )}
      {estado === "bloqueadas" && <p className="mt-1 text-sm font-semibold text-critico">Bloqueados por el navegador. Tocá el candado de la barra de direcciones → Notificaciones → Permitir, y volvé acá.</p>}
      {estado === "no-soportado" && <p className="mt-1 text-sm text-suave">Este navegador no admite avisos. Abrí la app con Chrome (Android) o instalala en la pantalla de inicio.</p>}
      {estado === "ios-sin-instalar" && (
        <p className="mt-1 text-sm text-suave">En iPhone los avisos funcionan solo con la app instalada: tocá Compartir → “Agregar a inicio” y abrila desde ahí.</p>
      )}
      {(estado === "inactivas" || estado === "cargando") && (
        <Boton className="mt-3" ancho onClick={activar} cargando={estado === "cargando"}>Activar avisos en este celular</Boton>
      )}
      {error && <p role="alert" className="mt-2 text-sm font-medium text-critico">{error}</p>}
    </div>
  );
}
