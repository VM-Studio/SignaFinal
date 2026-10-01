"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Boton } from "./boton";
import { MensajeError } from "./campos";

/** Formulario largo partido en pasos cortos: cada pantalla entra en el celular sin scroll. */
export function Pasos({ titulos, children, textoFinal, onFinal, validar, enviando, error }: {
  titulos: string[]; children: ReactNode[]; textoFinal: string; onFinal: () => void; validar?: (paso: number) => string | undefined; enviando?: boolean; error?: string;
}) {
  const [paso, setPaso] = useState(0);
  const [aviso, setAviso] = useState<string>();
  const ultimo = paso === titulos.length - 1;
  function siguiente() {
    const p = validar?.(paso);
    setAviso(p);
    if (p) return;
    if (ultimo) onFinal();
    else setPaso(paso + 1);
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {paso > 0 && (
          <button type="button" onClick={() => setPaso(paso - 1)} aria-label="Paso anterior" className="-ml-2 grid size-11 place-items-center rounded-md hover:bg-black/5">
            <ArrowLeft className="size-6" />
          </button>
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold text-suave">Paso {paso + 1} de {titulos.length} · {titulos[paso]}</p>
          <div className="mt-1.5 flex gap-1">
            {titulos.map((t, i) => <span key={t} className={`h-1 flex-1 rounded-full ${i <= paso ? "bg-negro" : "bg-linea"}`} />)}
          </div>
        </div>
      </div>
      {children.map((c, i) => <div key={i} hidden={i !== paso} className="flex flex-col gap-4">{c}</div>)}
      <MensajeError>{aviso ?? error}</MensajeError>
      <Boton ancho tamano="grande" onClick={siguiente} cargando={enviando && ultimo}>{ultimo ? textoFinal : "Siguiente"}</Boton>
    </div>
  );
}
