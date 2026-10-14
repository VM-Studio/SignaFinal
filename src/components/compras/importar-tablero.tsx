"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import type { EstadoTablero, TipoOrden } from "@prisma/client";
import { Boton, BotonLink } from "@/components/ui/boton";
import { Cifra } from "@/components/ui/basicos";
import { Entrada, MensajeError, Selector } from "@/components/ui/campos";
import { CAMPOS, filaValida, revisarTodo, type Campo, type Catalogos, type Celda, type Correccion, type Mapeo } from "@/lib/compras/importarTablero";
import { ESTADO_TABLERO, ESTADOS_TABLERO } from "@/lib/compras/estadoTablero";
import { importeTexto } from "@/lib/compras/estados";
import type { ResumenImportacion } from "@/lib/compras/importacion";

type Leido = { archivo: string; hoja: string; filaEncabezados: number; encabezados: Celda[]; mapeo: Mapeo; filas: { n: number; celdas: Celda[] }[]; catalogos: Catalogos; existentes: Record<string, "SISTEMA" | "IMPORTADA_EXCEL"> };
type Filtro = "todas" | "errores" | "avisos" | "ok";
const fecha = (s: string | null) => (s ? s.split("-").reverse().join("/") : "—");
const letra = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `A${String.fromCharCode(65 + i - 26)}`);

/**
 * IMPORTAR EL TABLERO DESDE EXCEL: subir el .xlsx, revisar TODAS las filas detectadas (mapeo de columnas
 * editable, rojo = no se importa, amarillo = revisar), corregir o excluir y "Importar N filas válidas".
 * Nada se guarda hasta confirmar; importar dos veces el mismo archivo no duplica (clave tipo + número).
 */
