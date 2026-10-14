"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import type { EstadoTablero } from "@prisma/client";
import { useAviso } from "@/components/ui/avisos";
import { ajustarEstadoTablero, editarCeldaTablero } from "@/lib/compras/acciones";
import { ESTADOS_TABLERO, PLANILLA_TABLERO } from "@/lib/compras/estadoTablero";
import { importeTexto } from "@/lib/compras/estados";
import type { FilaTablero } from "@/lib/compras/tablero";

/**
 * EL TABLERO CALCADO DE LA PLANILLA de Alejandra ("TABLERO DE CONTROL ORDENES DE C"): encabezado gris en
 * mayúsculas, grilla completa, la columna Nº con el código de su leyenda, el ESTADO como una lista
 * pintada del color de cada estado, "A confirmar" en amarillo como sus "????", fechas d/M/yyyy y las
 * columnas de texto completas (con sus saltos de línea). Próximos pasos y Comentarios se escriben en la
 * celda, como en Excel. Tocar una fila (fuera de lo editable) abre la orden en el panel de la derecha.
 */
export const COLUMNAS_TABLERO = [
  { titulo: "Nº", ancho: 40 },
  { titulo: "OC/PE", ancho: 64 },
  { titulo: "N° OC / PE", ancho: 72 },
  { titulo: "FECHA", ancho: 96 },
  { titulo: "SOLICITADO POR", ancho: 120 },
  { titulo: "OBRA", ancho: 140 },
  { titulo: "PROVEEDOR", ancho: 180 },
  { titulo: "IMPORTE", ancho: 120 },
  { titulo: "DESCRIPCION / MATERIALES", minimo: 320 },
  { titulo: "ESTADO", ancho: 180 },
  { titulo: "FECHA DE ENTREGA", ancho: 110 },
  { titulo: "OBSERVACIONES EN OC / PRÓXIMOS PASOS", minimo: 280 },
  { titulo: "COMENTARIOS", ancho: 200 },
] as const;
const ANCHO_MINIMO = COLUMNAS_TABLERO.reduce((a, c) => a + ("ancho" in c ? c.ancho : c.minimo), 0);
/** Las tres primeras quedan fijas al correr la tabla de costado. */
const FIJAS = [0, 40, 104];

/** d/M/yyyy, como ella (31/7/2026). */
const fecha = (s: string | null) => (s ? s.split("-").map(Number).reverse().join("/") : "");
/** Una fecha de su planilla que no es fecha ("31/3/0202"). */
const fechaRara = (s: string | null) => !!s && (Number(s.slice(0, 4)) < 2000 || Number(s.slice(0, 4)) > 2100);
const hoyISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const vencida = (f: FilaTablero) => !!f.caducidad && f.estado !== "ENTREGADO" && f.estado !== "ANULADA" && f.caducidad < hoyISO();
/** Celda de una línea: centrada; varias líneas: arriba (como el Excel). */
const multilinea = (t: string | null | undefined) => !!t && (t.includes("\n") || t.length > 48);

function useVer() {
  const sp = useSearchParams();
  const ruta = usePathname();
  const ver = sp.get("ver");
  const href = (id: string) => {
    const n = new URLSearchParams(sp.toString());
    if (ver === id) n.delete("ver");
    else n.set("ver", id);
    const s = n.toString();
    return s ? `${ruta}?${s}` : ruta;
  };
  return { ver, href };
}

/** Tilde chico que confirma que se guardó (1,5 s). */
function useTilde() {
  const [visto, setVisto] = useState(false);
  useEffect(() => {
    if (!visto) return;
    const t = window.setTimeout(() => setVisto(false), 1500);
    return () => window.clearTimeout(t);
  }, [visto]);
  const tilde = visto ? <Check aria-label="Guardado" className="pointer-events-none absolute top-1 right-1 size-3.5 text-[#375623]" strokeWidth={2.5} /> : null;
  return [tilde, () => setVisto(true)] as const;
}

/**
 * Celda que Alejandra escribe en línea, como en Excel: clic, escribir (Enter = otra línea), y se guarda al
 * salir de la celda o con Ctrl+Enter; Esc cancela. El texto queda completo, con sus saltos de línea.
 */
