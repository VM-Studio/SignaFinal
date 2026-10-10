"use client";

import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { claseCampo } from "./campos";

export type ItemCombo = { id: string; titulo: string; detalle?: string; buscar?: string };

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Elegir de una lista con buscador: se escribe y se filtra por título, detalle y lo que traiga "buscar"
 * (localidad, CUIT). Teclado: flechas y Enter. "accion" va al lado (ej. "Nueva obra").
 */
export function Combobox({ etiqueta, items, valor, onElegir, placeholder = "Buscar…", vacio = "No hay resultados", accion, ayuda }: {
  etiqueta: string; items: ItemCombo[]; valor: string | null; onElegir: (id: string | null) => void; placeholder?: string; vacio?: ReactNode; accion?: ReactNode; ayuda?: ReactNode;
}) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const lista = useRef<HTMLUListElement>(null);
  const elegido = items.find((i) => i.id === valor) ?? null;

  const filtrados = useMemo(() => {
    const q = sinAcentos(texto.trim());
    if (!q) return items;
    const palabras = q.split(/\s+/);
    return items.filter((i) => {
      const t = sinAcentos(`${i.titulo} ${i.detalle ?? ""} ${i.buscar ?? ""}`);
      return palabras.every((p) => t.includes(p));
    });
  }, [items, texto]);

  function elegir(i: ItemCombo) {
    onElegir(i.id);
    setTexto("");
    setAbierto(false);
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[12px] leading-4 font-medium text-suave">{etiqueta}</label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          {elegido && !abierto ? (
            <button type="button" id={id} onClick={() => { setAbierto(true); setTexto(""); }} className={`${claseCampo} flex items-center gap-2 text-left`}>
              <span className="min-w-0 flex-1 truncate">
                {elegido.titulo}
                {elegido.detalle && <span className="text-suave"> · {elegido.detalle}</span>}
              </span>
              <ChevronDown aria-hidden className="size-4 shrink-0 text-suave" />
            </button>
          ) : (
            <>
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-suave" />
              <input
                id={id}
                role="combobox"
                aria-expanded={abierto}
                aria-controls={`${id}-lista`}
                autoComplete="off"
                value={texto}
                placeholder={placeholder}
                className={`${claseCampo} pr-9 pl-9`}
                autoFocus={abierto && !!elegido}
                onFocus={() => setAbierto(true)}
                onBlur={() => window.setTimeout(() => setAbierto(false), 150)}
                onChange={(e) => { setTexto(e.target.value); setAbierto(true); setActivo(0); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setActivo((a) => Math.min(a + 1, filtrados.length - 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
                  if (e.key === "Enter" && filtrados[activo]) { e.preventDefault(); elegir(filtrados[activo]); }
                  if (e.key === "Escape") setAbierto(false);
                }}
              />
              {elegido && (
                <button type="button" aria-label="Quitar" onMouseDown={(e) => e.preventDefault()} onClick={() => { onElegir(null); setTexto(""); }} className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded text-suave hover:text-tinta">
                  <X className="size-4" />
                </button>
              )}
            </>
          )}
          {abierto && (
            <ul ref={lista} id={`${id}-lista`} role="listbox" className="absolute top-full right-0 left-0 z-[700] mt-1 max-h-72 overflow-y-auto rounded-md border border-linea bg-papel py-1 shadow-[var(--shadow-flotante)]">
              {filtrados.length === 0 ? (
                <li className="px-3 py-2 text-sm text-suave">{vacio}</li>
              ) : (
                filtrados.map((i, k) => (
                  <li key={i.id}>
                    <button
                      type="button" role="option" aria-selected={i.id === valor}
                      onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(i)} onMouseEnter={() => setActivo(k)}
                      className={`flex w-full flex-col px-3 py-2 text-left ${k === activo ? "bg-hover" : ""}`}
                    >
                      <span className="text-sm font-medium">{i.titulo}</span>
                      {i.detalle && <span className="text-[12px] text-suave">{i.detalle}</span>}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
        {accion}
      </div>
      {ayuda && <p className="text-[12px] text-suave">{ayuda}</p>}
    </div>
  );
}
