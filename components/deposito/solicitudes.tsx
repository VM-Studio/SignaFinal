"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, ArrowRight } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Estado } from "@/components/ui/estado";
import { Entrada } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { completarSolicitud, deshacerMovimiento, rechazarSolicitud, cancelarSolicitud } from "@/lib/acciones/deposito";
import { ESTADO_SOLICITUD } from "@/lib/etiquetas";
import { cuando } from "@/lib/formato";

export type SolicitudPlana = {
  id: string;
  tipo: "PEDIDO" | "DEVOLUCION";
  estado: "PENDIENTE" | "COMPLETADA" | "RECHAZADA" | "CANCELADA";
  cantidad: number;
  unidad: string | null;
  control: "UNITARIA" | "CANTIDAD";
  item: string;
  obra: string;
  solicitante: string;
  observaciones: string | null;
  motivoRechazo: string | null;
  creadaEn: string;
};

function Titulo({ s }: { s: SolicitudPlana }) {
  const cant = s.control === "CANTIDAD" ? `${s.cantidad} ${s.unidad ?? ""} de ` : "";
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-suave">{s.tipo === "PEDIDO" ? "Piden" : "Devuelven"}</p>
      <p className="text-lg leading-tight font-bold">
        {cant}
        {s.item}
      </p>
      <p className="mt-1 flex items-center gap-1.5 font-medium">
        {s.tipo === "PEDIDO" ? (
          <>
            Depósito <ArrowRight className="size-4 text-suave" /> Obra {s.obra}
          </>
        ) : (
          <>
            Obra {s.obra} <ArrowRight className="size-4 text-suave" /> Depósito
          </>
        )}
      </p>
      <p className="text-sm text-suave">
        {s.solicitante} · {cuando(s.creadaEn)}
      </p>
      {s.observaciones && <p className="mt-1 text-sm">“{s.observaciones}”</p>}
    </>
  );
}

/** Para el depósito: entregar / recibir con un toque, con deshacer. */
export function SolicitudDeposito({ s }: { s: SolicitudPlana }) {
  const [pendiente, iniciar] = useTransition();
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const aviso = useAviso();
  const router = useRouter();

  function completar() {
    iniciar(async () => {
      const r = await completarSolicitud(s.id);
      if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
      aviso({
        mensaje: s.tipo === "PEDIDO" ? `Entregado a Obra ${s.obra}.` : `Recibido en el depósito.`,
        deshacer: async () => {
          const d = await deshacerMovimiento(r.datos.movimientoId);
          if (!d.ok) aviso({ mensaje: d.error, tono: "error" });
          router.refresh();
        },
      });
      router.refresh();
    });
  }

  function rechazar() {
    iniciar(async () => {
      const r = await rechazarSolicitud(s.id, motivo);
      if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
      aviso({ mensaje: "Solicitud rechazada." });
      router.refresh();
    });
  }

  return (
    <li className="rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
      <Titulo s={s} />
      {rechazando ? (
        <div className="mt-3 flex flex-col gap-2">
          <Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="¿Por qué no se puede?" autoFocus maxLength={200} />
          <div className="grid grid-cols-2 gap-2">
            <Boton variante="secundario" onClick={() => setRechazando(false)}>Volver</Boton>
            <Boton variante="peligro" cargando={pendiente} disabled={motivo.trim().length < 3} onClick={rechazar}>Rechazar</Boton>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <Boton cargando={pendiente} onClick={completar} icono={<Check className="size-5" />}>
            {s.tipo === "PEDIDO" ? "Entregar" : "Recibir"}
          </Boton>
          <Boton variante="secundario" aria-label="Rechazar" onClick={() => setRechazando(true)} icono={<X className="size-5" />}>
            <span className="sr-only lg:not-sr-only">No se puede</span>
          </Boton>
        </div>
      )}
    </li>
  );
}

/** Para la obra: ver el estado de lo que pidió, y cancelar si sigue pendiente. */
export function SolicitudObra({ s }: { s: SolicitudPlana }) {
  const [pendiente, iniciar] = useTransition();
  const aviso = useAviso();
  const router = useRouter();
  const est = ESTADO_SOLICITUD[s.estado];
  return (
    <li className="rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Titulo s={s} />
        </div>
        <Estado tono={est.tono}>{est.texto}</Estado>
      </div>
      {s.motivoRechazo && <p className="mt-2 text-sm font-medium text-critico">Depósito: {s.motivoRechazo}</p>}
      {s.estado === "PENDIENTE" && (
        <Boton
          className="mt-3"
          variante="fantasma"
          tamano="chico"
          cargando={pendiente}
          onClick={() =>
            iniciar(async () => {
              const r = await cancelarSolicitud(s.id);
              if (!r.ok) aviso({ mensaje: r.error, tono: "error" });
              else aviso({ mensaje: "Solicitud cancelada." });
              router.refresh();
            })
          }
        >
          Cancelar solicitud
        </Boton>
      )}
    </li>
  );
}
