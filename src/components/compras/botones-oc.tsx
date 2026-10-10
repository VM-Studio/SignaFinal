"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, RotateCcw } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { AreaTexto, Campo, MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { anularOC, corregirOC } from "@/lib/compras/acciones";

/** "Corregir y reenviar": OC nueva precargada con la rechazada (sale con número nuevo). */
export function BotonCorregirOC({ ocId }: { ocId: string }) {
  const router = useRouter();
  const aviso = useAviso();
  const [enviando, setEnviando] = useState(false);
  return (
    <Boton ancho icono={<RotateCcw />} cargando={enviando} onClick={async () => {
      setEnviando(true);
      const r = await corregirOC(ocId);
      setEnviando(false);
      if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
      router.push(`/compras/${r.datos.pedidoMaterialId}/oc`);
    }}>Corregir y reenviar</Boton>
  );
}

export function BotonAnularOC({ ocId, numero }: { ocId: string; numero: string | null }) {
  const router = useRouter();
  const aviso = useAviso();
  const [abierta, setAbierta] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  return (
    <>
      <Boton variante="peligro" ancho icono={<Ban />} onClick={() => setAbierta(true)}>Anular {numero ?? "borrador"}</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo={`Anular ${numero ?? "la orden de compra"}`}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-suave">El número no se vuelve a usar. El pedido vuelve a “En compra” para armar otra.</p>
          <Campo etiqueta="¿Por qué se anula?" htmlFor="anular-motivo"><AreaTexto id="anular-motivo" rows={3} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus /></Campo>
          <MensajeError>{error}</MensajeError>
          <Boton variante="peligro" ancho cargando={enviando} disabled={motivo.trim().length < 3} onClick={async () => {
            setEnviando(true);
            const r = await anularOC(ocId, motivo);
            setEnviando(false);
            if (!r.ok) return setError(r.error);
            setAbierta(false);
            aviso({ mensaje: `${numero ?? "Borrador"} anulada.` });
            router.refresh();
          }}>Anular</Boton>
        </div>
      </Hoja>
    </>
  );
}