export function CeldaEditable({ id, campo, valor, editable, compacta = false }: { id: string; campo: "proximosPasos" | "comentarios"; valor: string | null; editable: boolean; compacta?: boolean }) {
  const router = useRouter();
  const aviso = useAviso();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor ?? "");
  const [guardado, setGuardado] = useState(valor ?? "");
  const [guardando, setGuardando] = useState(false);
  const [tilde, confirmar] = useTilde();
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (!editando) { setTexto(valor ?? ""); setGuardado(valor ?? ""); } }, [valor, editando]);
  useEffect(() => { if (editando) { ref.current?.focus(); ref.current?.setSelectionRange(texto.length, texto.length); } }, [editando]); // eslint-disable-line react-hooks/exhaustive-deps
  // El campo crece con el texto (sin barra de scroll propia).
  useLayoutEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${t.scrollHeight}px`;
  }, [texto, editando]);

  async function guardar() {
    setEditando(false);
    if (texto.trim() === guardado.trim()) return;
    setGuardando(true);
    const r = await editarCeldaTablero(id, campo, texto);
    setGuardando(false);
    if (!r.ok) { setTexto(guardado); return aviso({ mensaje: r.error, tono: "error" }); }
    setGuardado(texto.trim());
    confirmar();
    router.refresh();
  }

  const vacio = compacta ? <span className="text-apagado">Escribir…</span> : null;
  if (!editable) return <span className="block whitespace-pre-wrap">{valor}</span>;
  if (editando) {
    return (
      <textarea ref={ref} value={texto} rows={1} maxLength={2000} aria-label={campo === "proximosPasos" ? "Observaciones en OC / Próximos pasos" : "Comentarios"}
        onChange={(e) => setTexto(e.target.value)} onBlur={guardar}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ref.current?.blur(); }
          if (e.key === "Escape") { e.preventDefault(); setTexto(guardado); setEditando(false); }
        }}
        className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[16px] leading-5 whitespace-pre-wrap text-tinta outline-none lg:text-[13px]" />
    );
  }
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setEditando(true); }} title="Escribir (Ctrl+Enter guarda, Esc cancela)"
      className={`block w-full text-left leading-5 whitespace-pre-wrap ${guardando ? "opacity-60" : ""} ${compacta ? "" : "min-h-5"}`}>
      {guardado || vacio}
      {tilde}
    </button>
  );
}

/** Columna ESTADO: una lista que ocupa toda la celda, pintada del color del estado (como la planilla). */
function CeldaEstado({ f, editable }: { f: FilaTablero; editable: boolean }) {
  const router = useRouter();
  const aviso = useAviso();
  const [estado, setEstado] = useState<EstadoTablero | null>(f.estado);
  const [guardando, setGuardando] = useState(false);
  const [tilde, confirmar] = useTilde();
  useEffect(() => setEstado(f.estado), [f.estado]);
  const p = estado ? PLANILLA_TABLERO[estado] : null;
  const estilo = { background: p?.fondo ?? "transparent", color: p?.texto ?? "var(--color-suave)" };

  async function cambiar(nuevo: EstadoTablero) {
    const antes = estado;
    setEstado(nuevo);
    setGuardando(true);
    const r = await ajustarEstadoTablero(f.id, nuevo);
    setGuardando(false);
    if (!r.ok) { setEstado(antes); return aviso({ mensaje: r.error, tono: "error" }); }
    confirmar();
    router.refresh();
  }

  if (!editable) return <span className="absolute inset-0 grid place-items-center px-2 text-center text-[12px] font-semibold uppercase" style={estilo}>{p?.palabra ?? ""}</span>;
  return (
    <span className="absolute inset-0" onClick={(e) => e.stopPropagation()}>
      <select value={estado ?? ""} disabled={guardando} aria-label={`Estado de la ${f.tipo} ${f.numero}`} onChange={(e) => cambiar(e.target.value as EstadoTablero)}
        className="block h-full w-full cursor-pointer appearance-none border-0 px-2 text-center text-[12px] font-semibold uppercase outline-none [text-align-last:center] focus-visible:shadow-[inset_0_0_0_2px_var(--color-tinta)] disabled:cursor-wait"
        style={estilo}>
        {!estado && <option value="">—</option>}
        {ESTADOS_TABLERO.map((e) => <option key={e} value={e} style={{ background: "#fff", color: "#111827" }}>{PLANILLA_TABLERO[e].palabra}</option>)}
      </select>
      {tilde}
    </span>
  );
}

/** Columna Nº: el código de su leyenda, con el color del estado (tachado si está anulada). */
function CeldaCodigo({ estado }: { estado: EstadoTablero | null }) {
  if (!estado) return null;
  const p = PLANILLA_TABLERO[estado];
  return <span className={`absolute inset-0 grid place-items-center text-[12px] ${estado === "ANULADA" ? "line-through" : ""}`} style={{ background: p.fondo, color: p.texto }}>{p.codigo}</span>;
}

const proveedor = (f: FilaTablero) => f.proveedor ?? (f.proveedorSugerido ? `${f.proveedorSugerido} (sugerido)` : "");
const aConfirmar = (f: FilaTablero) => f.importe == null && f.importeAConfirmar;
const importe = (f: FilaTablero) => (aConfirmar(f) ? "A confirmar" : f.importe != null ? importeTexto(f.importe, f.moneda, f.importeAConfirmar) : "");

/**
 * Escritorio: la planilla. La tabla tiene su propio scroll (alto de la pantalla): el encabezado queda fijo
 * al bajar y, si no entra de ancho, se corre de costado SOLO la tabla, con Nº, OC/PE y N° fijos.
 */
export function TablaTablero({ filas, editable }: { filas: FilaTablero[]; editable: boolean }) {
  const router = useRouter();
  const { ver, href } = useVer();
  const fija = (i: number) => (i < FIJAS.length ? { position: "sticky" as const, left: FIJAS[i], zIndex: 1 } : undefined);
  return (
    <div className="planilla hidden max-h-[calc(100dvh-var(--alto-header)-48px)] overflow-auto border-r border-b border-[#BFBFBF] bg-papel lg:block">
      <table className="w-full table-fixed border-separate border-spacing-0 text-[13px] text-tinta" style={{ minWidth: ANCHO_MINIMO }}>
        <colgroup>{COLUMNAS_TABLERO.map((c) => <col key={c.titulo} style={"ancho" in c ? { width: c.ancho } : undefined} />)}</colgroup>
        <thead>
          <tr>
            {COLUMNAS_TABLERO.map((c, i) => (
              <th key={c.titulo} scope="col" style={{ ...fija(i), zIndex: i < FIJAS.length ? 3 : 2 }}
                className="sticky top-0 h-10 border-t border-b border-l border-[#A6A6A6] bg-[#D9D9D9] px-1.5 text-center align-middle text-[12px] leading-4 font-semibold text-black uppercase">
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const elegida = ver === f.id;
            const borde = "border-b border-l border-[#BFBFBF]";
            const td = `${borde} px-2.5 py-2 align-middle`;
            const tdTexto = (t: string | null | undefined) => `${borde} px-2.5 py-2 ${multilinea(t) ? "align-top" : "align-middle"}`;
            const pintada = `${borde} relative p-0`; // el contenido llena la celda aunque la fila crezca
            const fondo = elegida ? "bg-[#F3F4F6]" : "bg-papel";
            return (
              <tr key={f.id} data-vivo-id={f.id} onClick={() => router.replace(href(f.id), { scroll: false })} aria-selected={elegida}
                className={`fila-planilla h-14 cursor-pointer ${elegida ? "elegida" : ""}`}>
                <td className={`${pintada} ${fondo}`} style={fija(0)}><CeldaCodigo estado={f.estado} /></td>
                <td className={`${td} text-center ${fondo}`} style={fija(1)}>{f.tipo}</td>
                <td className={`${td} text-center font-medium tabular-nums ${fondo}`} style={fija(2)}>
                  <Link href={href(f.id)} scroll={false} onClick={(e) => e.stopPropagation()} className="hover:underline">{f.numero || "—"}</Link>
                  {f.version > 1 && <span className="block text-[11px] font-normal text-suave">v{f.version}</span>}
                </td>
                <td className={`${td} text-center tabular-nums ${fechaRara(f.fecha) ? "bg-[#FFFF00]" : fondo}`}>
                  {fecha(f.fecha)}
                  {vencida(f) && <span className="block text-[11px] text-critico">venció {fecha(f.caducidad)}</span>}
                </td>
                <td className={`${td} text-center uppercase ${fondo}`}>{f.solicitadoPor}</td>
                <td className={`${td} text-center uppercase ${fondo}`}>{f.obra}</td>
                <td className={`${td} text-center uppercase ${fondo}`}>{proveedor(f)}</td>
                <td className={`${td} text-right whitespace-nowrap tabular-nums ${aConfirmar(f) ? "bg-[#FFFF00] text-center text-black" : fondo}`}>{importe(f)}</td>
                <td className={`${tdTexto(f.materiales)} whitespace-pre-wrap ${fondo}`}>
                  {f.materiales}
                  {f.urgente && <span className="mt-1 block text-[11px] font-semibold text-critico uppercase">Urgente</span>}
                </td>
                <td className={`${pintada} ${fondo}`}><CeldaEstado f={f} editable={editable} /></td>
                <td className={`${td} text-center tabular-nums ${fechaRara(f.fechaEntrega) ? "bg-[#FFFF00]" : fondo}`}>{fecha(f.fechaEntrega)}</td>
                <td className={`${tdTexto(f.proximosPasos)} relative ${fondo}`}><CeldaEditable id={f.id} campo="proximosPasos" valor={f.proximosPasos} editable={editable} /></td>
                <td className={`${tdTexto(f.comentarios)} relative ${fondo}`}><CeldaEditable id={f.id} campo="comentarios" valor={f.comentarios} editable={editable} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Celular: una fila por orden con el estado pintado como en la planilla; al tocar, la orden completa se abre abajo. */
export function ListaTablero({ filas, editable, detalle }: { filas: FilaTablero[]; editable: boolean; detalle: React.ReactNode }) {
  const { ver, href } = useVer();
  return (
    <ul className="-mx-4 divide-y divide-linea border-y border-linea bg-papel lg:hidden">
      {filas.map((f) => {
        const p = f.estado ? PLANILLA_TABLERO[f.estado] : null;
        return (
          <li key={f.id} data-vivo-id={f.id}>
            <Link href={href(f.id)} scroll={false} className={`flex flex-col gap-1 px-4 py-3 ${ver === f.id ? "bg-black/[0.03]" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="font-semibold tabular-nums">{f.tipo} {f.numero || "—"}{f.version > 1 ? ` v${f.version}` : ""}</span>
                <span className="text-[13px] text-suave tabular-nums">{fecha(f.fecha)}</span>
                {p && <span className="ml-auto inline-flex h-[22px] items-center rounded-full px-2 text-[11px] font-semibold uppercase" style={{ background: p.fondo, color: p.texto }}>{p.palabra}</span>}
              </div>
              <p className="text-[15px] whitespace-pre-wrap">{f.materiales || "—"}</p>
              <p className="text-[13px] text-suave">{[f.obra, f.solicitadoPor, proveedor(f) || "sin proveedor"].join(" · ")} · <span className={aConfirmar(f) ? "bg-[#FFFF00] px-1 text-black" : ""}>{importe(f) || "sin importe"}</span></p>
              {vencida(f) && <p className="text-[13px] text-critico">Venció el {fecha(f.caducidad)}</p>}
            </Link>
            {(f.proximosPasos || editable) && (
              <div className="relative px-4 pb-3 text-[13px]"><span className="etiqueta block">Próximos pasos</span><CeldaEditable id={f.id} campo="proximosPasos" valor={f.proximosPasos} editable={editable} compacta /></div>
            )}
            {ver === f.id && <div className="border-t border-linea px-4 py-3">{detalle}</div>}
          </li>
        );
      })}
    </ul>
  );
}
