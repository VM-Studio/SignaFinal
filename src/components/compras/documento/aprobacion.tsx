"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileText, Stamp, X } from "lucide-react";
import { aprobarDocumento, autorizarPago, deshacerAprobacion, rechazarDocumento } from "@/lib/compras/documento-acciones";
import { useAviso } from "@/components/ui/avisos";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { AreaTexto, MensajeError } from "@/components/ui/campos";

/** Aprobar (con 10 s para deshacer) o Rechazar con el motivo (vuelve a Compras y lo ve arriba de la orden). */
export function BotonesAprobacion({ id, nombre }: { id: string; nombre: string }) {
  const router = useRouter();
  const aviso = useAviso();
  const [enviando, setEnviando] = useState<"si" | "no" | null>(null);
  const [rechazar, setRechazar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string>();
  return (
    <div className="grid grid-cols-2 gap-2">
      <Boton tamano="grande" cargando={enviando === "si"} icono={<Stamp />} onClick={async () => {
        setEnviando("si");
        const r = await aprobarDocumento(id);
        setEnviando(null);
        if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
        aviso({ mensaje: `${nombre} autorizada.`, deshacer: async () => { const x = await deshacerAprobacion(id); if (!x.ok) aviso({ mensaje: x.error, tono: "error" }); router.refresh(); } });
        router.refresh();
      }}>Aprobar</Boton>
      <Boton tamano="grande" variante="secundario" icono={<X />} onClick={() => setRechazar(true)}>Rechazar</Boton>
      <Hoja abierta={rechazar} onCerrar={() => setRechazar(false)} titulo={`Rechazar ${nombre}`}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[12px] font-medium text-suave">Motivo (lo ve Compras arriba de la orden)<AreaTexto autoFocus rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={1000} /></label>
          <MensajeError>{error}</MensajeError>
          <Boton variante="peligro" cargando={enviando === "no"} disabled={motivo.trim().length < 3} onClick={async () => {
            setEnviando("no");
            const r = await rechazarDocumento(id, motivo);
            setEnviando(null);
            if (!r.ok) return setError(r.error);
            setRechazar(false);
            aviso({ mensaje: "Rechazada: vuelve a Compras con el motivo." });
            router.refresh();
          }}>Rechazar</Boton>
        </div>
      </Hoja>
    </div>
  );
}

export function BotonAutorizarPago({ id }: { id: string }) {
  const router = useRouter();
  const aviso = useAviso();
  const [enviando, setEnviando] = useState(false);
  return (
    <Boton cargando={enviando} icono={<Stamp />} onClick={async () => {
      setEnviando(true);
      const r = await autorizarPago(id);
      setEnviando(false);
      if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
      aviso({ mensaje: "Pago autorizado. Administración ya tiene el aviso." });
      router.refresh();
    }}>Autorizar pago</Boton>
  );
}

/** El PDF embebido (la plantilla impresa), plegable. */
export function PdfPlegable({ ocId, numero, abierto: inicial = false }: { ocId: string; numero: string; abierto?: boolean }) {
  const [abierto, setAbierto] = useState(inicial);
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} className="flex min-h-12 items-center gap-2 self-start rounded-md border border-linea bg-papel px-3 text-sm font-medium hover:bg-hover lg:min-h-9">
        <FileText className="size-4" /> {abierto ? "Ocultar el PDF" : "Ver el PDF"} <ChevronDown className={`size-4 ${abierto ? "rotate-180" : ""}`} />
      </button>
      {abierto && <iframe title={`PDF de la ${numero}`} src={`/api/oc/${ocId}/pdf`} className="h-[70dvh] w-full lg:h-[640px] rounded-[var(--radius-caja)] border border-linea bg-papel" />}
    </div>
  );
}
