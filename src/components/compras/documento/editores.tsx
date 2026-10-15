"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Loader2, Paperclip, PlusCircle, Search, X } from "lucide-react";
import type { Celda, TipoCelda } from "@/lib/compras/permisosCeldas";
import type { ListasPlantilla } from "@/lib/compras/documento-consultas";
import type { ProveedorConSucursales } from "@/lib/proveedores/acciones";
import { crearSolicitanteExterno } from "@/lib/compras/configuracion";
import { Hoja } from "@/components/ui/hoja";
import { FormularioProveedor, FormularioSucursal } from "@/components/proveedores/formularios";
import { subirUno } from "@/components/adjuntos/subir";

/**
 * EDITORES EN LÍNEA de la plantilla: cada celda se edita ahí mismo, sin modales. Texto y texto largo (crece),
 * fecha, importe ("A confirmar", ARS/USD), y para obra, persona, razón social, proveedor (con sucursal) y
 * formas de pago un MENÚ FLOTANTE sobre la celda. "Nuevo proveedor" y "Agregar sucursal" abren la hoja
 * lateral y, al guardar, dejan la celda completada.
 */
export type PropsEditor = {
  celda: Celda;
  tipo: TipoCelda;
  valor: string;
  texto: string;
  editable: boolean;
  /** inmediato: guardar sin esperar (listas, fechas); si no, la plantilla espera 800 ms. */
  onCambio: (v: string, inmediato?: boolean) => void;
  listas: ListasPlantilla & { proveedoresVivos: ProveedorConSucursales[]; agregarProveedor: (p: ProveedorConSucursales) => void };
  /** Compras solo marca o desmarca Acopio en Forma de Pago. */
  soloAcopio?: boolean;
  /** Factura: el nombre del archivo ya adjunto. */
  archivo?: { id: string; nombre: string } | null;
  ocId: string;
};

const CAMPO = "h-full min-h-[inherit] w-full bg-transparent px-1.5 text-[inherit] outline-none placeholder:text-[#9ca3af]";

export function EditorCelda(p: PropsEditor) {
  const { tipo, valor, texto, editable, onCambio } = p;
  if (tipo === "lectura" || !editable) {
    if (tipo === "archivo" && p.archivo) return <a href={`/api/adjuntos/${p.archivo.id}`} target="_blank" rel="noopener" className="truncate px-1.5 underline">{p.archivo.nombre}</a>;
    return <span className={`block w-full px-1.5 ${tipo === "textoLargo" ? "self-start py-1 whitespace-pre-wrap" : "truncate"}`} title={texto || undefined}>{texto}</span>;
  }
  switch (tipo) {
    case "texto":
      return <input aria-label={p.celda} className={CAMPO} value={valor} maxLength={200} onChange={(e) => onCambio(e.target.value)} />;
    case "textoLargo":
      return <TextoLargo valor={valor} onCambio={onCambio} etiqueta={p.celda} />;
    case "fecha":
      return <input type="date" aria-label={p.celda} className={`${CAMPO} tabular-nums`} value={valor} onChange={(e) => onCambio(e.target.value, true)} />;
    case "dinero":
      return <Dinero valor={valor} onCambio={(v) => onCambio(v)} etiqueta={p.celda} />;
    case "importe":
      return <Importe valor={valor} onCambio={onCambio} />;
    case "prioridad":
      return (
        <span className="flex w-full gap-1 px-1">
          {(["NORMAL", "URGENTE"] as const).map((x) => (
            <button key={x} type="button" onClick={() => onCambio(x, true)} aria-pressed={valor === x}
              className={`my-1 min-h-12 flex-1 rounded border px-2 text-[15px] font-medium lg:min-h-7 lg:text-[12px] ${valor === x ? (x === "URGENTE" ? "border-critico bg-critico-fondo text-critico" : "border-tinta bg-black/[0.04]") : "border-linea text-suave"}`}>
              {x === "URGENTE" ? "Urgente" : "Normal"}
            </button>
          ))}
        </span>
      );
    case "razonSocial":
      return <MenuLista texto={texto} valor={valor} vacio="Elegir empresa" opciones={p.listas.razones.map((r) => ({ valor: r.id, titulo: r.nombre, detalle: `CUIT ${r.cuit}` }))} onElegir={(v) => onCambio(v, true)} />;
    case "formaPago": {
      const formas = p.soloAcopio ? p.listas.formas.filter((f) => f.valor === "ACOPIO") : p.listas.formas;
      return <MenuLista texto={texto} valor={valor} vacio={p.soloAcopio ? "Marcar Acopio" : "Elegir forma de pago"} opciones={formas.map((f) => ({ valor: f.valor, titulo: f.nombre }))} onElegir={(v) => onCambio(v, true)} limpiar />;
    }
    case "condicionPago":
      return <Condicion valor={valor} texto={texto} onCambio={onCambio} condiciones={p.listas.condiciones} />;
    case "obra":
      return <MenuObra valor={valor} texto={texto} obras={p.listas.obras} onElegir={(v) => onCambio(v, true)} />;
    case "persona":
      return <MenuPersona valor={valor} texto={texto} personas={p.listas.personas} onElegir={(v) => onCambio(v, true)} />;
    case "proveedor":
      return <MenuProveedor valor={valor} texto={texto} proveedores={p.listas.proveedoresVivos} onNuevo={p.listas.agregarProveedor} onElegir={(v) => onCambio(v, true)} />;
    case "archivo":
      return <Archivo archivo={p.archivo ?? null} onCambio={(v) => onCambio(v, true)} />;
  }
}

