"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { EntidadCambio } from "@prisma/client";
import { useAviso } from "@/components/ui/avisos";
import { sincronizarCusatAhora } from "@/lib/cusat/acciones";

/**
 * TIEMPO REAL del lado del que recibe: UN stream por pestaña a /api/tiempo-real/stream (Server-Sent
 * Events). El servidor corta a los 50 s y el navegador reconecta solo con Last-Event-ID, sin perder
 * eventos; si el stream no anda, polling cada 8 s al mismo endpoint en modo JSON. Cada pantalla dice qué
 * entidades le importan (useTiempoReal) y se refresca sola (router.refresh: los Server Components
 * vuelven a pedir los datos, sin recargar la página).
 */
export type EventoCambio = { id: number; entidad: EntidadCambio; entidadId: string; accion: string };
export type EstadoConexion = "conectado" | "reconectando" | "sin-conexion";

const FALLAS_PARA_POLLING = 3;
const POLLING_MS = 8_000;
/** Una caída "de verdad" (no el corte normal de los 50 s): más de esto sin volver a conectar. */
const CAIDA_MS = 4_000;
const DEBOUNCE_MS = 500;
const RESALTADO_MS = 2_000;
const ACTUALIZAR_MAX_MS = 3_000;

type Contexto = {
  estado: EstadoConexion;
  suscribir: (fn: (e: EventoCambio | "reconexion") => void) => () => void;
  /** Botón "Actualizar" y deslizar hacia abajo: refresco + reconexión (+ Cusat en pantallas con mapa). */
  actualizar: () => Promise<void>;
  actualizando: boolean;
};
const Ctx = createContext<Contexto>({ estado: "reconectando", suscribir: () => () => {}, actualizar: async () => {}, actualizando: false });

export const useConexion = () => useContext(Ctx);

/** Pantallas con mapa: "Actualizar" también trae las posiciones de Cusat al momento. */
const CON_MAPA = /^\/(mapa|viaje\/|mis-pedidos\/|solicitudes\/|viajes-en-curso)/;

