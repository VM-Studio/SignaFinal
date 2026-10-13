"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronsRight, Loader2 } from "lucide-react";

/** Hay que llevar el pulgar al menos hasta acá (90 % del recorrido) para que cuente. */
export const UMBRAL_DESLIZADOR = 0.9;

/**
 * DESLIZADOR del modo conducción (como Uber): pista de 64 px con un pulgar que se arrastra hasta el
 * final para confirmar. Un toque o un arrastre corto no hace nada: si suelta antes del 90 %, vuelve.
 * Verde cuando el GPS detectó la llegada. Con teclado: flecha derecha avanza de a 10 %.
 */
export function Deslizador({ texto, verde = false, onCompletar, deshabilitado = false }: {
  texto: string; verde?: boolean; onCompletar: () => Promise<unknown> | void; deshabilitado?: boolean;
}) {
  const pista = useRef<HTMLDivElement>(null);
  const inicio = useRef<{ x: number; base: number } | null>(null);
  const [x, setX] = useState(0); // px desde la izquierda
  const [max, setMax] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [volviendo, setVolviendo] = useState(false);
  const PULGAR = 56;

  useEffect(() => {
    const medir = () => setMax(Math.max(0, (pista.current?.clientWidth ?? 0) - PULGAR - 8));
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);
  // Cambió lo que pide (otra parada, llegada detectada): el pulgar vuelve al principio.
  useEffect(() => {
    setX(0);
    setEnviando(false);
  }, [texto]);

  async function completar() {
    setX(max);
    setEnviando(true);
    try {
      await onCompletar();
    } finally {
      setEnviando(false);
      setVolviendo(true);
      setX(0);
    }
  }
  const soltar = () => {
    if (!inicio.current) return;
    inicio.current = null;
    if (max > 0 && x >= max * UMBRAL_DESLIZADOR) void completar();
    else {
      setVolviendo(true);
      setX(0);
    }
  };
  const progreso = max ? x / max : 0;
  const bloqueado = deshabilitado || enviando;

  return (
    <div
      ref={pista}
      data-sin-arrastre
      role="slider"
      aria-label={texto}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progreso * 100)}
      aria-disabled={bloqueado}
      tabIndex={bloqueado ? -1 : 0}
      onKeyDown={(e) => {
        if (bloqueado || e.key !== "ArrowRight") return;
        const nuevo = Math.min(max, x + max * 0.1);
        setVolviendo(false);
        setX(nuevo);
        if (nuevo >= max * UMBRAL_DESLIZADOR) void completar();
      }}
      className={`relative h-16 w-full touch-none select-none overflow-hidden rounded-full border outline-none focus-visible:ring-4 focus-visible:ring-white/40 ${verde ? "border-ok bg-ok" : "border-white/20 bg-white/10"} ${bloqueado ? "opacity-70" : ""}`}
    >
      {/* Relleno que acompaña al pulgar. */}
      <div aria-hidden className={`absolute inset-y-0 left-0 ${verde ? "bg-white/15" : "bg-white/10"}`} style={{ width: x + PULGAR + 4 }} />
      <p aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center pr-4 pl-16 text-center text-[15px] leading-tight font-semibold" style={{ opacity: 1 - progreso * 0.9 }}>
        {texto}
      </p>
      <div
        aria-hidden
        onPointerDown={(e) => {
          if (bloqueado) return;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          inicio.current = { x: e.clientX, base: x };
          setVolviendo(false);
        }}
        onPointerMove={(e) => {
          if (!inicio.current) return;
          setX(Math.min(max, Math.max(0, inicio.current.base + e.clientX - inicio.current.x)));
        }}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        className={`absolute top-1 left-1 grid size-14 cursor-grab place-items-center rounded-full bg-white text-negro active:cursor-grabbing ${volviendo ? "transition-transform duration-300 ease-out" : ""}`}
        style={{ transform: `translateX(${x}px)` }}
        onTransitionEnd={() => setVolviendo(false)}
      >
        {enviando ? <Loader2 className="size-6 animate-spin" /> : <ChevronsRight className="size-7" strokeWidth={2.25} />}
      </div>
    </div>
  );
}
