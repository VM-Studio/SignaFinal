"use client";

import { useRef, useState } from "react";
import { Camera, FileSpreadsheet, FileText, Paperclip, X } from "lucide-react";
import type { EntidadAdjunto } from "@prisma/client";

/** Lo mismo que valida el servidor (src/lib/archivos.ts), para avisar antes de subir. */
const EXTENSIONES = ["pdf", "xls", "xlsx", "doc", "docx", "csv", "jpg", "jpeg", "png", "heic"];
const ACEPTA = ".pdf,.xls,.xlsx,.doc,.docx,.csv,.jpg,.jpeg,.png,.heic,application/pdf,image/*";
const MAX = 20 * 1024 * 1024;
const POR_SERVIDOR = 4 * 1024 * 1024;

export type AdjuntoSubido = { id: string; nombre: string; tipoMime: string; tamanoBytes: number };
type Item = { clave: string; nombre: string; tamano: number; tipo: string; progreso: number; error?: string; adjunto?: AdjuntoSubido; vista?: string };

export const pesoLegible = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

export function IconoArchivo({ nombre, className = "size-5" }: { nombre: string; className?: string }) {
  const ext = nombre.toLowerCase().split(".").pop() ?? "";
  if (["xls", "xlsx", "csv"].includes(ext)) return <FileSpreadsheet aria-hidden className={`${className} text-ok`} />;
  return <FileText aria-hidden className={`${className} ${ext === "pdf" ? "text-critico" : "text-suave"}`} />;
}

/** Sube un archivo chico al servidor con progreso (XHR); uno grande, directo a Blob. */
function subirUno(f: File, entidadTipo: EntidadAdjunto, interno: boolean, progreso: (p: number) => void): Promise<AdjuntoSubido> {
  if (f.size > POR_SERVIDOR) return subirDirecto(f, entidadTipo, interno, progreso);
  return new Promise((ok, mal) => {
    const fd = new FormData();
    fd.append("archivo", f);
    fd.append("entidadTipo", entidadTipo);
    if (interno) fd.append("interno", "1");
    const x = new XMLHttpRequest();
    x.open("POST", "/api/archivos");
    x.upload.onprogress = (e) => e.lengthComputable && progreso(Math.round((e.loaded / e.total) * 100));
    x.onload = () => {
      try {
        const r = JSON.parse(x.responseText) as { adjuntos?: AdjuntoSubido[]; error?: string };
        if (x.status >= 200 && x.status < 300 && r.adjuntos?.[0]) ok(r.adjuntos[0]);
        else mal(new Error(r.error ?? "No se pudo subir."));
      } catch {
        mal(new Error("No se pudo subir."));
      }
    };
    x.onerror = () => mal(new Error("Sin conexión: probá de nuevo cuando vuelva la señal."));
    x.send(fd);
  });
}

