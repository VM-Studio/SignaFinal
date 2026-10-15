"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, Bookmark, BookmarkPlus, Check, ChevronDown, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { Hoja } from "@/components/ui/hoja";
import { Boton } from "@/components/ui/boton";
import { Entrada, Fecha, MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { borrarVista, guardarVista } from "@/lib/vistas/acciones";
import type { Vista } from "@/lib/vistas/consultas";

/**
 * BARRA DE FILTROS ÚNICA (tablero, cola de Compras, solicitudes, órdenes, pedidos): chips combinables,
 * buscador libre, orden y vistas guardadas por usuario. Todo vive en la URL (se comparte, se vuelve
 * atrás y la página se arma en el servidor con esos filtros). En escritorio, todo en UNA fila (buscador de
 * 320 px, chips, orden, Limpiar y Vistas al final): los chips que no entran pasan a un botón "Filtros (N)".
 * En el celular colapsan en un botón "Filtros" con el contador y una hoja inferior.
 *
 * Valores múltiples: "a,b,c" en la misma clave. Rango de fechas: dos claves (desde / hasta).
 */
export type Opcion = { valor: string; etiqueta: string; cantidad?: number };
export type Filtro =
  | { tipo: "opciones"; clave: string; etiqueta: string; opciones: Opcion[]; multiple?: boolean }
  | { tipo: "rango"; claveDesde: string; claveHasta: string; etiqueta: string }
  | { tipo: "si"; clave: string; etiqueta: string };

export type PropsBarra = {
  pantalla: "tablero" | "compras" | "solicitudes" | "ordenes" | "pedidos" | "coordinar" | "habilitados" | "proveedores" | "facturacion";
  filtros: Filtro[];
  buscador?: { placeholder: string };
  orden?: { opciones: Opcion[]; porDefecto: string };
  vistas?: Vista[];
  /** Parámetros que no son filtros y se conservan (pestaña, etc.). */
  conservar?: string[];
  /** Parámetros que filtran sin chip propio (las tarjetas del tablero): cuentan, se limpian y se guardan en las vistas. */
  otrasClaves?: string[];
};

const separar = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);
const fechaCorta = (s: string) => s.split("-").reverse().slice(0, 2).join("/");

