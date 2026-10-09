"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2, XCircle } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { Opciones } from "@/components/ui/opciones";
import { Entrada, MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { cancelarPedido, deshacerCancelacion, soltarPedido, tomarPedido } from "@/lib/pedidos/acciones";
import { MOTIVOS_CANCELACION } from "@/lib/pedidos/presentacion";

/** Cancelar con motivo (elegido de una lista; "Otro" se escribe). Deshacer 10 s. */
export function BotonCancelar({ pedidoId }: { pedidoId: string }) {
  const [abierta, setAbierta] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [otro, setOtro] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const aviso = useAviso();
  const router = useRouter();

  async function confirmar() {
    setEnviando(true);
    const r = await cancelarPedido(pedidoId, motivo === "otro" ? otro : motivo);
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    setAbierta(false);
    aviso({
      mensaje: "Pedido cancelado.",
      deshacer: async () => {
        const x = await deshacerCancelacion(pedidoId);
        if (!x.ok) aviso({ mensaje: x.error, tono: "error" });
        router.refresh();
      },
    });
    router.refresh();
  }

  return (
    <>
      <Boton variante="peligro" ancho icono={<XCircle />} onClick={() => setAbierta(true)}>Cancelar pedido</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="¿Por qué se cancela?">
        <div className="flex flex-col gap-3">
          <Opciones
            nombre="Motivo"
            valor={motivo}
            onElegir={setMotivo}
            opciones={[...MOTIVOS_CANCELACION.map((m) => ({ valor: m, titulo: m })), { valor: "otro", titulo: "Otro motivo" }]}
          />
          {motivo === "otro" && <Entrada aria-label="Motivo" value={otro} onChange={(e) => setOtro(e.target.value)} maxLength={200} placeholder="Contá por qué" autoFocus />}
          <MensajeError>{error}</MensajeError>
          <Boton variante="peligro" ancho disabled={!motivo || (motivo === "otro" && otro.trim().length < 3)} cargando={enviando} onClick={confirmar}>
            Cancelar pedido
          </Boton>
        </div>
      </Hoja>
    </>
  );
}

/** El chofer suelta el pedido: vuelve a la cola. Deshacer lo vuelve a tomar igual. */
export function BotonSoltar({ pedidoId, numero }: { pedidoId: string; numero: number }) {
  const [enviando, setEnviando] = useState(false);
  const aviso = useAviso();
  const router = useRouter();
  return (
    <Boton
      variante="secundario"
      ancho
      cargando={enviando}
      icono={<Undo2 />}
      onClick={async () => {
        setEnviando(true);
        const r = await soltarPedido(pedidoId);
        setEnviando(false);
        if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
        const antes = r.datos;
        aviso({
          mensaje: `Soltaste el pedido ${numero}. Volvió a las solicitudes y le avisamos a quien lo pidió.`,
          deshacer: antes
            ? async () => {
                const x = await tomarPedido({ pedidoId, vehiculoId: antes.vehiculoId, salida: antes.salida });
                if (!x.ok) aviso({ mensaje: x.error, tono: "error" });
                router.refresh();
              }
            : undefined,
        });
        router.refresh();
      }}
    >
      Soltar pedido
    </Boton>
  );
}