// ─────────────────────────── Texto largo (crece) ───────────────────────────

function TextoLargo({ valor, onCambio, etiqueta }: { valor: string; onCambio: (v: string) => void; etiqueta: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.max(t.scrollHeight, 24)}px`;
  }, [valor]);
  return (
    <textarea ref={ref} aria-label={etiqueta} rows={1} value={valor} maxLength={5000} onChange={(e) => onCambio(e.target.value)}
      className="block min-h-full w-full resize-none self-stretch overflow-hidden bg-transparent px-1.5 py-1 text-[inherit] leading-snug outline-none" />
  );
}

// ─────────────────────────── Importes ───────────────────────────

/** "723839.42" ↔ "723.839,42" (como lo escribe Alejandra). */
const aArgentino = (v: string) => (v === "" ? "" : Number(v).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const deArgentino = (t: string) => {
  const limpio = t.replace(/[$\s]|US/g, "");
  if (!limpio) return "";
  const n = Number(limpio.includes(",") ? limpio.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(limpio) ? limpio.replace(/\./g, "") : limpio);
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : null;
};

function Dinero({ valor, onCambio, etiqueta }: { valor: string; onCambio: (v: string) => void; etiqueta: string }) {
  const [t, setT] = useState(aArgentino(valor));
  const [foco, setFoco] = useState(false);
  useEffect(() => { if (!foco) setT(aArgentino(valor)); }, [valor, foco]);
  return (
    <span className="flex w-full items-center">
      <span className="pl-1.5 text-[#6b7280]">$</span>
      <input aria-label={etiqueta} inputMode="decimal" className={`${CAMPO} text-right tabular-nums`} value={t}
        onFocus={() => setFoco(true)} onBlur={() => setFoco(false)}
        onChange={(e) => { setT(e.target.value); const v = deArgentino(e.target.value); if (v !== null) onCambio(v); }} />
    </span>
  );
}

/** Importe: número (ARS o USD) o "A confirmar" (los "????" de la planilla). */
function Importe({ valor, onCambio }: { valor: string; onCambio: (v: string, inmediato?: boolean) => void }) {
  const aConfirmar = valor === "?";
  const [moneda, numero] = aConfirmar || !valor ? ["ARS", ""] : (valor.split(" ") as [string, string]);
  const [t, setT] = useState(aArgentino(numero));
  const [foco, setFoco] = useState(false);
  useEffect(() => { if (!foco) setT(aArgentino(numero)); }, [numero, foco]);
  if (aConfirmar) {
    return (
      <span className="flex w-full items-center justify-between gap-1 bg-[#FFFF00] px-1.5">
        <span>A confirmar</span>
        <button type="button" onClick={() => onCambio("", true)} className="text-[11px] underline">poner importe</button>
      </span>
    );
  }
  return (
    <span className="flex w-full items-center">
      <button type="button" title="Cambiar moneda" onClick={() => onCambio(numero ? `${moneda === "ARS" ? "USD" : "ARS"} ${numero}` : "", true)} className="shrink-0 pl-1.5 text-[11px] font-semibold text-[#6b7280]">{moneda === "USD" ? "US$" : "$"}</button>
      <input aria-label="Importe" inputMode="decimal" className={`${CAMPO} text-right tabular-nums`} value={t} placeholder="0,00"
        onFocus={() => setFoco(true)} onBlur={() => setFoco(false)}
        onChange={(e) => { setT(e.target.value); const v = deArgentino(e.target.value); if (v !== null) onCambio(v ? `${moneda} ${v}` : ""); }} />
      <button type="button" onClick={() => onCambio("?", true)} className="shrink-0 px-1.5 text-[11px] whitespace-nowrap text-[#6b7280] underline">A confirmar</button>
    </span>
  );
}

// ─────────────────────────── Menú flotante sobre la celda ───────────────────────────

function useFuera(abierto: boolean, cerrar: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) cerrar(); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", esc); };
  }, [abierto, cerrar]);
  return ref;
}

function Menu({ boton, children, abierto, setAbierto, ancho = 300 }: { boton: ReactNode; children: ReactNode; abierto: boolean; setAbierto: (x: boolean) => void; ancho?: number }) {
  const ref = useFuera(abierto, () => setAbierto(false));
  // Nunca se sale de la pantalla: si no entra a la derecha de la celda, se corre a la izquierda (16 px de margen).
  const [corrimiento, setCorrimiento] = useState(0);
  const [anchoReal, setAnchoReal] = useState(ancho);
  useLayoutEffect(() => {
    if (!abierto || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const w = Math.min(ancho, window.innerWidth - 32);
    setAnchoReal(w);
    setCorrimiento(Math.min(0, window.innerWidth - 16 - (r.left + w)));
  }, [abierto, ancho, ref]);
  return (
    <div ref={ref} className="relative h-full w-full">
      <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} className="flex h-full min-h-[inherit] w-full items-center gap-1 px-1.5 text-left">
        {boton}
        <ChevronDown className="ml-auto size-3.5 shrink-0 text-[#9ca3af]" />
      </button>
      {abierto && (
        <div className="absolute top-full left-0 z-40 mt-1 max-w-[calc(100vw-32px)] rounded-[var(--radius-caja)] border border-linea bg-papel p-1 font-sans text-[13px] text-tinta shadow-[var(--shadow-flotante)]" style={{ width: anchoReal, left: corrimiento }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Buscador({ q, setQ, placeholder }: { q: string; setQ: (x: string) => void; placeholder: string }) {
  return (
    <label className="mb-1 flex h-9 items-center gap-2 rounded-md border border-linea px-2">
      <Search className="size-4 text-suave" />
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-[16px] outline-none lg:text-[13px]" />
    </label>
  );
}

const norma = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const Vacio = ({ t }: { t: string }) => <span className="truncate text-[#9ca3af]">{t}</span>;

function Opcion({ elegida, onClick, titulo, detalle }: { elegida: boolean; onClick: () => void; titulo: ReactNode; detalle?: ReactNode }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-hover lg:min-h-8">
        <Check className={`size-4 shrink-0 ${elegida ? "" : "invisible"}`} />
        <span className="min-w-0 flex-1 truncate">{titulo}</span>
        {detalle && <span className="shrink-0 text-[12px] text-suave">{detalle}</span>}
      </button>
    </li>
  );
}

function MenuLista({ texto, valor, vacio, opciones, onElegir, limpiar = false }: { texto: string; valor: string; vacio: string; opciones: { valor: string; titulo: string; detalle?: string }[]; onElegir: (v: string) => void; limpiar?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Menu abierto={abierto} setAbierto={setAbierto} boton={texto ? <span className="truncate">{texto}</span> : <Vacio t={vacio} />}>
      <ul className="max-h-72 overflow-y-auto">
        {opciones.map((o) => <Opcion key={o.valor} elegida={o.valor === valor} titulo={o.titulo} detalle={o.detalle} onClick={() => { onElegir(o.valor); setAbierto(false); }} />)}
        {limpiar && valor && <Opcion elegida={false} titulo={<span className="text-suave">Dejar vacía</span>} onClick={() => { onElegir(""); setAbierto(false); }} />}
      </ul>
    </Menu>
  );
}

function Condicion({ valor, texto, onCambio, condiciones }: { valor: string; texto: string; onCambio: (v: string, inmediato?: boolean) => void; condiciones: { valor: string; nombre: string }[] }) {
  const [abierto, setAbierto] = useState(false);
  const [c, otra] = valor.split("|");
  const [t, setT] = useState(otra ?? "");
  return (
    <Menu abierto={abierto} setAbierto={setAbierto} boton={texto ? <span className="truncate">{texto}</span> : <Vacio t="Elegir condición" />}>
      <ul className="max-h-72 overflow-y-auto">
        {condiciones.map((o) => <Opcion key={o.valor} elegida={o.valor === c} titulo={o.nombre} onClick={() => { if (o.valor !== "OTRA") { onCambio(o.valor, true); setAbierto(false); } else onCambio(`OTRA|${t || "?"}`, true); }} />)}
      </ul>
      {c === "OTRA" && (
        <div className="flex gap-1 p-1">
          <input autoFocus value={t} onChange={(e) => setT(e.target.value)} placeholder="¿Cuál? (50 % anticipo…)" className="h-9 min-w-0 flex-1 rounded-md border border-linea px-2 text-[16px] lg:text-[13px]" />
          <button type="button" onClick={() => { onCambio(`OTRA|${t}`, true); setAbierto(false); }} className="h-9 rounded-md bg-negro px-3 text-[13px] font-medium text-white">Listo</button>
        </div>
      )}
    </Menu>
  );
}

function MenuObra({ valor, texto, obras, onElegir }: { valor: string; texto: string; obras: ListasPlantilla["obras"]; onElegir: (v: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [conSedes, setConSedes] = useState<string | null>(null);
  const [obraId, sedeId] = valor.split("|");
  const lista = obras.filter((o) => !q || norma(o.nombre).includes(norma(q)));
  const elegida = obras.find((o) => o.id === conSedes);
  return (
    <Menu abierto={abierto} setAbierto={(x) => { setAbierto(x); setConSedes(null); setQ(""); }} boton={texto ? <span className="truncate">{texto}</span> : <Vacio t="Elegir obra" />}>
      {elegida ? (
        <ul className="max-h-72 overflow-y-auto">
          <li className="px-2 py-1 text-[12px] text-suave">Obra {elegida.nombre}: ¿a qué frente?</li>
          {elegida.sedes.map((s) => <Opcion key={s.id} elegida={s.id === sedeId} titulo={s.nombre} onClick={() => { onElegir(`${elegida.id}|${s.id}`); setAbierto(false); }} />)}
        </ul>
      ) : (
        <>
          <Buscador q={q} setQ={setQ} placeholder="Buscar obra" />
          <ul className="max-h-72 overflow-y-auto">
            {lista.map((o) => (
              <Opcion key={o.id} elegida={o.id === obraId} titulo={`Obra ${o.nombre}`} detalle={o.sedes.length > 1 ? `${o.sedes.length} frentes` : undefined}
                onClick={() => { if (o.sedes.length > 1) setConSedes(o.id); else { onElegir(o.id); setAbierto(false); } }} />
            ))}
            {!lista.length && <li className="px-2 py-2 text-suave">Ninguna obra con ese nombre.</li>}
          </ul>
        </>
      )}
    </Menu>
  );
}

function MenuPersona({ valor, texto, personas: iniciales, onElegir }: { valor: string; texto: string; personas: ListasPlantilla["personas"]; onElegir: (v: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [personas, setPersonas] = useState(iniciales);
  const [otro, setOtro] = useState(false);
  const [error, setError] = useState<string>();
  const [guardando, setGuardando] = useState(false);
  const lista = personas.filter((p) => !q || norma(p.nombre).includes(norma(q)));
  return (
    <Menu abierto={abierto} setAbierto={(x) => { setAbierto(x); setOtro(false); setError(undefined); }} boton={texto ? <span className="truncate">{texto}</span> : <Vacio t="¿Quién lo pide?" />}>
      {otro ? (
        <div className="flex flex-col gap-1 p-1">
          <p className="text-[12px] text-suave">Un nombre que no tiene usuario (no se crea un usuario).</p>
          <div className="flex gap-1">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre" className="h-9 min-w-0 flex-1 rounded-md border border-linea px-2 text-[16px] lg:text-[13px]" />
            <button type="button" disabled={guardando || q.trim().length < 2} onClick={async () => {
              setGuardando(true);
              const r = await crearSolicitanteExterno(q);
              setGuardando(false);
              if (!r.ok) return setError(r.error);
              const nuevo = { valor: `e:${r.datos.id}`, nombre: r.datos.nombre, detalle: "sin usuario" };
              setPersonas((xs) => [...xs.filter((x) => x.valor !== nuevo.valor), nuevo]);
              onElegir(nuevo.valor);
              setAbierto(false);
            }} className="h-9 rounded-md bg-negro px-3 text-[13px] font-medium text-white disabled:opacity-40">Agregar</button>
          </div>
          {error && <p className="text-[12px] text-critico">{error}</p>}
        </div>
      ) : (
        <>
          <Buscador q={q} setQ={setQ} placeholder="Buscar persona" />
          <ul className="max-h-64 overflow-y-auto">
            {lista.map((p) => <Opcion key={p.valor} elegida={p.valor === valor} titulo={p.nombre} detalle={p.detalle === "sin usuario" ? "sin usuario" : undefined} onClick={() => { onElegir(p.valor); setAbierto(false); }} />)}
          </ul>
          <button type="button" onClick={() => setOtro(true)} className="mt-1 flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left font-medium hover:bg-hover"><PlusCircle className="size-4" /> Otro nombre</button>
        </>
      )}
    </Menu>
  );
}

/** Proveedor Final: proveedor y su sucursal (adonde va el chofer). Nuevo proveedor / Agregar sucursal en la hoja lateral. */
function MenuProveedor({ valor, texto, proveedores, onNuevo, onElegir }: { valor: string; texto: string; proveedores: ProveedorConSucursales[]; onNuevo: (p: ProveedorConSucursales) => void; onElegir: (v: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [proveedorId, sucursalId] = valor.split("|");
  const [viendo, setViendo] = useState<string | null>(null);
  const [hoja, setHoja] = useState<"proveedor" | "sucursal" | null>(null);
  const lista = useMemo(() => proveedores.filter((p) => !q || norma(p.nombre).includes(norma(q))), [proveedores, q]);
  const elegido = proveedores.find((p) => p.id === viendo);
  const elegir = (p: ProveedorConSucursales, sucId: string) => { onElegir(`${p.id}|${sucId}`); setAbierto(false); setViendo(null); };
  return (
    <>
      <Menu ancho={340} abierto={abierto} setAbierto={(x) => { setAbierto(x); setViendo(null); setQ(""); }} boton={texto ? <span className="truncate">{texto}</span> : <Vacio t="Elegir proveedor" />}>
        {elegido ? (
          <>
            <p className="px-2 py-1 text-[12px] text-suave">{elegido.nombre}: ¿de qué sucursal se retira?</p>
            <ul className="max-h-64 overflow-y-auto">
              {elegido.sucursales.map((s) => <Opcion key={s.id} elegida={s.id === sucursalId} titulo={s.nombre} detalle={s.localidad} onClick={() => elegir(elegido, s.id)} />)}
            </ul>
            <button type="button" onClick={() => setHoja("sucursal")} className="mt-1 flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left font-medium hover:bg-hover"><PlusCircle className="size-4" /> Agregar sucursal</button>
          </>
        ) : (
          <>
            <Buscador q={q} setQ={setQ} placeholder="Buscar proveedor" />
            <ul className="max-h-64 overflow-y-auto">
              {lista.map((p) => (
                <Opcion key={p.id} elegida={p.id === proveedorId} titulo={p.nombre} detalle={p.sucursales.length === 1 ? p.sucursales[0].localidad : `${p.sucursales.length} sucursales`}
                  onClick={() => (p.sucursales.length === 1 ? elegir(p, p.sucursales[0].id) : setViendo(p.id))} />
              ))}
              {!lista.length && <li className="px-2 py-2 text-suave">Ningún proveedor con ese nombre.</li>}
            </ul>
            <button type="button" onClick={() => setHoja("proveedor")} className="mt-1 flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left font-medium hover:bg-hover"><PlusCircle className="size-4" /> Nuevo proveedor</button>
          </>
        )}
      </Menu>
      <Hoja abierta={hoja === "proveedor"} onCerrar={() => setHoja(null)} titulo="Nuevo proveedor">
        {hoja === "proveedor" && <FormularioProveedor rapido onCreado={(p) => { onNuevo(p); setHoja(null); if (p.sucursales[0]) elegir(p, p.sucursales[0].id); }} />}
      </Hoja>
      <Hoja abierta={hoja === "sucursal"} onCerrar={() => setHoja(null)} titulo={`Agregar sucursal${elegido ? ` de ${elegido.nombre}` : ""}`}>
        {hoja === "sucursal" && elegido && <FormularioSucursal proveedorId={elegido.id} onGuardada={(p) => { onNuevo(p); setHoja(null); elegir(p, p.sucursalId); }} />}
      </Hoja>
    </>
  );
}

/** Factura (archivo): se sube y queda en la celda; en el PDF va como segunda página. */
function Archivo({ archivo, onCambio }: { archivo: { id: string; nombre: string } | null; onCambio: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  return (
    <span className="flex w-full items-center gap-1 px-1.5">
      {archivo ? (
        <>
          <a href={`/api/adjuntos/${archivo.id}`} target="_blank" rel="noopener" className="min-w-0 flex-1 truncate underline">{archivo.nombre}</a>
          <button type="button" aria-label="Quitar la factura" onClick={() => onCambio("")} className="grid size-7 place-items-center rounded text-suave hover:text-tinta"><X className="size-3.5" /></button>
        </>
      ) : subiendo != null ? (
        <span className="flex items-center gap-1 text-suave"><Loader2 className="size-3.5" /> Subiendo… {subiendo} %</span>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} className="flex items-center gap-1 text-[#6b7280] hover:text-tinta"><Paperclip className="size-3.5" /> Adjuntar factura (PDF o foto)</button>
      )}
      {error && <span className="text-[11px] text-critico">{error}</span>}
      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        setError(undefined);
        setSubiendo(0);
        try {
          const a = await subirUno(f, "ORDEN_COMPRA", false, setSubiendo);
          onCambio(a.id);
        } catch (x) {
          setError(x instanceof Error ? x.message : "No se pudo subir.");
        } finally {
          setSubiendo(null);
        }
      }} />
    </span>
  );
}
