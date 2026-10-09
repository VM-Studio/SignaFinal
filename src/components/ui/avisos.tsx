"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

/** La acción ya se hizo con un toque; durante 10 segundos se puede deshacer. */
export const SEGUNDOS_DESHACER = 10;

type Aviso = { id: number; mensaje: string; tono: "ok" | "error"; deshacer?: () => Promise<void> | void; segundos: number };
type Mostrar = (a: { mensaje: string; tono?: "ok" | "error"; deshacer?: Aviso["deshacer"] }) => void;

const Contexto = createContext<Mostrar>(() => {});
export const useAviso = () => useContext(Contexto);

let siguiente = 0;

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [restante, setRestante] = useState(0);
  const [deshaciendo, setDeshaciendo] = useState(false);

  const mostrar = useCallback<Mostrar>(({ mensaje, tono = "ok", deshacer }) => {
    const segundos = deshacer ? SEGUNDOS_DESHACER : tono === "error" ? 7 : 4;
    setAviso({ id: ++siguiente, mensaje, tono, deshacer, segundos });
    setRestante(segundos);
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

  async function deshacer() {
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
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 lg:bottom-6 lg:left-[232px]">
        {aviso && (
          <div role="status" className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-[var(--radius-caja)] px-4 py-2.5 text-white shadow-[var(--shadow-flotante)] ${aviso.tono === "error" ? "bg-critico" : "bg-negro"}`}>
            {aviso.tono === "error" ? <AlertTriangle className="size-4 shrink-0" /> : <CheckCircle2 className="size-4 shrink-0" />}
            <p className="min-w-0 flex-1 text-sm font-medium">{aviso.mensaje}</p>
            {aviso.deshacer ? (
              <button onClick={deshacer} disabled={deshaciendo} className="min-h-9 shrink-0 rounded-md bg-white px-3 text-sm font-medium text-negro disabled:opacity-50">
                {deshaciendo ? "…" : `Deshacer (${restante})`}
              </button>
            ) : (
              <button onClick={() => setAviso(null)} aria-label="Cerrar" className="grid size-9 shrink-0 place-items-center">
                <X className="size-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </Contexto.Provider>
  );
}
