"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Hand, Undo2, XCircle } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { useAviso } from "@/components/ui/avisos";
import { cancelarPedido, deshacerCancelacion, soltarPedido, tomarPedido } from "@/lib/acciones/pedidos";

/** Tomar con un toque. Si otro chofer llegó antes: "Ya lo tomó Claudio". */
export function BotonTomar({ pedidoId, grande = false }: { pedidoId: string; grande?: boolean }) {
  const [pendiente, iniciar] = useTransition();
  const aviso = useAviso();
  const router = useRouter();

  return (
    <Boton
      ancho
      tamano={grande ? "grande" : "normal"}
      cargando={pendiente}
      icono={<Hand className="size-5" />}
      onClick={() =>
        iniciar(async () => {
          const r = await tomarPedido(pedidoId);
          if (!r.ok) {
            aviso({ mensaje: r.error, tono: "error" });
            router.refresh();
            return;
          }
          aviso({
            mensaje: `Tomaste el pedido ${r.datos.numero}.`,
            deshacer: async () => {
              const d = await soltarPedido(pedidoId);
              if (!d.ok) aviso({ mensaje: d.error, tono: "error" });
              router.refresh();
            },
          });
          router.refresh();
        })
      }
    >
      Tomar este pedido
    </Boton>
  );
}

export function BotonSoltar({ pedidoId }: { pedidoId: string }) {
  const [pendiente, iniciar] = useTransition();
  const aviso = useAviso();
  const router = useRouter();
  return (
    <Boton
      variante="fantasma"
      ancho
      cargando={pendiente}
      icono={<Undo2 className="size-5" />}
      onClick={() =>
        iniciar(async () => {
          const r = await soltarPedido(pedidoId);
          if (!r.ok) aviso({ mensaje: r.error, tono: "error" });
          else
            aviso({
              mensaje: "El pedido volvió a la cola.",
              deshacer: async () => {
                const d = await tomarPedido(pedidoId);
                if (!d.ok) aviso({ mensaje: d.error, tono: "error" });
                router.refresh();
              },
            });
          router.refresh();
        })
      }
    >
      Devolver a la cola
    </Boton>
  );
}

/** Cancelar con un toque y deshacer durante 10 segundos. Sin "¿Está seguro?". */
export function BotonCancelar({ pedidoId }: { pedidoId: string }) {
  const [pendiente, iniciar] = useTransition();
  const [cancelado, setCancelado] = useState(false);
  const aviso = useAviso();
  const router = useRouter();
  if (cancelado) return null;
  return (
    <Boton
      variante="peligro"
      ancho
      cargando={pendiente}
      icono={<XCircle className="size-5" />}
      onClick={() =>
        iniciar(async () => {
          const r = await cancelarPedido(pedidoId);
          if (!r.ok) {
            aviso({ mensaje: r.error, tono: "error" });
            return;
          }
          setCancelado(true);
          aviso({
            mensaje: "Pedido cancelado.",
            deshacer: async () => {
              const d = await deshacerCancelacion(pedidoId);
              if (!d.ok) aviso({ mensaje: d.error, tono: "error" });
              setCancelado(false);
              router.refresh();
            },
          });
          router.refresh();
        })
      }
    >
      Cancelar pedido
    </Boton>
  );
}
