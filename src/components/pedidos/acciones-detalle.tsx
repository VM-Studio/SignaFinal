"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Undo2, XCircle } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { Opciones } from "@/components/ui/opciones";
import { Campo, Entrada, MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { cancelarPedido, deshacerCancelacion, iniciarViaje, soltarPedido, tomarPedido } from "@/lib/pedidos/acciones";
import { MOTIVOS_CANCELACION } from "@/lib/pedidos/presentacion";
import { km } from "@/lib/formato";

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
      <Boton variante="peligro" ancho icono={<XCircle className="size-5" />} onClick={() => setAbierta(true)}>Cancelar pedido</Boton>
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
          <Boton variante="peligro" ancho tamano="grande" disabled={!motivo || (motivo === "otro" && otro.trim().length < 3)} cargando={enviando} onClick={confirmar}>
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
      icono={<Undo2 className="size-5" />}
      onClick={async () => {
        setEnviando(true);
        const r = await soltarPedido(pedidoId);
        setEnviando(false);
        if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
        const antes = r.datos;
        aviso({
          mensaje: `Soltaste el pedido ${numero}. Volvió a la cola.`,
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

/** Iniciar el viaje: km del tablero y salir. */
export function IniciarViaje({ pedidoId, vehiculo, kmActual }: { pedidoId: string; vehiculo: string; kmActual: number }) {
  const [abierta, setAbierta] = useState(false);
  const [kmSalida, setKmSalida] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const aviso = useAviso();
  const router = useRouter();

  async function salir() {
    setEnviando(true);
    setError(undefined);
    const r = await iniciarViaje(pedidoId, Number(kmSalida));
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    setAbierta(false);
    aviso({ mensaje: `Buen viaje. Saliste con ${r.datos.vehiculo}.` });
    router.refresh();
  }

  return (
    <>
      <Boton ancho tamano="grande" icono={<Play className="size-5" />} onClick={() => setAbierta(true)}>Iniciar viaje</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo={`Salir con ${vehiculo}`}>
        <div className="flex flex-col gap-4">
          <Campo etiqueta="Km del tablero ahora" htmlFor="km-salida" ayuda={`Último registrado: ${km(kmActual)}`}>
            <Entrada id="km-salida" inputMode="numeric" pattern="[0-9]*" value={kmSalida} onChange={(e) => setKmSalida(e.target.value.replace(/\D/g, ""))} placeholder={String(kmActual)} className="text-2xl font-bold tabular-nums" autoFocus />
          </Campo>
          <MensajeError>{error}</MensajeError>
          <Boton ancho tamano="grande" disabled={!kmSalida} cargando={enviando} onClick={salir} icono={<Play className="size-5" />}>Salir ahora</Boton>
        </div>
      </Hoja>
    </>
  );
}
