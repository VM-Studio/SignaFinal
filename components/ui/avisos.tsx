"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

type Aviso = {
  id: number;
  mensaje: string;
  tono: "ok" | "error";
  deshacer?: () => Promise<void> | void;
  segundos: number;
};

type Mostrar = (a: { mensaje: string; tono?: "ok" | "error"; deshacer?: Aviso["deshacer"]; segundos?: number }) => void;

const Contexto = createContext<Mostrar>(() => {});

/** Confirmación con un toque: la acción ya se hizo, y durante 10 segundos se puede deshacer. */
export const SEGUNDOS_DESHACER = 10;

export function useAviso() {
  return useContext(Contexto);
}

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [restante, setRestante] = useState(0);
  const [deshaciendo, setDeshaciendo] = useState(false);
  const contador = useRef(0);

  const mostrar = useCallback<Mostrar>(({ mensaje, tono = "ok", deshacer, segundos }) => {
    const s = segundos ?? (deshacer ? SEGUNDOS_DESHACER : tono === "error" ? 7 : 4);
    contador.current += 1;
    setAviso({ id: contador.current, mensaje, tono, deshacer, segundos: s });
    setRestante(s);
    setDeshaciendo(false);
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setInterval(() => {
      setRestante((r) => {
        if (r <= 1) {
          window.clearInterval(t);
          setAviso((a) => (a?.id === aviso.id ? null : a));
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [aviso]);

  async function alDeshacer() {
    if (!aviso?.deshacer) return;
    setDeshaciendo(true);
    try {
      await aviso.deshacer();
    } finally {
      setAviso(null);
    }
  }

  return (
    <Contexto.Provider value={mostrar}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[60] flex justify-center px-3 lg:bottom-6 lg:left-60">
        {aviso && (
          <div
            role="status"
            className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-[var(--radius-caja)] px-4 py-3 text-white ${aviso.tono === "error" ? "bg-critico" : "bg-negro"}`}
          >
            {aviso.tono === "error" ? <AlertTriangle className="size-5 shrink-0" /> : <CheckCircle2 className="size-5 shrink-0" />}
            <p className="min-w-0 flex-1 font-medium">{aviso.mensaje}</p>
            {aviso.deshacer ? (
              <button
                onClick={alDeshacer}
                disabled={deshaciendo}
                className="min-h-11 shrink-0 rounded-md bg-white px-3 font-bold text-negro disabled:opacity-50"
              >
                {deshaciendo ? "…" : `Deshacer (${restante})`}
              </button>
            ) : (
              <button onClick={() => setAviso(null)} aria-label="Cerrar" className="grid size-11 shrink-0 place-items-center">
                <X className="size-5" />
              </button>
            )}
          </div>
        )}
      </div>
    </Contexto.Provider>
  );
}
