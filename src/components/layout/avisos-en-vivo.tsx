"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import type { EstadoAvisos } from "@/lib/avisos/estado";
import { useEventosCambio } from "./tiempo-real";

const TOAST_MS = 5_000;

type Contexto = { n: number; escuchar: (fn: (tipo: "aviso" | "viaje") => void) => () => void };
const Ctx = createContext<Contexto>({ n: 0, escuchar: () => () => {} });

/** Cantidad de avisos sin leer (campana), en vivo. */
export const useCantidadAvisos = () => useContext(Ctx).n;

/**
 * Para pantallas que se refrescan solas (viaje del chofer, seguimiento): llama a fn cuando llega
 * un aviso nuevo o cambia el viaje en curso del chofer.
 */
export function useAlCambiar(fn: (tipo: "aviso" | "viaje") => void) {
  const { escuchar } = useContext(Ctx);
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  }, [fn]);
  useEffect(() => escuchar((t) => ref.current(t)), [escuchar]);
}

/**
 * Avisos en vivo, sobre el stream de tiempo real (tiempo-real.tsx): cuando llega un aviso nuevo, la
 * campana cambia al instante y aparece un toast de 5 s que abre el enlace.
 */
export function AvisosEnVivo({ inicial, children }: { inicial: number; children: ReactNode }) {
  const router = useRouter();
  const [n, setN] = useState(inicial);
  const [toast, setToast] = useState<EstadoAvisos["ultima"]>(null);
  const oyentes = useRef(new Set<(t: "aviso" | "viaje") => void>());
  const previo = useRef<EstadoAvisos | null>(null);

  const recibir = useCallback((e: EstadoAvisos) => {
    const antes = previo.current;
    previo.current = e;
    setN(e.n);
    if (!antes) return; // el primero es el estado actual, no algo nuevo
    if (e.ultima && e.ultima.id !== antes.ultima?.id) {
      setToast(e.ultima);
      oyentes.current.forEach((f) => f("aviso"));
    }
    if (e.viaje !== antes.viaje) oyentes.current.forEach((f) => f("viaje"));
  }, []);

  // Un solo stream por pestaña (tiempo-real.tsx): un aviso nuevo trae el estado de la campana; un
  // cambio de viaje se lo pasa a la pantalla del viaje. Al reconectar después de una caída, también.
  const traer = useCallback(async () => {
    try {
      const r = await fetch("/api/avisos/contador", { cache: "no-store" });
      if (r.ok) recibir((await r.json()) as EstadoAvisos);
    } catch {}
  }, [recibir]);
  useEffect(() => {
    void traer(); // punto de partida (lo que ya estaba no es "nuevo")
  }, [traer]);
  useEventosCambio((e) => {
    if (e === "reconexion" || e.entidad === "AVISO") void traer();
    if (e === "reconexion" || e.entidad === "VIAJE" || e.entidad === "PEDIDO_VIAJE") oyentes.current.forEach((f) => f("viaje"));
  });

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toast]);

  const escuchar = useCallback((fn: (t: "aviso" | "viaje") => void) => {
    oyentes.current.add(fn);
    return () => void oyentes.current.delete(fn);
  }, []);

  return (
    <Ctx.Provider value={{ n, escuchar }}>
      {children}
      {toast && (
        <div role="status" className="fixed inset-x-4 top-[calc(4rem+env(safe-area-inset-top))] z-[60] mx-auto max-w-md lg:top-6 lg:right-6 lg:left-auto lg:mx-0 lg:w-96">
          <div className="flex items-start gap-3 rounded-[var(--radius-caja)] border border-linea bg-papel p-3">
            <button
              onClick={() => {
                setToast(null);
                router.push(toast.enlace ?? "/avisos");
              }}
              className="flex min-h-11 flex-1 items-start gap-3 text-left"
            >
              <Bell className="mt-0.5 size-5 shrink-0" />
              <span className="font-semibold">{toast.titulo}</span>
            </button>
            <button onClick={() => setToast(null)} aria-label="Cerrar" className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-black/5"><X className="size-4" /></button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