export function BarraFiltros({ pantalla, filtros, buscador, orden, vistas = [], conservar = [], otrasClaves = [] }: PropsBarra) {
  const router = useRouter();
  const ruta = usePathname();
  const sp = useSearchParams();
  const [pendiente, transicion] = useTransition();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [hoja, setHoja] = useState(false);
  const [q, setQ] = useState(sp.get("q") ?? "");
  useEffect(() => setQ(sp.get("q") ?? ""), [sp]);

  const claves = useMemo(() => new Set(filtros.flatMap((f) => (f.tipo === "rango" ? [f.claveDesde, f.claveHasta] : [f.clave])).concat(["q", "orden"], otrasClaves)), [filtros, otrasClaves]);
  const tieneValor = (f: Filtro) => !!(f.tipo === "rango" ? sp.get(f.claveDesde) || sp.get(f.claveHasta) : sp.get(f.clave));
  const activos = filtros.filter(tieneValor).length + (sp.get("q") ? 1 : 0) + otrasClaves.filter((k) => sp.get(k)).length;

  // Escritorio: cuántos chips entran en la fila (se miden en una copia invisible); el resto va a "Filtros (N)".
  const areaRef = useRef<HTMLDivElement>(null);
  const medidaRef = useRef<HTMLDivElement>(null);
  const [entran, setEntran] = useState(filtros.length);
  useLayoutEffect(() => {
    const area = areaRef.current;
    const medida = medidaRef.current;
    if (!area || !medida) return;
    const calcular = () => {
      const disponible = area.clientWidth;
      const anchos = Array.from(medida.children, (c) => (c as HTMLElement).offsetWidth);
      const GAP = 8;
      const BOTON = 112; // "Filtros (N)"
      let usado = 0;
      let n = 0;
      for (const w of anchos) {
        if (usado + (n ? GAP : 0) + w > disponible) break;
        usado += (n ? GAP : 0) + w;
        n++;
      }
      if (n < anchos.length) {
        while (n > 0 && usado + GAP + BOTON > disponible) {
          usado -= anchos[n - 1] + (n > 1 ? GAP : 0);
          n--;
        }
      }
      setEntran(n);
    };
    calcular();
    const ro = new ResizeObserver(calcular);
    ro.observe(area);
    return () => ro.disconnect();
  }, [filtros, sp]);

  /** Cambia parámetros y vuelve a la primera página (sin cerrar el panel abierto). */
  function ir(cambios: Record<string, string | null>, reemplazar = false) {
    const n = new URLSearchParams(reemplazar ? "" : sp.toString());
    if (reemplazar) for (const k of conservar) if (sp.get(k)) n.set(k, sp.get(k)!);
    for (const [k, v] of Object.entries(cambios)) {
      if (v == null || v === "") n.delete(k);
      else n.set(k, v);
    }
    n.delete("pagina");
    n.delete("ver");
    const s = n.toString();
    transicion(() => router.replace(s ? `${ruta}?${s}` : ruta, { scroll: false }));
  }
  const limpiar = () => ir(Object.fromEntries([...claves].map((k) => [k, null])));

  const valorChip = (f: Filtro) => {
    if (f.tipo === "rango") {
      const d = sp.get(f.claveDesde), h = sp.get(f.claveHasta);
      return d && h ? `${fechaCorta(d)} a ${fechaCorta(h)}` : d ? `desde ${fechaCorta(d)}` : h ? `hasta ${fechaCorta(h)}` : null;
    }
    if (f.tipo === "si") return sp.get(f.clave) ? "Sí" : null;
    const elegidos = separar(sp.get(f.clave));
    if (!elegidos.length) return null;
    const primero = f.opciones.find((o) => o.valor === elegidos[0])?.etiqueta ?? elegidos[0];
    return elegidos.length > 1 ? `${primero} +${elegidos.length - 1}` : primero;
  };

  const panel = (f: Filtro) => {
    if (f.tipo === "si") {
      return (
        <button type="button" onClick={() => ir({ [f.clave]: sp.get(f.clave) ? null : "1" })} className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-sm hover:bg-hover lg:min-h-9">
          <span className={`grid size-4 place-items-center rounded border ${sp.get(f.clave) ? "border-tinta bg-tinta text-white" : "border-linea-fuerte"}`}>{sp.get(f.clave) && <Check className="size-3" />}</span>
          {f.etiqueta}
        </button>
      );
    }
    if (f.tipo === "rango") {
      return (
        <div className="grid grid-cols-2 gap-2 p-1">
          <label className="text-[12px] text-suave">Desde<Fecha value={sp.get(f.claveDesde) ?? ""} onChange={(e) => ir({ [f.claveDesde]: e.target.value || null })} /></label>
          <label className="text-[12px] text-suave">Hasta<Fecha value={sp.get(f.claveHasta) ?? ""} onChange={(e) => ir({ [f.claveHasta]: e.target.value || null })} /></label>
        </div>
      );
    }
    const elegidos = separar(sp.get(f.clave));
    const alternar = (v: string) => {
      const nuevos = f.multiple === false ? (elegidos.includes(v) ? [] : [v]) : elegidos.includes(v) ? elegidos.filter((x) => x !== v) : [...elegidos, v];
      ir({ [f.clave]: nuevos.join(",") || null });
    };
    return (
      <ul className="max-h-72 overflow-y-auto">
        {f.opciones.length === 0 && <li className="px-3 py-2 text-sm text-suave">Sin opciones.</li>}
        {f.opciones.map((o) => {
          const si = elegidos.includes(o.valor);
          return (
            <li key={o.valor}>
              <button type="button" onClick={() => alternar(o.valor)} aria-pressed={si} className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-sm hover:bg-hover lg:min-h-8">
                <span className={`grid size-4 shrink-0 place-items-center rounded border ${si ? "border-tinta bg-tinta text-white" : "border-linea-fuerte"}`}>{si && <Check className="size-3" />}</span>
                <span className="min-w-0 flex-1 truncate">{o.etiqueta}</span>
                {o.cantidad != null && <span className="text-[12px] text-suave tabular-nums">{o.cantidad}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  const nombreFiltro = (f: Filtro) => (f.tipo === "rango" ? f.claveDesde : f.clave);

  return (
    <div className={`mb-4 flex flex-col gap-2 ${pendiente ? "opacity-70" : ""}`} aria-busy={pendiente}>
      <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
        {buscador && (
          <form className="relative min-w-0 flex-1 basis-40 lg:w-80 lg:flex-none lg:basis-auto" onSubmit={(e) => { e.preventDefault(); ir({ q: q.trim() || null }); }}>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-suave" />
            <Entrada type="search" aria-label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => (q.trim() || null) !== sp.get("q") && ir({ q: q.trim() || null })} placeholder={buscador.placeholder} className="pl-9" />
          </form>
        )}
        {/* Celular: un botón con el contador. */}
        {(filtros.length > 0 || orden) && <button type="button" onClick={() => setHoja(true)} className="inline-flex h-11 items-center gap-2 rounded-md border border-linea bg-papel px-3 text-sm font-medium lg:hidden">
          <SlidersHorizontal className="size-4" /> Filtros{activos ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-tinta px-1 text-[11px] text-white">{activos}</span> : null}
        </button>}
        {/* Escritorio: los chips que entran en la fila; los demás, en "Filtros (N)". */}
        <div ref={areaRef} className="relative hidden min-w-0 flex-1 items-center gap-2 lg:flex">
          <div ref={medidaRef} aria-hidden className="pointer-events-none invisible absolute top-0 left-0 flex gap-2 whitespace-nowrap">
            {filtros.map((f) => {
              const v = valorChip(f);
              return <span key={nombreFiltro(f)} className="inline-flex h-8 items-center gap-1 rounded-full border pr-2 pl-3 text-[13px]">{f.etiqueta}{v && <span className="max-w-40 truncate font-medium">: {v}</span>}<span className="size-3.5" />{v && <span className="size-3.5" />}</span>;
            })}
          </div>
          {filtros.slice(0, entran).map((f) => {
            const v = valorChip(f);
            const k = nombreFiltro(f);
            return (
              <Chip key={k} etiqueta={f.etiqueta} valor={v} abierto={abierto === k} onAbrir={() => setAbierto(abierto === k ? null : k)} onCerrar={() => setAbierto(null)}
                onQuitar={v ? () => ir(f.tipo === "rango" ? { [f.claveDesde]: null, [f.claveHasta]: null } : { [f.clave]: null }) : undefined}>
                {panel(f)}
              </Chip>
            );
          })}
          {entran < filtros.length && (() => {
            const resto = filtros.slice(entran);
            const n = resto.filter(tieneValor).length;
            return (
              <Chip etiqueta={`Filtros${n ? ` (${n})` : ""}`} icono={<SlidersHorizontal className="size-3.5" />} valor={null} resaltado={n > 0} abierto={abierto === "mas"} onAbrir={() => setAbierto(abierto === "mas" ? null : "mas")} onCerrar={() => setAbierto(null)} ancho="w-80">
                <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto p-1">
                  {resto.map((f) => (
                    <section key={nombreFiltro(f)}>
                      <p className="etiqueta px-2 pb-1">{f.etiqueta}</p>
                      {panel(f)}
                    </section>
                  ))}
                </div>
              </Chip>
            );
          })()}
        </div>
        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          {orden && (
            <Chip etiqueta="" icono={<ArrowUpDown className="size-3.5" />} valor={orden.opciones.find((o) => o.valor === (sp.get("orden") ?? orden.porDefecto))?.etiqueta ?? null} abierto={abierto === "orden"} onAbrir={() => setAbierto(abierto === "orden" ? null : "orden")} onCerrar={() => setAbierto(null)} siempre alinear="derecha">
              <ul>
                {orden.opciones.map((o) => (
                  <li key={o.valor}>
                    <button type="button" onClick={() => { ir({ orden: o.valor === orden.porDefecto ? null : o.valor }); setAbierto(null); }} className="flex min-h-8 w-full items-center gap-2 rounded-md px-3 text-left text-sm hover:bg-hover">
                      <Check className={`size-4 ${(sp.get("orden") ?? orden.porDefecto) === o.valor ? "" : "invisible"}`} /> {o.etiqueta}
                    </button>
                  </li>
                ))}
              </ul>
            </Chip>
          )}
          <button type="button" onClick={limpiar} disabled={!activos} className="h-8 rounded-md px-2 text-[13px] font-medium text-suave hover:text-tinta disabled:cursor-default disabled:opacity-40 disabled:hover:text-suave">Limpiar</button>
        </div>
        <Vistas pantalla={pantalla} vistas={vistas} activos={activos} claves={claves} onAplicar={(p) => ir(p, true)} />
      </div>

      {/* Celular: chips activos debajo (se quitan con un toque) */}
      {activos > 0 && (
        <div className="flex flex-wrap gap-1.5 lg:hidden">
          {filtros.map((f) => {
            const v = valorChip(f);
            if (!v) return null;
            return (
              <button key={nombreFiltro(f)} type="button" onClick={() => ir(f.tipo === "rango" ? { [f.claveDesde]: null, [f.claveHasta]: null } : { [f.clave]: null })} className="inline-flex h-8 items-center gap-1 rounded-full border border-linea-fuerte bg-papel px-3 text-[13px]">
                {f.etiqueta}: <span className="font-medium">{v}</span> <X className="size-3.5" />
              </button>
            );
          })}
        </div>
      )}

      <Hoja abierta={hoja} onCerrar={() => setHoja(false)} titulo={`Filtros${activos ? ` (${activos})` : ""}`}>
        <div className="flex flex-col gap-5">
          {filtros.map((f) => (
            <section key={nombreFiltro(f)}>
              <p className="etiqueta mb-1">{f.etiqueta}</p>
              {panel(f)}
            </section>
          ))}
          {orden && (
            <section>
              <p className="etiqueta mb-1">Orden</p>
              <select className="h-11 w-full rounded-md border border-linea bg-papel px-3 text-base" value={sp.get("orden") ?? orden.porDefecto} onChange={(e) => ir({ orden: e.target.value === orden.porDefecto ? null : e.target.value })}>
                {orden.opciones.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
              </select>
            </section>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Boton variante="secundario" onClick={limpiar} disabled={!activos}>Limpiar</Boton>
            <Boton onClick={() => setHoja(false)}>Ver resultados</Boton>
          </div>
        </div>
      </Hoja>
    </div>
  );
}

function Chip({ etiqueta, valor, abierto, onAbrir, onCerrar, onQuitar, children, icono, siempre = false, resaltado = false, ancho = "w-64", alinear = "izquierda" }: {
  etiqueta: string; valor: string | null; abierto: boolean; onAbrir: () => void; onCerrar: () => void; onQuitar?: () => void; children: React.ReactNode; icono?: React.ReactNode; siempre?: boolean;
  resaltado?: boolean; ancho?: string; alinear?: "izquierda" | "derecha";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onCerrar(); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", esc); };
  }, [abierto, onCerrar]);
  const activo = (!!valor && !siempre) || resaltado;
  return (
    <div ref={ref} className="relative shrink-0">
      <div className={`inline-flex h-8 items-center rounded-full border text-[13px] ${activo ? "border-tinta bg-tinta/[0.04]" : "border-linea bg-papel"}`}>
        <button type="button" onClick={onAbrir} aria-expanded={abierto} aria-label={etiqueta ? undefined : `Orden: ${valor ?? ""}`} className="inline-flex h-full items-center gap-1 pr-2 pl-3">
          {icono}
          {etiqueta && <span className={activo ? "text-suave" : ""}>{etiqueta}</span>}
          {valor && <span className={`truncate font-medium ${siempre ? "" : "max-w-40"}`}>{activo ? `: ${valor}` : valor}</span>}
          {!onQuitar && <ChevronDown className="size-3.5 text-suave" />}
        </button>
        {onQuitar && (
          <button type="button" onClick={onQuitar} aria-label={`Quitar ${etiqueta}`} className="grid h-full place-items-center pr-2 text-suave hover:text-tinta"><X className="size-3.5" /></button>
        )}
      </div>
      {abierto && (
        <div className={`absolute top-9 z-30 ${ancho} ${alinear === "derecha" ? "right-0" : "left-0"} rounded-[var(--radius-caja)] border border-linea bg-papel p-1 shadow-[var(--shadow-flotante)]`}>{children}</div>
      )}
    </div>
  );
}

function Vistas({ pantalla, vistas, activos, claves, onAplicar }: { pantalla: PropsBarra["pantalla"]; vistas: Vista[]; activos: number; claves: Set<string>; onAplicar: (p: Record<string, string>) => void }) {
  const router = useRouter();
  const sp = useSearchParams();
  const aviso = useAviso();
  const [abierta, setAbierta] = useState(false);
  const [guardar, setGuardar] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string>();
  const actual = Object.fromEntries([...sp.entries()].filter(([k]) => claves.has(k)));
  const coincide = (v: Vista) => JSON.stringify(Object.entries(v.parametros).filter(([k]) => claves.has(k)).sort()) === JSON.stringify(Object.entries(actual).sort());
  const activa = vistas.find(coincide);
  return (
    <>
      <button type="button" onClick={() => setAbierta(true)} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-linea bg-papel px-3 text-sm font-medium lg:h-8 lg:rounded-full lg:text-[13px]">
        <Bookmark className="size-4 lg:size-3.5" /> <span className={activa ? "max-w-28 truncate" : "sr-only lg:not-sr-only"}>{activa ? activa.nombre : "Vistas"}</span>
      </button>
      <Hoja abierta={abierta} onCerrar={() => { setAbierta(false); setGuardar(false); }} titulo="Vistas guardadas">
        <div className="flex flex-col gap-4">
          {vistas.length === 0 && <p className="text-sm text-suave">Todavía no guardaste ninguna. Elegí los filtros y guardalos con un nombre (“Pendientes de retiro”, “Pinares”).</p>}
          <ul className="divide-y divide-linea rounded-[var(--radius-caja)] border border-linea">
            {vistas.map((v) => (
              <li key={v.id} className="flex min-h-12 items-center gap-2 px-3 lg:min-h-10">
                <button type="button" className="min-w-0 flex-1 truncate text-left text-sm font-medium" onClick={() => { onAplicar(v.parametros); setAbierta(false); }}>
                  {coincide(v) && <Check className="mr-1 inline size-4" />}{v.nombre}
                </button>
                <button type="button" aria-label={`Borrar ${v.nombre}`} className="grid size-9 place-items-center rounded-md text-suave hover:text-critico" onClick={async () => {
                  const r = await borrarVista(v.id);
                  if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
                  router.refresh();
                }}><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
          {guardar ? (
            <div className="flex flex-col gap-2">
              <Entrada aria-label="Nombre de la vista" placeholder="Ej.: Pendientes de retiro" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} autoFocus />
              <MensajeError>{error}</MensajeError>
              <Boton disabled={nombre.trim().length < 2} onClick={async () => {
                setError(undefined);
                const r = await guardarVista({ pantalla, nombre, parametros: actual });
                if (!r.ok) return setError(r.error);
                aviso({ mensaje: `Vista “${nombre.trim()}” guardada.` });
                setNombre("");
                setGuardar(false);
                router.refresh();
              }}>Guardar</Boton>
            </div>
          ) : (
            <Boton variante="secundario" icono={<BookmarkPlus />} disabled={!activos} onClick={() => setGuardar(true)}>{activos ? "Guardar los filtros de ahora como vista" : "Elegí filtros para guardar una vista"}</Boton>
          )}
        </div>
      </Hoja>
    </>
  );
}
