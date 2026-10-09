"use client";

import { useMemo, useState } from "react";
import { Printer, Search } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Entrada } from "@/components/ui/campos";

type Item = { id: string; codigo: string; nombre: string; esMaquina: boolean; tipoControl: string; categoria: string };

/** Elegir varias y abrir la hoja A4 para imprimir. */
export function ElegirEtiquetas({ items }: { items: Item[] }) {
  const [q, setQ] = useState("");
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const visibles = useMemo(() => items.filter((i) => !q || `${i.codigo} ${i.nombre} ${i.categoria}`.toLowerCase().includes(q.toLowerCase())), [items, q]);
  const todasVisibles = visibles.length > 0 && visibles.every((i) => elegidas.has(i.id));
  const cambiar = (id: string) => setElegidas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-suave" />
        <Entrada type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, código o categoría" className="pl-11" aria-label="Buscar" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Boton variante="secundario" tamano="chico" onClick={() => setElegidas((s) => { const n = new Set(s); visibles.forEach((i) => (todasVisibles ? n.delete(i.id) : n.add(i.id))); return n; })}>
          {todasVisibles ? "Quitar las visibles" : `Elegir las ${visibles.length} visibles`}
        </Boton>
        <Boton variante="secundario" tamano="chico" onClick={() => setElegidas(new Set(items.filter((i) => i.esMaquina).map((i) => i.id)))}>Solo maquinaria</Boton>
        {elegidas.size > 0 && <Boton variante="fantasma" tamano="chico" onClick={() => setElegidas(new Set())}>Limpiar</Boton>}
      </div>
      <ul className="max-h-[55dvh] divide-y divide-linea overflow-y-auto rounded-[var(--radius-caja)] border border-linea bg-papel">
        {visibles.map((i) => (
          <li key={i.id}>
            <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4">
              <input type="checkbox" checked={elegidas.has(i.id)} onChange={() => cambiar(i.id)} className="size-6 accent-negro" />
              <span className="w-24 shrink-0 font-semibold tabular-nums">{i.codigo}</span>
              <span className="min-w-0 flex-1 truncate">{i.nombre}</span>
              <span className="hidden text-sm text-suave sm:block">{i.categoria}</span>
            </label>
          </li>
        ))}
      </ul>
      <Boton ancho disabled={!elegidas.size} icono={<Printer />} onClick={() => window.open(`/imprimir/etiquetas?ids=${[...elegidas].join(",")}`, "_blank")}>
        Generar hoja A4 ({elegidas.size} etiqueta{elegidas.size === 1 ? "" : "s"})
      </Boton>
    </div>
  );
}
