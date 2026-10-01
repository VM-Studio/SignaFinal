"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { claseBoton, type Tamano, type Variante } from "./boton";

const ContextoHoja = createContext<{ cerrar: () => void; enHoja: boolean }>({ cerrar: () => {}, enHoja: false });
export const useHoja = () => useContext(ContextoHoja);

/**
 * Hoja inferior en el celular (sube desde abajo, hasta 92% del alto)
 * y panel lateral derecho de 440px en escritorio.
 */
export function Hoja({ abierta, onCerrar, titulo, children }: { abierta: boolean; onCerrar: () => void; titulo: string; children: ReactNode }) {
  useEffect(() => {
    if (!abierta) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", tecla);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = previo;
    };
  }, [abierta, onCerrar]);

  if (!abierta) return null;
  return (
    <ContextoHoja.Provider value={{ cerrar: onCerrar, enHoja: true }}>
      <div className="fixed inset-0 z-50 flex items-end lg:items-stretch lg:justify-end">
        <button aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 bg-black/45" />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
          className="pb-segura relative flex max-h-[92dvh] w-full flex-col text-left rounded-t-2xl bg-fondo lg:h-full lg:max-h-none lg:w-[440px] lg:rounded-none lg:border-l lg:border-linea"
        >
          <div aria-hidden className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-black/20 lg:hidden" />
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-linea px-4 py-1 lg:py-3">
            <h2 className="text-lg font-bold">{titulo}</h2>
            <button onClick={onCerrar} aria-label="Cerrar" className="grid size-12 place-items-center rounded-md hover:bg-black/5">
              <X className="size-6" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</div>
        </div>
      </div>
    </ContextoHoja.Provider>
  );
}

/** Botón que abre una hoja con el contenido dado. */
export function ConHoja({ titulo, etiqueta, icono, variante = "primario", tamano = "normal", ancho = false, children }: {
  titulo: string; etiqueta: ReactNode; icono?: ReactNode; variante?: Variante; tamano?: Tamano; ancho?: boolean; children: ReactNode;
}) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAbierta(true)} className={claseBoton(variante, tamano, ancho)}>
        {icono}
        {etiqueta}
      </button>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo={titulo}>
        {children}
      </Hoja>
    </>
  );
}
