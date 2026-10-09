"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { comprimirFoto } from "@/lib/offline/fotos";

/** Foto opcional: abre la cámara trasera, la achica y muestra la vista previa. */
export function CampoFoto({ etiqueta, valor, onCambio }: { etiqueta: string; valor: string | null; onCambio: (dataUrl: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string>();

  async function elegir(f?: File) {
    if (!f) return;
    setProcesando(true);
    setError(undefined);
    try {
      onCambio(await comprimirFoto(f));
    } catch {
      setError("No se pudo leer la foto. Probá de nuevo.");
    } finally {
      setProcesando(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{etiqueta}</span>
      {valor ? (
        <div className="relative w-fit">
          {!valor.startsWith("data:application/pdf") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={valor} alt="Vista previa" className="h-32 rounded-[var(--radius-caja)] border border-linea object-cover" />
          ) : (
            <p className="rounded-md border border-linea bg-papel px-3 py-2 text-sm">PDF adjunto</p>
          )}
          <button type="button" onClick={() => onCambio(null)} aria-label="Quitar foto" className="absolute -top-2 -right-2 grid size-9 place-items-center rounded-full bg-negro text-white">
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={procesando}
          className="flex min-h-12 lg:min-h-9 items-center justify-center gap-2 rounded-[var(--radius-caja)] border border-dashed border-linea-fuerte bg-papel font-semibold disabled:opacity-50"
        >
          <Camera className="size-5" /> {procesando ? "Procesando…" : "Sacar foto"}
        </button>
      )}
      <input ref={input} type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={(e) => elegir(e.target.files?.[0])} />
      {error && <p className="text-sm font-medium text-critico">{error}</p>}
    </div>
  );
}
