"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { claseBoton } from "./boton";

const ContextoPanel = createContext<{ cerrar: () => void; enPanel: boolean }>({ cerrar: () => {}, enPanel: false });
export const usePanel = () => useContext(ContextoPanel);

/**
 * Formulario en panel: en celular ocupa toda la pantalla, en escritorio es un
 * panel lateral derecho de 480px sobre el listado.
 */
export function Panel({ abierto, onCerrar, titulo, children }: { abierto: boolean; onCerrar: () => void; titulo: string; children: ReactNode }) {
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", alTeclear);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = previo;
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  return (
    <ContextoPanel.Provider value={{ cerrar: onCerrar, enPanel: true }}>
      <div className="fixed inset-0 z-50 flex justify-end">
        <button aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 hidden bg-black/40 lg:block" />
        <div role="dialog" aria-modal="true" aria-label={titulo} className="relative flex h-full w-full flex-col bg-fondo lg:w-[480px] lg:border-l lg:border-linea">
          <header className="pt-segura flex shrink-0 items-center justify-between gap-3 bg-negro px-4 text-white lg:bg-papel lg:text-tinta lg:border-b lg:border-linea">
            <h2 className="py-4 text-lg font-bold">{titulo}</h2>
            <button onClick={onCerrar} aria-label="Cerrar" className="grid size-12 place-items-center rounded-md hover:bg-white/10 lg:hover:bg-black/5">
              <X className="size-6" />
            </button>
          </header>
          <div className="pb-segura flex-1 overflow-y-auto p-4 lg:p-6">{children}</div>
        </div>
      </div>
    </ContextoPanel.Provider>
  );
}

/** Botón que abre un panel con el contenido dado (el contenido puede usar usePanel().cerrar). */
export function ConPanel({
  titulo,
  etiqueta,
  icono,
  variante = "primario",
  tamano = "normal",
  ancho = false,
  children,
}: {
  titulo: string;
  etiqueta: ReactNode;
  icono?: ReactNode;
  variante?: "primario" | "secundario" | "fantasma" | "peligro";
  tamano?: "normal" | "grande" | "chico";
  ancho?: boolean;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className={claseBoton(variante, tamano, ancho)}>
        {icono}
        {etiqueta}
      </button>
      <Panel abierto={abierto} onCerrar={() => setAbierto(false)} titulo={titulo}>
        {children}
      </Panel>
    </>
  );
}
