"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { claseBoton, type Tamano, type Variante } from "./boton";

const ContextoHoja = createContext<{ cerrar: () => void; enHoja: boolean }>({ cerrar: () => {}, enHoja: false });
export const useHoja = () => useContext(ContextoHoja);

/**
 * Hoja inferior en el celular (sube desde abajo, hasta 92% del alto) y panel lateral derecho de
 * 440px en escritorio. Es lo único flotante: lleva la sombra del sistema.
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
  // Portal al body: así ningún contenedor (header sticky, barra lateral) la tapa ni le cambia el color.
  return createPortal(
    <ContextoHoja.Provider value={{ cerrar: onCerrar, enHoja: true }}>
      <div className="fixed inset-0 z-50 flex items-end lg:items-stretch lg:justify-end">
        <button aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 bg-black/30" />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
          className="pb-segura relative flex max-h-[92dvh] w-full flex-col rounded-t-xl bg-papel text-left text-tinta shadow-[var(--shadow-flotante)] lg:h-full lg:max-h-none lg:w-[440px] lg:rounded-none lg:border-l lg:border-linea"
        >
          <div aria-hidden className="mx-auto mt-2 h-1 w-9 rounded-full bg-black/15 lg:hidden" />
          <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-linea pr-2 pl-4">
            <h2 className="text-[15px] font-semibold">{titulo}</h2>
            <button onClick={onCerrar} aria-label="Cerrar" className="grid size-10 place-items-center rounded-md text-suave hover:bg-black/[0.04] hover:text-tinta lg:size-8">
              <X className="size-5 lg:size-4" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</div>
        </div>
      </div>
    </ContextoHoja.Provider>,
    document.body,
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
