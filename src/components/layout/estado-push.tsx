"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Check, Loader2, Send, X } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { enviarmePrueba, type ResultadoPrueba } from "@/lib/avisos/acciones";

const CLAVE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function aBytes(base64: string) {
  const b = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
}

type Item = { titulo: string; ok: boolean | null; detalle?: string; accion?: { texto: string; hacer: () => void } };
type EstadoServidor = { vapid: { ok: boolean; faltan: string[] }; suscripcion: { activa: boolean; usuario: string; esMia: boolean } | null };

const esIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const instalada = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

async function guardarEnServidor(s: PushSubscription) {
  const r = await fetch("/api/push/suscribir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s.toJSON()) });
  if (!r.ok) throw new Error("El servidor no guardó la suscripción.");
}

/**
 * "Avisos en este dispositivo": diagnóstico real, en el orden en que tiene que estar todo para que
 * llegue una push con el celular apagado. Cada punto con tilde o cruz y qué hacer si falla.
 */
export function EstadoPush() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [trabajando, setTrabajando] = useState<"activar" | "prueba" | null>(null);
  const [prueba, setPrueba] = useState<{ ok: boolean; texto: string; resultado?: ResultadoPrueba } | null>(null);

  const diagnosticar = useCallback(async () => {
    const lista: Item[] = [];
    const ios = esIOS();
    const pasar = async (sub: PushSubscription) => {
      try {
        await guardarEnServidor(sub);
      } finally {
        await diagnosticar();
      }
    };
    // 1. Navegador compatible
    const compatible = "Notification" in window && "PushManager" in window && "serviceWorker" in navigator;
    lista.push({
      titulo: "Navegador compatible con avisos",
      ok: compatible,
      detalle: compatible ? undefined : ios ? "En iPhone, los avisos funcionan solo con la app instalada (iOS 16.4 o más nuevo)." : "Este navegador no admite avisos. Usá Chrome en Android o la app instalada.",
    });
    // 2. App instalada
    const inst = instalada();
    lista.push({
      titulo: "App instalada en la pantalla de inicio",
      ok: inst ? true : ios ? false : null,
      detalle: inst ? undefined : ios ? "En iPhone, primero tocá Compartir → Agregar a inicio, y abrí la app desde ahí." : "Recomendado: menú del navegador → Instalar app (o Agregar a la pantalla principal).",
    });
    // 3. Permiso
    const permiso = "Notification" in window ? Notification.permission : "denied";
    lista.push({
      titulo: `Permiso de notificaciones: ${permiso === "granted" ? "concedido" : permiso === "denied" ? "denegado" : "sin pedir"}`,
      ok: permiso === "granted" ? true : permiso === "denied" ? false : null,
      detalle:
        permiso === "denied"
          ? ios ? "Activalo en Ajustes → Notificaciones → Signa." : "Activalo en Ajustes del sitio → Notificaciones (el candado de la barra de direcciones)."
          : permiso === "default" ? "Tocá “Activar avisos” y aceptá el permiso." : undefined,
    });
    // 4. Service worker
    let reg: ServiceWorkerRegistration | undefined;
    try {
      reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration("/") : undefined;
    } catch {}
    lista.push({ titulo: "Service worker registrado y activo", ok: !!reg?.active, detalle: reg?.active ? undefined : "Cerrá la app y volvé a abrirla. Si sigue, recargá la página." });
    // 5. Suscripción en el servidor y 6. claves VAPID
    let sub: PushSubscription | null = null;
    try {
      sub = (await reg?.pushManager.getSubscription()) ?? null;
    } catch {}
    let servidor: EstadoServidor | null = null;
    try {
      const r = await fetch("/api/push/estado", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub ? { endpoint: sub.endpoint } : {}) });
      if (r.ok) servidor = (await r.json()) as EstadoServidor;
    } catch {}
    const s = servidor?.suscripcion;
    const actual = sub;
    lista.push(
      !actual
        ? { titulo: "Suscripción de este dispositivo", ok: false, detalle: "Este dispositivo no está suscripto. Tocá “Activar avisos”." }
        : !s
          ? { titulo: "Suscripción guardada en el servidor", ok: false, detalle: "El navegador está suscripto pero el servidor no la tiene.", accion: { texto: "Guardarla ahora", hacer: () => void pasar(actual) } }
          : !s.esMia
            ? { titulo: "Suscripción a tu nombre", ok: false, detalle: `Está a nombre de ${s.usuario}: los avisos le llegan a esa persona.`, accion: { texto: "Pasar a mi usuario", hacer: () => void pasar(actual) } }
            : !s.activa
              ? { titulo: "Suscripción activa", ok: false, detalle: "Está desactivada (se cerró sesión en este dispositivo).", accion: { texto: "Reactivarla", hacer: () => void pasar(actual) } }
              : { titulo: "Suscripción guardada a tu nombre", ok: true },
    );
    lista.push({
      titulo: "Claves de avisos (VAPID) en el servidor",
      ok: servidor ? servidor.vapid.ok : null,
      detalle: !servidor ? "No se pudo consultar al servidor." : servidor.vapid.ok ? undefined : `Faltan en el servidor: ${servidor.vapid.faltan.join(", ")}. Avisale a la oficina.`,
    });
    setItems(lista);
  }, []);

  useEffect(() => {
    void diagnosticar();
  }, [diagnosticar]);

  async function activar() {
    setTrabajando("activar");
    setPrueba(null);
    try {
      if (!CLAVE) throw new Error("Falta la clave pública de avisos en la app (NEXT_PUBLIC_VAPID_PUBLIC_KEY).");
      if ((await Notification.requestPermission()) !== "granted") throw new Error("No se dio el permiso de notificaciones.");
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const reg = await navigator.serviceWorker.ready;
      const s = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(CLAVE) }));
      await guardarEnServidor(s);
      setPrueba({ ok: true, texto: "Avisos activados en este dispositivo. Mandate una prueba." });
    } catch (e) {
      setPrueba({ ok: false, texto: e instanceof Error ? e.message : "No se pudieron activar." });
    } finally {
      setTrabajando(null);
      await diagnosticar();
    }
  }

  async function probar() {
    setTrabajando("prueba");
    setPrueba(null);
    const r = await enviarmePrueba();
    setTrabajando(null);
    if (!r.ok) return setPrueba({ ok: false, texto: r.error });
    const todo = r.datos.enviadas === r.datos.telefonos;
    setPrueba({
      ok: todo,
      texto: `Prueba de las ${r.datos.hora}: enviada a ${r.datos.enviadas} de ${r.datos.telefonos} ${r.datos.telefonos === 1 ? "dispositivo" : "dispositivos"}.${todo ? " Tiene que aparecer en unos segundos." : ""}`,
      resultado: r.datos,
    });
  }

  const todoOk = items?.every((c) => c.ok !== false);
  return (
    <div className="rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
      <p className="flex items-center gap-2 font-semibold"><BellRing className="size-4" /> Avisos en este dispositivo</p>
      {!items ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-suave"><Loader2 className="size-4 animate-spin" /> Revisando…</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((c) => (
            <li key={c.titulo} className="flex gap-2">
              <span aria-hidden className={`mt-0.5 grid size-4 shrink-0 place-items-center ${c.ok === true ? "text-ok" : c.ok === false ? "text-critico" : "text-suave"}`}>
                {c.ok === true ? <Check className="size-4" strokeWidth={2.25} /> : c.ok === false ? <X className="size-4" strokeWidth={2.25} /> : <span className="text-xs">?</span>}
              </span>
              <div className="min-w-0 text-sm">
                <p className="font-medium">{c.titulo}<span className="sr-only">{c.ok === true ? ": bien" : c.ok === false ? ": falta" : ": sin datos"}</span></p>
                {c.detalle && <p className="text-suave">{c.detalle}</p>}
                {c.accion && <button onClick={c.accion.hacer} className="mt-1 min-h-9 font-medium underline">{c.accion.texto}</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Boton variante={todoOk ? "secundario" : "primario"} cargando={trabajando === "activar"} onClick={activar}>Activar avisos</Boton>
        <Boton variante={todoOk ? "primario" : "secundario"} cargando={trabajando === "prueba"} icono={<Send />} onClick={probar}>Enviarme una prueba</Boton>
      </div>
      {prueba && (
        <div role="status" className={`mt-3 rounded-md p-3 text-sm ${prueba.ok ? "bg-ok-fondo" : "bg-critico-fondo"}`}>
          <p className="font-medium">{prueba.texto}</p>
          {prueba.resultado && (
            <ul className="mt-2 flex flex-col gap-1">
              {prueba.resultado.resultados.map((x, i) => (
                <li key={i}>
                  <span className="font-medium">{x.equipo}</span> ({x.servicio}): {x.ok ? `enviada (${x.codigo})` : <span className="text-critico">falló — {x.motivo}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
