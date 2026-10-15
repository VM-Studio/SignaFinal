"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, Flag, Navigation, Play, } from "lucide-react";
import type { EtapaViaje } from "@prisma/client";
import { Boton, BotonLink } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { AreaTexto, Campo, Entrada, MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { finalizarViaje } from "@/lib/viajes/acciones";
import { enviarOGuardar } from "@/lib/offline/cola";
import { bloqueoPorFecha } from "@/lib/viajes/fecha";
import { pedirAdelantar } from "@/lib/pedidos/acciones";
import { CampoFoto } from "./campo-foto";


type Base = { pedidoId: string; numero: number; onGuardadoLocal?: (siguiente: EtapaViaje) => void };

/** "Pedir que lo adelanten": avisa al que pidió y a Dirección para que reprogramen la fecha. */
export function BotonAdelantar({ pedidoId }: { pedidoId: string }) {
  const [estado, setEstado] = useState<"listo" | "enviando" | "enviado">("listo");
  const [error, setError] = useState<string>();
  const aviso = useAviso();
  async function pedir() {
    setEstado("enviando");
    setError(undefined);
    const r = await pedirAdelantar(pedidoId);
    if (!r.ok) {
      setEstado("listo");
      return setError(r.error);
    }
    setEstado("enviado");
    aviso({ mensaje: "Listo: le avisamos al que lo pidió y a Dirección. Si lo reprograman para hoy, lo vas a poder iniciar." });
  }
  return (
    <>
      <MensajeError>{error}</MensajeError>
      <Boton variante="secundario" ancho tamano="grande" cargando={estado === "enviando"} disabled={estado === "enviado"} onClick={pedir}>
        {estado === "enviado" ? "Pedido enviado" : "Pedir que lo adelanten"}
      </Boton>
    </>
  );
}

/**
 * "Iniciar viaje": abre el modo conducción, donde el primer paso es el deslizador "Iniciar viaje" (el chofer no
 * escribe ningún número). Bloqueo por fecha: si el pedido es para otro día, deshabilitado con el motivo (y la
 * action lo rechaza igual).
 */
export function BotonIniciar({ pedidoId, bloqueado, paraCuando }: { pedidoId: string; bloqueado?: string; paraCuando?: Date | string }) {
  if (bloqueado) return <p className="rounded-[var(--radius-caja)] bg-fondo px-4 py-3 font-semibold">{bloqueado}</p>;
  const porFecha = paraCuando ? bloqueoPorFecha(new Date(paraCuando)) : null;
  if (porFecha) {
    return (
      <div className="flex flex-col gap-2">
        <Boton ancho tamano="grande" icono={<Play />} disabled aria-describedby={`fecha-${pedidoId}`}>Iniciar viaje</Boton>
        <p id={`fecha-${pedidoId}`} suppressHydrationWarning className="text-center text-[15px] font-semibold">{porFecha}</p>
        <BotonAdelantar pedidoId={pedidoId} />
      </div>
    );
  }
  return <BotonLink href={`/viaje/${pedidoId}/conducir`} ancho tamano="grande" icono={<Play />}>Iniciar viaje</BotonLink>;
}

/** La hoja de "Terminar viaje" (la abre el último deslizador): peajes, foto del remito y observaciones, todo opcional. */
export function HojaFinalizar({ pedidoId, numero, obra, onGuardadoLocal, abierta, onCerrar, canal = "DESLIZADOR", onTerminado }: Base & {
  obra: string; abierta: boolean; onCerrar: () => void; canal?: "MANUAL" | "DESLIZADOR"; onTerminado?: () => void;
}) {
  const [conPeajes, setConPeajes] = useState(false);
  const [peajes, setPeajes] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [obs, setObs] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [terminado, setTerminado] = useState<"guardado" | null>(null);
  const router = useRouter();

  async function terminar() {
    setError(undefined);
    setEnviando(true);
    const datos = { clientId: crypto.randomUUID(), pedidoId, peajes: conPeajes && peajes ? peajes : "0", observaciones: obs, foto: foto ?? undefined, ocurridoEn: new Date().toISOString(), canal };
    const r = await enviarOGuardar({ id: datos.clientId, tipo: "viaje.finalizar", pedidoId, descripcion: `Llegada del pedido ${numero} a ${obra}`, datos }, () => finalizarViaje(datos));
    setEnviando(false);
    if (r.estado === "error") return setError(r.error);
    if (r.estado === "guardado") {
      onGuardadoLocal?.("FINALIZADO");
      setTerminado("guardado");
      return;
    }
    onCerrar();
    onTerminado?.();
    router.push(`/viaje/${pedidoId}`);
    router.refresh();
  }

  function cerrar() {
    onCerrar();
    setTerminado(null);
    router.refresh();
  }

  return (
    <Hoja abierta={abierta} onCerrar={cerrar} titulo={terminado ? "Viaje terminado" : `Llegada a ${obra}`}>
      <div>
        {terminado === "guardado" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CloudOff className="size-10" />
            <p className="text-lg font-semibold">Llegada guardada en el teléfono</p>
            <p className="text-suave">Está pendiente de envío. Se manda sola cuando vuelva la señal.</p>
            <Boton ancho onClick={cerrar}>Listo</Boton>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-medium text-suave">Peajes</p>
              <div className="grid grid-cols-2 gap-2">
                <Boton variante={conPeajes ? "secundario" : "primario"} tamano="grande" onClick={() => { setConPeajes(false); setPeajes(""); }}>$0</Boton>
                <Boton variante={conPeajes ? "primario" : "secundario"} tamano="grande" onClick={() => setConPeajes(true)}>Escribir</Boton>
              </div>
              {conPeajes && (
                <Entrada aria-label="Peajes ($)" inputMode="decimal" value={peajes} onChange={(e) => setPeajes(e.target.value.replace(/[^\d.]/g, ""))} placeholder="$" autoFocus className="text-2xl font-semibold tabular-nums lg:text-2xl" />
              )}
            </div>
            <CampoFoto etiqueta="Foto del remito (opcional)" valor={foto} onCambio={setFoto} />
            <Campo etiqueta="Observaciones (opcional)" htmlFor={`obs-${pedidoId}`}>
              <AreaTexto id={`obs-${pedidoId}`} rows={2} value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} />
            </Campo>
            <MensajeError>{error}</MensajeError>
            <Boton ancho tamano="grande" cargando={enviando} onClick={terminar} icono={<Flag />}>Terminar viaje</Boton>
          </div>
        )}
      </div>
    </Hoja>
  );
}

/**
 * El único botón que corresponde según la etapa (Hoy, el detalle y la pantalla del viaje): antes de salir,
 * "Iniciar viaje"; en curso, "Seguir el viaje" (el modo conducción, donde están todos los pasos).
 */
export function BotonEtapa({ etapa, pedidoId, bloqueado, paraCuando }: { etapa: EtapaViaje; pedidoId: string; bloqueado?: string; paraCuando?: Date | string }) {
  if (etapa === "PROGRAMADO") return <BotonIniciar pedidoId={pedidoId} bloqueado={bloqueado} paraCuando={paraCuando} />;
  if (etapa === "FINALIZADO") return null;
  return <BotonLink href={`/viaje/${pedidoId}/conducir`} ancho tamano="grande" icono={<Navigation />}>Seguir el viaje</BotonLink>;
}