export function TiempoReal({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const aviso = useAviso();
  const [estado, setEstado] = useState<EstadoConexion>("reconectando");
  const [actualizando, setActualizando] = useState(false);
  const oyentes = useRef(new Set<(e: EventoCambio | "reconexion") => void>());
  const ultimo = useRef<number | null>(null);
  const [vuelta, setVuelta] = useState(0); // cambiarla reabre la conexión

  const emitir = useCallback((e: EventoCambio | "reconexion") => oyentes.current.forEach((f) => f(e)), []);

  useEffect(() => {
    let vivo = true;
    let fuente: EventSource | null = null;
    let polling: number | undefined;
    let fallas = 0;
    let caidoDesde: number | null = null;
    let conectadaAntes = false;

    const recibir = (e: EventoCambio) => {
      ultimo.current = Math.max(ultimo.current ?? 0, e.id);
      emitir(e);
    };
    const reconectado = () => {
      // Después de una caída (no del corte normal de 50 s), se refresca una vez por lo que se haya perdido.
      if (conectadaAntes && caidoDesde && Date.now() - caidoDesde > CAIDA_MS) emitir("reconexion");
      caidoDesde = null;
      conectadaAntes = true;
    };
    const desde = () => (ultimo.current != null ? `desde=${ultimo.current}` : "");

    const encuestar = async () => {
      if (document.hidden || !vivo) return;
      try {
        const r = await fetch(`/api/tiempo-real/stream?modo=json&${desde()}`, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { eventos: EventoCambio[]; ultimo: number };
        if (!vivo) return;
        j.eventos.forEach(recibir);
        ultimo.current = Math.max(ultimo.current ?? 0, j.ultimo);
        setEstado("reconectando"); // en polling no es "en vivo": gris
        reconectado();
      } catch {
        caidoDesde ??= Date.now();
        setEstado(navigator.onLine ? "reconectando" : "sin-conexion");
      }
    };
    const aPolling = () => {
      fuente?.close();
      fuente = null;
      if (polling) return;
      void encuestar();
      polling = window.setInterval(encuestar, POLLING_MS);
    };

    if (typeof EventSource === "undefined") aPolling();
    else {
      fuente = new EventSource(`/api/tiempo-real/stream?${desde()}`);
      fuente.addEventListener("hola", (ev) => {
        fallas = 0;
        const id = Number((ev as MessageEvent).lastEventId);
        if (Number.isFinite(id)) ultimo.current = Math.max(ultimo.current ?? 0, id);
        setEstado("conectado");
        reconectado();
      });
      fuente.addEventListener("cambio", (ev) => {
        try {
          recibir(JSON.parse((ev as MessageEvent<string>).data) as EventoCambio);
        } catch {}
      });
      // El corte de los 50 s también llega como error: el navegador reconecta solo (con Last-Event-ID).
      fuente.addEventListener("error", () => {
        caidoDesde ??= Date.now();
        setEstado(navigator.onLine ? "reconectando" : "sin-conexion");
        if (++fallas >= FALLAS_PARA_POLLING) aPolling();
      });
    }
    const offline = () => setEstado("sin-conexion");
    window.addEventListener("offline", offline);
    return () => {
      vivo = false;
      fuente?.close();
      if (polling) window.clearInterval(polling);
      window.removeEventListener("offline", offline);
    };
  }, [emitir, vuelta]);

  // Al volver la señal o volver a la pestaña después de un rato: reconectar.
  useEffect(() => {
    const volver = () => setVuelta((v) => v + 1);
    window.addEventListener("online", volver);
    return () => window.removeEventListener("online", volver);
  }, []);

  const [, iniciar] = useTransition();
  const actualizar = useCallback(async () => {
    setActualizando(true);
    const inicio = Date.now();
    setVuelta((v) => v + 1); // reconexión del stream
    const tareas: Promise<unknown>[] = [new Promise<void>((ok) => iniciar(() => { router.refresh(); ok(); }))];
    if (CON_MAPA.test(pathname)) tareas.push(sincronizarCusatAhora().catch(() => null));
    await Promise.race([Promise.all(tareas), new Promise((ok) => setTimeout(ok, ACTUALIZAR_MAX_MS))]);
    // El ícono gira al menos medio segundo (si no, parece que no hizo nada).
    await new Promise((ok) => setTimeout(ok, Math.max(0, 500 - (Date.now() - inicio))));
    if (CON_MAPA.test(pathname)) router.refresh();
    setActualizando(false);
    aviso({ mensaje: "Actualizado" });
  }, [router, pathname, aviso]);

  const suscribir = useCallback((fn: (e: EventoCambio | "reconexion") => void) => {
    oyentes.current.add(fn);
    return () => void oyentes.current.delete(fn);
  }, []);

  return <Ctx.Provider value={{ estado, suscribir, actualizar, actualizando }}>{children}</Ctx.Provider>;
}

/** ¿Está escribiendo? (un campo de texto con foco: el refresco espera a que lo suelte). */
function escribiendo() {
  const a = document.activeElement as HTMLElement | null;
  if (!a) return false;
  if (a.isContentEditable || a.tagName === "TEXTAREA" || a.tagName === "SELECT") return true;
  return a.tagName === "INPUT" && !["button", "checkbox", "radio", "submit", "reset", "file", "range"].includes((a as HTMLInputElement).type);
}

/** Resalta 2 s las filas que cambiaron (las que tienen data-vivo-id con el id de la entidad). */
function resaltar(ids: Set<string>) {
  for (const id of ids) {
    document.querySelectorAll<HTMLElement>(`[data-vivo-id="${CSS.escape(id)}"]`).forEach((el) => {
      el.classList.remove("vivo-resaltado");
      void el.offsetWidth; // reinicia la animación si ya estaba
      el.classList.add("vivo-resaltado");
      window.setTimeout(() => el.classList.remove("vivo-resaltado"), RESALTADO_MS);
    });
  }
}

/**
 * Refresco selectivo: cuando llega un cambio de alguna de estas entidades, router.refresh() con un
 * debounce de 500 ms. Si está escribiendo, espera a que suelte el campo. Las filas cambiadas se resaltan.
 */
export function useTiempoReal(entidades: readonly EntidadCambio[]) {
  const { suscribir } = useContext(Ctx);
  const router = useRouter();
  const [vueltaResaltado, setVueltaResaltado] = useState(0);
  const clave = entidades.join(",");
  const ids = useRef(new Set<string>());
  const aResaltar = useRef(new Set<string>());

  useEffect(() => {
    const quiero = new Set(clave.split(",").filter(Boolean));
    let timer: number | undefined;
    let esperandoFoco = false;
    const refrescar = () => {
      if (escribiendo()) {
        if (esperandoFoco) return;
        esperandoFoco = true;
        document.addEventListener("focusout", () => {
          esperandoFoco = false;
          // Al soltar el campo (si no pasó a otro campo), refresca.
          window.setTimeout(() => (escribiendo() ? refrescar() : hacer()), 50);
        }, { once: true });
        return;
      }
      hacer();
    };
    const hacer = () => {
      aResaltar.current = new Set(ids.current);
      ids.current.clear();
      // Directo (no dentro de una transición propia): envolverlo demoraba varios segundos en mostrarse.
      router.refresh();
      window.setTimeout(() => setVueltaResaltado((v) => v + 1), 400);
    };
    const quitar = suscribir((e) => {
      if (e !== "reconexion" && !quiero.has(e.entidad)) return;
      if (e !== "reconexion") ids.current.add(e.entidadId);
      window.clearTimeout(timer);
      timer = window.setTimeout(refrescar, DEBOUNCE_MS);
    });
    return () => {
      quitar();
      window.clearTimeout(timer);
    };
  }, [clave, suscribir, router]);

  // Cuando terminó de llegar lo nuevo, se resalta lo que cambió.
  useEffect(() => {
    if (!aResaltar.current.size) return;
    const lista = aResaltar.current;
    aResaltar.current = new Set();
    window.requestAnimationFrame(() => resaltar(lista));
  }, [vueltaResaltado]);
}

/** Escuchar los eventos crudos (la campana, la pantalla del viaje). */
export function useEventosCambio(fn: (e: EventoCambio | "reconexion") => void) {
  const { suscribir } = useContext(Ctx);
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  }, [fn]);
  useEffect(() => suscribir((e) => ref.current(e)), [suscribir]);
}
