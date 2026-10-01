"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Opciones } from "@/components/ui/opciones";
import { Campo, Entrada, MensajeError, Selector } from "@/components/ui/campos";
import { Boton } from "@/components/ui/boton";
import { useAviso } from "@/components/ui/avisos";
import { usePanel } from "@/components/ui/panel";
import { crearSolicitud } from "@/lib/acciones/deposito";

export type ItemSolicitable = { id: string; nombre: string; control: "UNITARIA" | "CANTIDAD"; unidad: string | null; disponible: number; enObras: { obraId: string; cantidad: number }[] };

/** Pedir una herramienta al depósito, o avisar que se devuelve. */
export function FormularioSolicitud({ tipo, obras, items }: { tipo: "PEDIDO" | "DEVOLUCION"; obras: { id: string; nombre: string }[]; items: ItemSolicitable[] }) {
  const [obraId, setObraId] = useState(obras.length === 1 ? obras[0].id : "");
  const [itemId, setItemId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();
  const aviso = useAviso();
  const panel = usePanel();

  const lista = items.filter((i) => (tipo === "PEDIDO" ? i.disponible > 0 : i.enObras.some((o) => o.obraId === obraId)));
  const item = items.find((i) => i.id === itemId);

  async function enviar() {
    setEnviando(true);
    const r = await crearSolicitud({ tipo, obraId, itemId, cantidad });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    aviso({ mensaje: tipo === "PEDIDO" ? "Pedido enviado al depósito." : "Avisado al depósito." });
    panel.cerrar();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {obras.length > 1 && (
        <Campo etiqueta="Obra" htmlFor="sol-obra">
          <Selector id="sol-obra" value={obraId} onChange={(e) => { setObraId(e.target.value); setItemId(""); }}>
            <option value="">Elegí la obra</option>
            {obras.map((o) => <option key={o.id} value={o.id}>Obra {o.nombre}</option>)}
          </Selector>
        </Campo>
      )}
      {obraId && (
        lista.length === 0 ? (
          <p className="text-suave">{tipo === "PEDIDO" ? "No hay nada disponible en el depósito." : "No hay herramientas del depósito en esta obra."}</p>
        ) : (
          <Opciones
            nombre="Herramienta"
            valor={itemId}
            onElegir={setItemId}
            opciones={lista.map((i) => ({
              valor: i.id,
              titulo: i.nombre,
              detalle: i.control === "CANTIDAD" ? (tipo === "PEDIDO" ? `${i.disponible} en depósito` : `${i.enObras.find((o) => o.obraId === obraId)?.cantidad ?? 0} en la obra`) : undefined,
            }))}
          />
        )
      )}
      {item?.control === "CANTIDAD" && (
        <Campo etiqueta={`Cantidad (${item.unidad ?? "unidades"})`} htmlFor="sol-cant">
          <Entrada id="sol-cant" inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/\D/g, ""))} />
        </Campo>
      )}
      <MensajeError>{error}</MensajeError>
      <Boton ancho tamano="grande" disabled={!obraId || !itemId} cargando={enviando} onClick={enviar}>
        {tipo === "PEDIDO" ? "Pedir al depósito" : "Avisar devolución"}
      </Boton>
    </div>
  );
}
