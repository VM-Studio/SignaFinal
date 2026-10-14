"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Insignia } from "@/components/ui/basicos";
import { useAviso } from "@/components/ui/avisos";
import { editarCeldaTablero } from "@/lib/compras/acciones";
import { ESTADO_TABLERO } from "@/lib/compras/estadoTablero";
import { importeTexto } from "@/lib/compras/estados";
import type { FilaTablero } from "@/lib/compras/tablero";

/** Las columnas de la fila 9 de la planilla de Alejandra, en su orden. */
export const COLUMNAS_TABLERO = ["OC/PE", "N° OC/PE", "Fecha", "Solicitado por", "Obra", "Proveedor", "Importe", "Descripción/Materiales", "Estado", "Fecha de entrega", "Observaciones en OC / Próximos pasos", "Comentarios"];

const fecha = (s: string | null) => (s ? s.split("-").reverse().join("/").replace(/\/(\d{2})(\d{2})$/, "/$2") : "—");
const hoyISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

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

/** Celda de texto que Alejandra edita en línea: clic, escribir, Enter (Shift+Enter: otra línea). Guarda con auditoría. */
export function CeldaEditable({ id, campo, valor, editable }: { id: string; campo: "proximosPasos" | "comentarios"; valor: string | null; editable: boolean }) {
  const router = useRouter();
  const aviso = useAviso();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor ?? "");
  const [guardado, setGuardado] = useState(valor ?? "");
  const [guardando, setGuardando] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (!editando) { setTexto(valor ?? ""); setGuardado(valor ?? ""); } }, [valor, editando]);
  useEffect(() => { if (editando) { ref.current?.focus(); ref.current?.setSelectionRange(texto.length, texto.length); } }, [editando]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar() {
    setEditando(false);
    if (texto.trim() === guardado.trim()) return;
    setGuardando(true);
    const r = await editarCeldaTablero(id, campo, texto);
    setGuardando(false);
    if (!r.ok) { setTexto(guardado); return aviso({ mensaje: r.error, tono: "error" }); }
    setGuardado(texto.trim());
    router.refresh();
  }

  if (!editable) return <span className="line-clamp-3 whitespace-pre-line" title={valor ?? undefined}>{valor || <span className="text-apagado">—</span>}</span>;
  if (editando) {
    return (
      <textarea ref={ref} value={texto} rows={Math.min(6, Math.max(2, texto.split("\n").length))} maxLength={2000}
        onChange={(e) => setTexto(e.target.value)} onBlur={guardar}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void guardar(); }
          if (e.key === "Escape") { setTexto(guardado); setEditando(false); }
        }}
        className="w-full min-w-48 resize-y rounded-md border border-tinta bg-papel px-2 py-1 text-[16px] leading-snug outline-none ring-2 ring-black/5 lg:text-[13px]" />
    );
  }
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setEditando(true); }} title="Tocá para escribir"
      className={`block w-full min-w-40 rounded-md px-1 py-0.5 text-left whitespace-pre-line hover:bg-black/[0.04] ${guardando ? "opacity-60" : ""}`}>
      {guardado ? <span className="line-clamp-3">{guardado}</span> : <span className="text-apagado">Escribir…</span>}
    </button>
  );
}

function EstadoFila({ f }: { f: FilaTablero }) {
  if (!f.estado) return <span className="text-apagado">—</span>;
  const e = ESTADO_TABLERO[f.estado];
  return <Insignia tono={e.tono}>{e.titulo}</Insignia>;
}

const proveedor = (f: FilaTablero) => f.proveedor ?? (f.proveedorSugerido ? <span className="text-suave">{f.proveedorSugerido} (sugerido)</span> : <span className="text-apagado">—</span>);
const importe = (f: FilaTablero) => (f.importe != null || f.importeAConfirmar ? importeTexto(f.importe, f.moneda, f.importeAConfirmar) : "—");
const vencida = (f: FilaTablero) => !!f.caducidad && f.estado !== "ENTREGADO" && f.estado !== "ANULADA" && f.caducidad < hoyISO();

