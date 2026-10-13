"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, History, Pencil, RotateCcw, Search, Star, X } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/basicos";
import { Entrada, MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { buscarHistorial, datosParaRepetir, marcarFavorito, quitarFavorito, renombrarFavorito } from "@/lib/historial/acciones";
import type { Favorito, ItemHistorial, PrecargaMateriales, PrecargaViaje } from "@/lib/historial/consultas";
import { diaMes } from "@/lib/formato";

type Tipo = "MATERIALES" | "VIAJE";

/**
 * "Pedidos anteriores": los últimos pedidos (propios primero) con Repetir y Ver, un buscador (material,
 * obra, número de OC) y arriba los favoritos con su nombre editable. En escritorio es la columna derecha
 * del formulario; en el celular, una hoja inferior.
 */
export function PanelHistorial({ tipo, inicial, favoritos: favIniciales, todas = false, verHref, onRepetir }: {
  tipo: Tipo; inicial: ItemHistorial[]; favoritos: Favorito[]; todas?: boolean;
  verHref: (id: string) => string;
  onRepetir: (p: PrecargaMateriales | PrecargaViaje) => void;
}) {
  const aviso = useAviso();
  const [q, setQ] = useState("");
  const [items, setItems] = useState(inicial);
  const [favs, setFavs] = useState(favIniciales);
  const [error, setError] = useState<string>();
  const [cargando, setCargando] = useState<string | null>(null);
  const primera = useRef(true);

  // Buscador en el servidor (encuentra también los pedidos más viejos que los 20 de la lista).
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    const t = window.setTimeout(async () => {
      const r = await buscarHistorial(tipo, q, todas);
      if (r.ok) setItems(r.datos);
    }, 300);
    return () => window.clearTimeout(t);
  }, [q, tipo, todas]);

  async function repetir(id: string, datos?: PrecargaMateriales | PrecargaViaje) {
    setError(undefined);
    if (datos) return onRepetir(datos);
    setCargando(id);
    const r = await datosParaRepetir(tipo, id, todas);
    setCargando(null);
    if (!r.ok) return setError(r.error);
    onRepetir(r.datos);
  }

  async function estrella(it: ItemHistorial) {
    const ya = favs.find((f) => f.pedidoId === it.id);
    if (ya) {
      const r = await quitarFavorito(ya.id);
      if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
      setFavs((xs) => xs.filter((x) => x.id !== ya.id));
      return;
    }
    const nombre = it.resumen.length > 40 ? `${it.resumen.slice(0, 40).trim()}…` : it.resumen;
    const r = await marcarFavorito({ tipo, pedidoId: it.id, nombre, todas });
    if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
    const d = await datosParaRepetir(tipo, it.id, todas);
    if (d.ok) setFavs((xs) => [{ id: r.datos.id, nombre, pedidoId: it.id, tipo, datos: d.datos }, ...xs]);
    aviso({ mensaje: "Guardado en favoritos. Tocá el lápiz para ponerle nombre." });
  }

  const resumenFecha = (iso: string) => diaMes(iso);
  return (
    <section aria-label="Pedidos anteriores" className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <History className="size-4 text-suave" />
        <h2 className="text-[15px] font-semibold">Pedidos anteriores</h2>
      </div>
      <label className="relative block">
        <span className="sr-only">Buscar en pedidos anteriores</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-suave" />
        <Entrada value={q} onChange={(e) => setQ(e.target.value)} placeholder={tipo === "MATERIALES" ? "Material, obra o número de OC" : "Qué, obra o desde dónde"} className="pl-9" />
      </label>
      <MensajeError>{error}</MensajeError>

      {favs.length > 0 && (
        <div>
          <p className="mb-1.5 etiqueta">Favoritos</p>
          <ul className="flex flex-col divide-y divide-linea rounded-md border border-linea bg-papel">
            {favs.map((f) => <FilaFavorito key={f.id} f={f} onRepetir={() => repetir(f.pedidoId, f.datos)} onCambio={(n) => setFavs((xs) => xs.map((x) => (x.id === f.id ? { ...x, nombre: n } : x)))} onQuitar={() => setFavs((xs) => xs.filter((x) => x.id !== f.id))} />)}
          </ul>
        </div>
      )}

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-linea px-3 py-6 text-center text-sm text-suave">{q ? `Nada para "${q}".` : "Todavía no hay pedidos anteriores."}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-linea rounded-md border border-linea bg-papel">
          {items.map((it) => {
            const fav = favs.some((f) => f.pedidoId === it.id);
            const soloMateriales = tipo === "VIAJE" && it.materialId !== undefined;
            return (
              <li key={it.id} className="flex flex-col gap-2 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-suave tabular-nums">#{it.numero} · <span suppressHydrationWarning>{resumenFecha(it.fecha)}</span> · Obra {it.obra}{!it.propio ? " · de otro" : ""}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm leading-snug font-medium [overflow-wrap:anywhere]">{it.resumen}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Insignia tono={it.tono}>{it.estado}</Insignia>
                      {it.oc && <span className="text-[12px] text-suave">{it.oc}</span>}
                    </div>
                  </div>
                  {!soloMateriales && (
                    <button type="button" onClick={() => estrella(it)} aria-pressed={fav} aria-label={fav ? "Sacar de favoritos" : "Guardar como favorito"} className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-black/[0.04]">
                      <Star className={`size-4 ${fav ? "fill-aviso text-aviso" : "text-suave"}`} />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {soloMateriales ? (
                    it.materialId ? <Link href={`/pedir-materiales?repetir=${it.materialId}`} className="text-sm font-medium underline">Repetir el pedido de materiales</Link> : <span className="text-sm text-suave">Retiro en proveedor: se repite desde materiales</span>
                  ) : (
                    <Boton tamano="chico" icono={<RotateCcw />} cargando={cargando === it.id} onClick={() => repetir(it.id)}>Repetir</Boton>
                  )}
                  <Link href={verHref(it.id)} className="inline-flex h-9 items-center px-2 text-sm font-medium text-suave hover:text-tinta">Ver</Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function FilaFavorito({ f, onRepetir, onCambio, onQuitar }: { f: Favorito; onRepetir: () => void; onCambio: (n: string) => void; onQuitar: () => void }) {
  const aviso = useAviso();
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(f.nombre);
  async function guardar() {
    const r = await renombrarFavorito(f.id, nombre);
    if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
    onCambio(nombre.trim());
    setEditando(false);
  }
  async function quitar() {
    const r = await quitarFavorito(f.id);
    if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
    onQuitar();
  }
  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <Star className="size-4 shrink-0 fill-aviso text-aviso" />
      {editando ? (
        <>
          <Entrada aria-label="Nombre del favorito" value={nombre} maxLength={60} autoFocus onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && guardar()} className="h-9 min-w-0 flex-1" />
          <button type="button" onClick={guardar} aria-label="Guardar nombre" className="grid size-9 place-items-center rounded-md hover:bg-black/[0.04]"><Check className="size-4" /></button>
        </>
      ) : (
        <>
          <button type="button" onClick={onRepetir} className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline">{f.nombre}</button>
          <button type="button" onClick={() => setEditando(true)} aria-label={`Cambiar el nombre de ${f.nombre}`} className="grid size-9 place-items-center rounded-md text-suave hover:bg-black/[0.04]"><Pencil className="size-4" /></button>
          <button type="button" onClick={quitar} aria-label={`Sacar ${f.nombre} de favoritos`} className="grid size-9 place-items-center rounded-md text-suave hover:bg-black/[0.04]"><X className="size-4" /></button>
          <Boton tamano="chico" variante="secundario" onClick={onRepetir}>Repetir</Boton>
        </>
      )}
    </li>
  );
}
