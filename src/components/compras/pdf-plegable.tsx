"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Boton, claseBoton } from "@/components/ui/boton";

/** El PDF de la OC embebido (se carga al abrirlo), y "Imprimir" que lo abre en otra pestaña. */
export function PdfPlegable({ ocId, numero }: { ocId: string; numero: string | null }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Boton variante="secundario" tamano="chico" icono={<FileText />} onClick={() => setAbierto((x) => !x)}>{abierto ? "Ocultar el PDF" : "Ver el PDF"}</Boton>
        <a href={`/api/oc/${ocId}/pdf`} target="_blank" rel="noopener" className={claseBoton("fantasma", "chico")}>Imprimir</a>
      </div>
      {abierto && <iframe src={`/api/oc/${ocId}/pdf`} title={`PDF de ${numero ?? "la orden de compra"}`} className="h-[70dvh] w-full rounded-md border border-linea bg-fondo" />}
    </div>
  );
}