async function subirDirecto(f: File, entidadTipo: EntidadAdjunto, interno: boolean, progreso: (p: number) => void): Promise<AdjuntoSubido> {
  const { upload } = await import("@vercel/blob/client");
  let blob;
  try {
    blob = await upload(`adjuntos/${f.name}`, f, {
      access: "private",
      handleUploadUrl: "/api/archivos/token",
      clientPayload: JSON.stringify({ entidadTipo, interno }),
      onUploadProgress: (e) => progreso(Math.round(e.percentage)),
    });
  } catch (e) {
    throw new Error(e instanceof Error && /no configurado/i.test(e.message) ? "Almacenamiento de archivos no configurado" : "No se pudo subir el archivo grande. Probá de nuevo.");
  }
  const r = await fetch("/api/archivos/registrar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: blob.url, nombre: f.name, tamano: f.size, tipo: f.type, entidadTipo, interno }) });
  const d = (await r.json()) as { adjuntos?: AdjuntoSubido[]; error?: string };
  if (!r.ok || !d.adjuntos?.[0]) throw new Error(d.error ?? "No se pudo registrar el archivo.");
  return d.adjuntos[0];
}

/**
 * Botón grande para adjuntar (PDF, Excel, Word, CSV, fotos; en el celular, también la cámara). Los
 * archivos se suben al elegirlos, con barra de progreso, vista previa y "quitar". La pantalla recibe
 * los ids (onCambio) y los manda al confirmar el formulario, que los engancha a lo que corresponde.
 */
export function SubirAdjuntos({ entidadTipo, interno = false, etiqueta = "Adjuntar archivos", onCambio, compacto = false }: {
  entidadTipo: EntidadAdjunto; interno?: boolean; etiqueta?: string; onCambio: (ids: string[], subiendo: boolean) => void; compacto?: boolean;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const elegir = useRef<HTMLInputElement>(null);
  const camara = useRef<HTMLInputElement>(null);

  const avisar = (lista: Item[]) => onCambio(lista.filter((i) => i.adjunto).map((i) => i.adjunto!.id), lista.some((i) => !i.adjunto && !i.error));
  const actualizar = (clave: string, cambio: Partial<Item>) =>
    setItems((xs) => {
      const nuevos = xs.map((x) => (x.clave === clave ? { ...x, ...cambio } : x));
      avisar(nuevos);
      return nuevos;
    });

  function agregar(archivos: FileList | null) {
    if (!archivos?.length) return;
    const nuevos: Item[] = [];
    for (const f of Array.from(archivos)) {
      const clave = `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`;
      const ext = f.name.toLowerCase().split(".").pop() ?? "";
      const error = !EXTENSIONES.includes(ext) ? "Solo PDF, Excel, Word, CSV o fotos." : f.size > MAX ? "Pesa más de 20 MB." : undefined;
      nuevos.push({ clave, nombre: f.name, tamano: f.size, tipo: f.type, progreso: 0, error, vista: f.type.startsWith("image/") && !error ? URL.createObjectURL(f) : undefined });
      if (!error) {
        subirUno(f, entidadTipo, interno, (p) => actualizar(clave, { progreso: p }))
          .then((a) => actualizar(clave, { adjunto: a, progreso: 100 }))
          .catch((e: Error) => actualizar(clave, { error: e.message }));
      }
    }
    setItems((xs) => {
      const lista = [...xs, ...nuevos];
      avisar(lista);
      return lista;
    });
  }

  function quitar(clave: string) {
    setItems((xs) => {
      const it = xs.find((x) => x.clave === clave);
      if (it?.vista) URL.revokeObjectURL(it.vista);
      if (it?.adjunto) void fetch(`/api/adjuntos/${it.adjunto.id}`, { method: "DELETE" });
      const lista = xs.filter((x) => x.clave !== clave);
      avisar(lista);
      return lista;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className={`grid gap-2 ${compacto ? "grid-cols-[1fr_auto]" : "grid-cols-1 sm:grid-cols-[1fr_auto]"}`}>
        <button type="button" onClick={() => elegir.current?.click()} className={`flex items-center justify-center gap-2 rounded-md border border-dashed border-linea-fuerte bg-papel px-4 text-[15px] font-medium hover:bg-hover lg:text-[13px] ${compacto ? "min-h-12 lg:min-h-9" : "min-h-14 lg:min-h-12"}`}>
          <Paperclip className="size-5 lg:size-4" /> {etiqueta}
        </button>
        <button type="button" onClick={() => camara.current?.click()} className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-linea bg-papel px-4 text-[15px] font-medium hover:bg-hover lg:hidden" aria-label="Sacar una foto">
          <Camera className="size-5" /> Foto
        </button>
      </div>
      <input ref={elegir} type="file" multiple accept={ACEPTA} className="hidden" onChange={(e) => { agregar(e.target.files); e.target.value = ""; }} />
      <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { agregar(e.target.files); e.target.value = ""; }} />
      {items.length > 0 && (
        <ul className="flex flex-col divide-y divide-linea rounded-md border border-linea bg-papel">
          {items.map((i) => (
            <li key={i.clave} className="flex items-center gap-3 px-3 py-2">
              {i.vista ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.vista} alt="" className="size-10 shrink-0 rounded object-cover" />
              ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded bg-fondo"><IconoArchivo nombre={i.nombre} /></span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{i.nombre}</p>
                {i.error ? (
                  <p className="text-[12px] text-critico">{i.error}</p>
                ) : i.adjunto ? (
                  <p className="text-[12px] text-suave">{pesoLegible(i.tamano)} · subido</p>
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full bg-tinta" style={{ width: `${i.progreso}%` }} /></div>
                    <span className="text-[11px] text-suave tabular-nums">{i.progreso}%</span>
                  </div>
                )}
              </div>
              <button type="button" onClick={() => quitar(i.clave)} aria-label={`Quitar ${i.nombre}`} className="grid size-10 shrink-0 place-items-center rounded-md text-suave hover:bg-black/[0.04] hover:text-tinta lg:size-8">
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
