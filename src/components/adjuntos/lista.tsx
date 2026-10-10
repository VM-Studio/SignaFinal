"use client";

import { useState } from "react";
import { Download, Eye, Lock } from "lucide-react";
import { Hoja } from "@/components/ui/hoja";
import { claseBoton } from "@/components/ui/boton";
import { cuando } from "@/lib/formato";
import { IconoArchivo, pesoLegible } from "./subir";

export type AdjuntoVista = { id: string; nombre: string; tipoMime: string; tamanoBytes: number; interno: boolean; creadoEn: string; subidoPor: string };

const seVe = (tipo: string) => tipo === "application/pdf" || tipo.startsWith("image/");

/**
 * Archivos adjuntos con visor integrado: PDF e imágenes se abren dentro de la app (sin salir); Excel,
 * Word y CSV se descargan. "Solo Compras" marca los internos (el solicitante no los ve).
 */
export function ListaAdjuntos({ adjuntos }: { adjuntos: AdjuntoVista[] }) {
  const [viendo, setViendo] = useState<AdjuntoVista | null>(null);
  if (!adjuntos.length) return null;
  return (
    <>
      <ul className="flex flex-col divide-y divide-linea rounded-[var(--radius-caja)] border border-linea bg-papel">
        {adjuntos.map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
            {a.tipoMime.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/adjuntos/${a.id}`} alt="" loading="lazy" className="size-10 shrink-0 rounded object-cover" />
            ) : (
              <span className="grid size-10 shrink-0 place-items-center rounded bg-fondo"><IconoArchivo nombre={a.nombre} /></span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.nombre}</p>
              <p className="flex items-center gap-1 text-[12px] text-suave">
                {a.interno && <><Lock className="size-3" /> Solo Compras ·</>} {pesoLegible(a.tamanoBytes)} · {a.subidoPor} · <span suppressHydrationWarning>{cuando(a.creadoEn)}</span>
              </p>
            </div>
            {seVe(a.tipoMime) && (
              <button type="button" onClick={() => setViendo(a)} className={claseBoton("secundario", "chico")}><Eye /> Ver</button>
            )}
            <a href={`/api/adjuntos/${a.id}?descargar=1`} className={claseBoton(seVe(a.tipoMime) ? "fantasma" : "secundario", "chico")} aria-label={`Descargar ${a.nombre}`}>
              <Download /> <span className={seVe(a.tipoMime) ? "sr-only" : ""}>Descargar</span>
            </a>
          </li>
        ))}
      </ul>
      <Hoja abierta={!!viendo} onCerrar={() => setViendo(null)} titulo={viendo?.nombre ?? ""} ancho>
        {viendo && (viendo.tipoMime.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/adjuntos/${viendo.id}`} alt={viendo.nombre} className="mx-auto max-h-[78dvh] w-auto rounded-md" />
        ) : (
          <iframe src={`/api/adjuntos/${viendo.id}`} title={viendo.nombre} className="h-[78dvh] w-full rounded-md border border-linea bg-fondo" />
        ))}
      </Hoja>
    </>
  );
}