/** Escritorio: la tabla a todo el ancho, con las columnas de la planilla. Tocar una fila abre la orden a la derecha. */
export function TablaTablero({ filas, editable }: { filas: FilaTablero[]; editable: boolean }) {
  const router = useRouter();
  const { ver, href } = useVer();
  return (
    <div className="hidden overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel lg:block">
      <table className="tabla tabla-tablero">
        <thead>
          <tr>{COLUMNAS_TABLERO.map((c, i) => <th key={c} className={i === 6 ? "text-right" : ""}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id} data-vivo-id={f.id} onClick={() => router.replace(href(f.id), { scroll: false })} aria-selected={ver === f.id}
              className={`cursor-pointer align-top ${ver === f.id ? "bg-black/[0.04] shadow-[inset_2px_0_0_var(--color-tinta)]" : ""}`}>
              <td className="font-medium">{f.tipo}</td>
              <td className="font-medium tabular-nums whitespace-nowrap"><Link href={href(f.id)} scroll={false} onClick={(e) => e.stopPropagation()} className="hover:underline">{f.numero || "—"}</Link>{f.version > 1 ? <span className="text-suave"> v{f.version}</span> : null}</td>
              <td className="tabular-nums whitespace-nowrap">
                {fecha(f.fecha)}
                {vencida(f) && <span className="block text-[11px] text-critico">venció {fecha(f.caducidad)}</span>}
              </td>
              <td className="whitespace-nowrap">{f.solicitadoPor}</td>
              <td className="min-w-28">{f.obra}</td>
              <td className="min-w-28">{proveedor(f)}</td>
              <td className="text-right tabular-nums whitespace-nowrap">{importe(f)}</td>
              <td className="max-w-80 min-w-56"><span className="line-clamp-3 whitespace-pre-line">{f.materiales || "—"}</span></td>
              <td className="whitespace-nowrap"><EstadoFila f={f} />{f.urgente && <span className="mt-1 block text-[11px] text-critico">Urgente</span>}</td>
              <td className="tabular-nums whitespace-nowrap">{fecha(f.fechaEntrega)}</td>
              <td className="max-w-72"><CeldaEditable id={f.id} campo="proximosPasos" valor={f.proximosPasos} editable={editable} /></td>
              <td className="max-w-60"><CeldaEditable id={f.id} campo="comentarios" valor={f.comentarios} editable={editable} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Celular: una fila por orden; al tocar, la orden completa se abre abajo sin cambiar de pantalla. */
export function ListaTablero({ filas, editable, detalle }: { filas: FilaTablero[]; editable: boolean; detalle: React.ReactNode }) {
  const { ver, href } = useVer();
  return (
    <ul className="divide-y divide-linea border-y border-linea bg-papel lg:hidden">
      {filas.map((f) => (
        <li key={f.id} data-vivo-id={f.id}>
          <Link href={href(f.id)} scroll={false} className={`flex flex-col gap-1 px-1 py-3 ${ver === f.id ? "bg-black/[0.03]" : ""}`}>
            <div className="flex items-center gap-2">
              <span className="font-semibold tabular-nums">{f.tipo} {f.numero || "—"}{f.version > 1 ? ` v${f.version}` : ""}</span>
              <span className="text-[13px] text-suave">{fecha(f.fecha)}</span>
              <span className="ml-auto"><EstadoFila f={f} /></span>
            </div>
            <p className="line-clamp-2 text-[15px] whitespace-pre-line">{f.materiales || "—"}</p>
            <p className="text-[13px] text-suave">{f.obra} · {f.solicitadoPor} · {f.proveedor ?? f.proveedorSugerido ?? "sin proveedor"} · {importe(f)}</p>
            {vencida(f) && <p className="text-[13px] text-critico">Venció el {fecha(f.caducidad)}</p>}
          </Link>
          {(f.proximosPasos || editable) && (
            <div className="px-1 pb-2 text-[13px]"><span className="etiqueta">Próximos pasos</span><CeldaEditable id={f.id} campo="proximosPasos" valor={f.proximosPasos} editable={editable} /></div>
          )}
          {ver === f.id && <div className="border-t border-linea px-1 py-3">{detalle}</div>}
        </li>
      ))}
    </ul>
  );
}