export function ImportarTablero() {
  const [leido, setLeido] = useState<Leido | null>(null);
  const [mapeo, setMapeo] = useState<Mapeo | null>(null);
  const [corr, setCorr] = useState<Record<number, Correccion>>({});
  const [subiendo, setSubiendo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState<string>();
  const [resumen, setResumen] = useState<ResumenImportacion | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const revisadas = useMemo(() => {
    if (!leido || !mapeo) return [];
    const rs = revisarTodo(leido.filas, mapeo, leido.catalogos, corr);
    for (const r of rs) {
      const ya = r.tipo && r.numeroTexto ? leido.existentes[`${r.tipo}-${r.numeroTexto}`] : undefined;
      if (ya === "SISTEMA") r.errores.push("Ese número ya es de una orden armada en el sistema.");
      if (ya === "IMPORTADA_EXCEL") r.avisos.push("Ya se importó antes: se actualiza (no se duplica).");
    }
    return rs;
  }, [leido, mapeo, corr]);
  const validas = revisadas.filter(filaValida);
  const conError = revisadas.filter((r) => !r.excluida && r.errores.length);
  const conAviso = revisadas.filter((r) => filaValida(r) && r.avisos.length);
  const pendientesObra = revisadas.filter((r) => filaValida(r) && r.obra.texto && !r.obra.id);
  const obraNombre = (id: string | null) => leido?.catalogos.obras.find((o) => o.id === id)?.nombre ?? null;
  const visibles = revisadas.filter((r) => filtro === "todas" || (filtro === "errores" ? !r.excluida && r.errores.length : filtro === "avisos" ? filaValida(r) && r.avisos.length : filaValida(r) && !r.avisos.length));
  const corregir = (n: number, c: Correccion) => setCorr((x) => ({ ...x, [n]: { ...x[n], ...c } }));

  async function subir(f: File) {
    setError(undefined);
    setResumen(null);
    setSubiendo(true);
    const fd = new FormData();
    fd.set("archivo", f);
    const r = await fetch("/api/compras/importar/vista-previa", { method: "POST", body: fd }).catch(() => null);
    setSubiendo(false);
    const j = r ? await r.json().catch(() => null) : null;
    if (!r?.ok || !j) return setError(j?.error ?? "No se pudo leer el archivo. Probá de nuevo.");
    setLeido(j as Leido);
    setMapeo((j as Leido).mapeo);
    setCorr({});
  }

  async function importar() {
    if (!leido || !mapeo) return;
    setError(undefined);
    setImportando(true);
    const r = await fetch("/api/compras/importar/confirmar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filas: leido.filas, mapeo, correcciones: corr }) }).catch(() => null);
    setImportando(false);
    const j = r ? await r.json().catch(() => null) : null;
    if (!r?.ok || !j) return setError(j?.error ?? "No se pudo importar. Probá de nuevo.");
    setResumen(j as ResumenImportacion);
    setLeido(null);
  }

  if (resumen) {
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-2 text-[18px] font-semibold text-ok"><CheckCircle2 className="size-5" /> Listo: tu tablero está en el sistema.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Cifra etiqueta="Órdenes nuevas" valor={resumen.creadas} tono="ok" />
          <Cifra etiqueta="Actualizadas" valor={resumen.actualizadas} />
          <Cifra etiqueta="Con error (no se importaron)" valor={resumen.conError} tono={resumen.conError ? "critico" : undefined} />
          <Cifra etiqueta="Excluidas" valor={resumen.excluidas} />
        </div>
        {resumen.proveedoresNuevos.length > 0 && <p className="text-sm text-suave"><b className="font-medium text-tinta">Proveedores nuevos ({resumen.proveedoresNuevos.length}):</b> {resumen.proveedoresNuevos.join(", ")}. Quedaron sin sucursal: completá la dirección en Proveedores.</p>}
        {resumen.solicitantesNuevos.length > 0 && <p className="text-sm text-suave"><b className="font-medium text-tinta">Agregados a “Solicitado por” sin usuario:</b> {resumen.solicitantesNuevos.join(", ")}.</p>}
        {resumen.obrasSinEmparejar.length > 0 && <p className="text-sm text-suave"><b className="font-medium text-tinta">Obras que quedaron como texto:</b> {resumen.obrasSinEmparejar.join(", ")}.</p>}
        <div className="flex flex-wrap gap-2"><BotonLink href="/compras/tablero">Ver el tablero</BotonLink><Boton variante="secundario" onClick={() => setResumen(null)}>Importar otro archivo</Boton></div>
      </div>
    );
  }

  if (!leido || !mapeo) {
    return (
      <div className="flex max-w-2xl flex-col gap-3">
        <label className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-caja)] border border-dashed border-linea-fuerte bg-papel p-6 text-center hover:bg-hover ${subiendo ? "opacity-60" : ""}`}>
          <FileSpreadsheet className="size-8 text-suave" strokeWidth={1.5} />
          <span className="font-medium">{subiendo ? "Leyendo el archivo…" : "Elegí tu Excel (.xlsx)"}</span>
          <span className="text-sm text-suave">Buscamos la hoja del tablero y la fila con “N° OC / PE” y “SOLICITADO POR”. No se guarda nada hasta que confirmes.</span>
          <input type="file" accept=".xlsx" className="hidden" disabled={subiendo} onChange={(e) => { const f = e.target.files?.[0]; if (f) void subir(f); e.target.value = ""; }} />
        </label>
        <MensajeError>{error}</MensajeError>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-suave">
        <FileSpreadsheet className="size-4" /> <span><b className="font-medium text-tinta">{leido.archivo}</b> · hoja “{leido.hoja}” · encabezados en la fila {leido.filaEncabezados}</span>
        <button type="button" onClick={() => { setLeido(null); setMapeo(null); }} className="font-medium underline hover:text-tinta">Elegir otro archivo</button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button type="button" onClick={() => setFiltro("todas")}><Cifra etiqueta="Filas detectadas" valor={revisadas.length} /></button>
        <button type="button" onClick={() => setFiltro("ok")}><Cifra etiqueta="Válidas" valor={validas.length} tono="ok" /></button>
        <button type="button" onClick={() => setFiltro("avisos")}><Cifra etiqueta="Para revisar" valor={conAviso.length} tono={conAviso.length ? "aviso" : undefined} /></button>
        <button type="button" onClick={() => setFiltro("errores")}><Cifra etiqueta="Con error" valor={conError.length} tono={conError.length ? "critico" : undefined} /></button>
      </div>

      <details className="rounded-[var(--radius-caja)] border border-linea bg-papel p-3">
        <summary className="cursor-pointer text-sm font-medium">Columnas: cómo se leyó cada título (cambialo si cambió un título)</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CAMPOS.map((c) => (
            <label key={c.campo} className="text-[12px] text-suave">
              {c.titulo}{c.obligatorio ? " *" : ""}
              <Selector value={mapeo[c.campo] ?? ""} onChange={(e) => setMapeo({ ...mapeo, [c.campo]: e.target.value === "" ? null : Number(e.target.value) } as Record<Campo, number | null>)}>
                <option value="">(no está en el archivo)</option>
                {leido.encabezados.map((h, i) => (h != null && String(h).trim() ? <option key={i} value={i}>{letra(i)} · {String(h)}</option> : null))}
              </Selector>
            </label>
          ))}
        </div>
      </details>

      {pendientesObra.length > 0 && (
        <p className="rounded-md bg-aviso-fondo px-3 py-2 text-sm text-aviso-texto">
          {pendientesObra.length} filas con obras sin emparejar ({[...new Set(pendientesObra.map((r) => r.obra.texto))].slice(0, 8).join(", ")}{new Set(pendientesObra.map((r) => r.obra.texto)).size > 8 ? "…" : ""}). Elegí la obra en cada fila o quedan con el nombre como texto.
        </p>
      )}

      <div className="overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel">
        <table className="tabla text-[13px]">
          <thead>
            <tr><th>Fila</th><th>Importar</th><th>OC/PE</th><th>N°</th><th>Fecha</th><th>Solicitado por</th><th>Obra</th><th>Proveedor</th><th className="text-right">Importe</th><th>Materiales</th><th>Estado</th><th>Entrega</th><th>Qué pasa</th></tr>
          </thead>
          <tbody>
            {visibles.map((r) => {
              const tono = r.excluida ? "opacity-50" : r.errores.length ? "bg-critico-fondo" : r.avisos.length ? "bg-aviso-fondo" : "";
              return (
                <tr key={r.n} className={`align-top ${tono}`}>
                  <td className="tabular-nums text-suave">{r.n}</td>
                  <td><input type="checkbox" aria-label={`Importar la fila ${r.n}`} checked={!r.excluida} onChange={(e) => corregir(r.n, { excluir: !e.target.checked })} className="size-4 accent-[#111827]" /></td>
                  <td>
                    {r.tipo && !corr[r.n]?.tipo ? r.tipo : (
                      <Selector aria-label="Tipo" value={corr[r.n]?.tipo ?? ""} onChange={(e) => corregir(r.n, { tipo: (e.target.value || undefined) as TipoOrden | undefined })} className="!min-h-8 w-20">
                        <option value="">—</option><option value="OC">OC</option><option value="PE">PE</option>
                      </Selector>
                    )}
                  </td>
                  <td>
                    {r.errores.some((x) => /número|Repetida/.test(x)) || corr[r.n]?.numero != null
                      ? <Entrada aria-label="Número" value={corr[r.n]?.numero ?? r.numeroTexto ?? ""} onChange={(e) => corregir(r.n, { numero: e.target.value })} className="!min-h-8 w-20" />
                      : <span className="whitespace-nowrap tabular-nums">{r.numeroTexto}</span>}
                  </td>
                  <td className="whitespace-nowrap">{r.fecha ? fecha(r.fecha) : <span className="text-aviso-texto">{r.fechaTexto ?? "—"}</span>}</td>
                  <td className="whitespace-nowrap">{r.solicitado ? <>{r.solicitado.nombre}{r.solicitado.tipo === "nuevo" ? <span className="text-aviso-texto"> (nuevo)</span> : null}</> : "—"}</td>
                  <td className="min-w-40">
                    {r.obra.texto && (!leido.catalogos.obras.some((o) => o.id === r.obra.id) || corr[r.n]?.obraId !== undefined) ? (
                      <Selector aria-label="Obra" value={corr[r.n]?.obraId ?? r.obra.id ?? ""} onChange={(e) => corregir(r.n, { obraId: e.target.value || null })} className="!min-h-8">
                        <option value="">“{r.obra.texto}” (como texto)</option>
                        {[...leido.catalogos.obras].sort((a, b) => Number(r.obra.candidatas.includes(b.id)) - Number(r.obra.candidatas.includes(a.id)) || a.nombre.localeCompare(b.nombre)).map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                      </Selector>
                    ) : r.obra.id ? <span title={`En el Excel: ${r.obra.texto}`}>{obraNombre(r.obra.id)}</span> : "—"}
                  </td>
                  <td className="min-w-32">{r.proveedor.nombre ?? "—"}{r.proveedor.nuevo ? <span className="text-aviso-texto"> (nuevo)</span> : null}</td>
                  <td className="text-right whitespace-nowrap tabular-nums">{r.importe != null || r.importeAConfirmar ? importeTexto(r.importe, "ARS", r.importeAConfirmar) : "—"}</td>
                  <td className="max-w-64"><span className="line-clamp-2 whitespace-pre-line">{r.materiales ?? "—"}</span></td>
                  <td className="whitespace-nowrap">
                    <Selector aria-label="Estado" value={corr[r.n]?.estado ?? r.estado ?? ""} onChange={(e) => corregir(r.n, { estado: e.target.value as EstadoTablero | "" })} className="!min-h-8">
                      <option value="">Sin estado</option>
                      {ESTADOS_TABLERO.map((s) => <option key={s} value={s}>{ESTADO_TABLERO[s].titulo}</option>)}
                    </Selector>
                  </td>
                  <td className="whitespace-nowrap">{fecha(r.fechaEntrega)}</td>
                  <td className="min-w-64 text-[12px]">
                    {r.excluida ? <span className="text-suave">Excluida</span> : null}
                    {r.errores.map((x, i) => <p key={`e${i}`} className="text-critico">{x}</p>)}
                    {r.avisos.map((x, i) => <p key={`a${i}`} className="text-aviso-texto">{x}</p>)}
                    {!r.excluida && !r.errores.length && !r.avisos.length && <span className="text-ok">Bien</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <MensajeError>{error}</MensajeError>
      <div className="sticky bottom-[calc(56px+env(safe-area-inset-bottom))] z-10 -mx-4 flex flex-col gap-2 border-t border-linea bg-fondo/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center lg:bottom-0 lg:mx-0 lg:rounded-[var(--radius-caja)] lg:border lg:bg-papel/95 lg:px-3">
        <p className="text-sm text-suave">{conError.length ? `${conError.length} filas con error no se importan (corregilas o excluilas).` : "Todas las filas se pueden importar."}</p>
        <Boton icono={<Upload />} cargando={importando} disabled={!validas.length || mapeo.tipo == null || mapeo.numero == null} onClick={importar} className="sm:ml-auto">Importar {validas.length} filas válidas</Boton>
      </div>
      <p className="text-[12px] text-suave">Las órdenes importadas quedan en el tablero con fuente “importada del Excel”, sin PDF ni pedido de material. <Link href="/compras/tablero" className="underline">Volver al tablero</Link></p>
    </div>
  );
}
