"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { AreaTexto, Campo, Entrada, Fecha, MensajeError } from "@/components/ui/campos";
import { Opciones } from "@/components/ui/opciones";
import { useAviso } from "@/components/ui/avisos";
import { editarPedidoPendiente } from "@/lib/pedidos/acciones";
import { BotonCancelar } from "./acciones-detalle";

/** "Editar" una solicitud pendiente: fecha, prioridad y qué llevar (con aviso al que pidió y a los choferes). */
export function EditarSolicitud({ p }: { p: { id: string; dia: string; franja: "MANANA" | "TARDE" | "HORA_EXACTA"; hora: string; prioridad: "NORMAL" | "URGENTE"; descripcion: string } }) {
  const router = useRouter();
  const aviso = useAviso();
  const [abierta, setAbierta] = useState(false);
  const [d, setD] = useState(p);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  return (
    <>
      <Boton variante="secundario" tamano="chico" icono={<Pencil />} onClick={() => { setD(p); setAbierta(true); }}>Editar</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Editar la solicitud">
        <div className="flex flex-col gap-4">
          <Campo etiqueta="Día" htmlFor={`ed-dia-${p.id}`}><Fecha id={`ed-dia-${p.id}`} value={d.dia} onChange={(e) => setD({ ...d, dia: e.target.value })} /></Campo>
          <Opciones nombre="Franja" columnas={3} valor={d.franja} onElegir={(v) => setD({ ...d, franja: v as typeof d.franja })} opciones={[{ valor: "MANANA", titulo: "A la mañana" }, { valor: "TARDE", titulo: "A la tarde" }, { valor: "HORA_EXACTA", titulo: "Hora exacta" }]} />
          {d.franja === "HORA_EXACTA" && <Campo etiqueta="Hora" htmlFor={`ed-hora-${p.id}`}><Entrada id={`ed-hora-${p.id}`} type="time" value={d.hora} onChange={(e) => setD({ ...d, hora: e.target.value })} /></Campo>}
          <Opciones nombre="Prioridad" columnas={2} valor={d.prioridad} onElegir={(v) => setD({ ...d, prioridad: v as typeof d.prioridad })} opciones={[{ valor: "NORMAL", titulo: "Normal" }, { valor: "URGENTE", titulo: "Urgente" }]} />
          <Campo etiqueta="Qué hay que llevar" htmlFor={`ed-que-${p.id}`}><AreaTexto id={`ed-que-${p.id}`} rows={3} maxLength={240} value={d.descripcion} onChange={(e) => setD({ ...d, descripcion: e.target.value })} /></Campo>
          <MensajeError>{error}</MensajeError>
          <Boton ancho cargando={enviando} onClick={async () => {
            setError(undefined);
            setEnviando(true);
            const r = await editarPedidoPendiente({ pedidoId: p.id, dia: d.dia, franja: d.franja, hora: d.franja === "HORA_EXACTA" ? d.hora : undefined, prioridad: d.prioridad, descripcion: d.descripcion });
            setEnviando(false);
            if (!r.ok) return setError(r.error);
            setAbierta(false);
            aviso({ mensaje: "Guardado. Le avisamos al que pidió y a los choferes." });
            router.refresh();
          }}>Guardar cambios</Boton>
        </div>
      </Hoja>
    </>
  );
}

export { BotonCancelar };
