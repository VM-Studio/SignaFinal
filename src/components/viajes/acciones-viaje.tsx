"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, Flag, MapPinCheck, Play, Truck } from "lucide-react";
import type { EtapaViaje } from "@prisma/client";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { AreaTexto, Campo, Entrada, MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { finalizarViaje, iniciarViaje, llegueAlRetiro, salgoHaciaDestino } from "@/lib/viajes/acciones";
import { enviarOGuardar } from "@/lib/offline/cola";
import { km } from "@/lib/formato";
import { CampoFoto } from "./campo-foto";
import { posicionActual } from "./seguimiento-chofer";

const soloNumeros = (v: string) => v.replace(/\D/g, "");

type Base = { pedidoId: string; numero: number; onGuardadoLocal?: (siguiente: EtapaViaje) => void };

/** Botón 1 · "Iniciar viaje": km del tablero (precargado) y la posición del teléfono para la ruta al retiro. */
export function BotonIniciar({ pedidoId, numero, vehiculo, kmActual, irAlViaje = false, bloqueado, onGuardadoLocal }: Base & {
  vehiculo: string; kmActual: number; irAlViaje?: boolean; bloqueado?: string;
}) {
  const [abierta, setAbierta] = useState(false);
  const [valor, setValor] = useState(String(kmActual));
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const aviso = useAviso();
  const router = useRouter();

  async function salir() {
    setEnviando(true);
    setError(undefined);
    const gps = await posicionActual();
    const datos = { clientId: crypto.randomUUID(), pedidoId, kmSalida: Number(valor), ocurridoEn: new Date().toISOString(), ...(gps ?? {}) };
    const r = await enviarOGuardar({ id: datos.clientId, tipo: "viaje.iniciar", pedidoId, descripcion: `Salida del pedido ${numero} con ${vehiculo}`, datos }, () => iniciarViaje(datos));
    setEnviando(false);
    if (r.estado === "error") return setError(r.error);
    setAbierta(false);
    if (r.estado === "guardado") {
      onGuardadoLocal?.("HACIA_RETIRO");
      aviso({ mensaje: "Sin señal: la salida quedó guardada y se manda sola." });
      return;
    }
    aviso({ mensaje: `Buen viaje. Saliste con ${r.datos.vehiculo}.` });
    if (irAlViaje) router.push(`/viaje/${pedidoId}`);
    router.refresh();
  }

  if (bloqueado) return <p className="rounded-[var(--radius-caja)] bg-fondo px-4 py-3 font-semibold">{bloqueado}</p>;
  return (
    <>
      <Boton ancho tamano="grande" icono={<Play className="size-6" />} onClick={() => setAbierta(true)} className="min-h-[64px] text-xl">Iniciar viaje</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo={`Salir con ${vehiculo}`}>
        <div className="flex flex-col gap-4 p-4">
          <Campo etiqueta="Km del tablero" htmlFor={`km-${pedidoId}`} ayuda={`Último registrado: ${km(kmActual)}. Corregilo si no coincide.`}>
            <Entrada id={`km-${pedidoId}`} inputMode="numeric" value={valor} onChange={(e) => setValor(soloNumeros(e.target.value))} className="text-3xl font-bold tabular-nums" />
          </Campo>
          <MensajeError>{error}</MensajeError>
          <Boton ancho tamano="grande" disabled={!valor} cargando={enviando} onClick={salir} icono={<Play className="size-5" />}>Salir ahora</Boton>
        </div>
      </Hoja>
    </>
  );
}

/** Botón 2 · "Llegué al punto de retiro": un toque. La pantalla pasa sola al tramo a la obra. */
export function BotonLlegueRetiro({ pedidoId, numero, onGuardadoLocal }: Base) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string>();
  const aviso = useAviso();
  const router = useRouter();
  async function llegue() {
    setEnviando(true);
    setError(undefined);
    const gps = await posicionActual();
    const datos = { clientId: crypto.randomUUID(), pedidoId, ocurridoEn: new Date().toISOString(), ...(gps ?? {}) };
    const r = await enviarOGuardar({ id: datos.clientId, tipo: "viaje.retiro", pedidoId, descripcion: `Llegada al retiro del pedido ${numero}`, datos }, () => llegueAlRetiro(datos));
    setEnviando(false);
    if (r.estado === "error") return setError(r.error);
    if (r.estado === "guardado") {
      onGuardadoLocal?.("EN_RETIRO");
      aviso({ mensaje: "Sin señal: la llegada al retiro quedó guardada y se manda sola." });
      return;
    }
    aviso({ mensaje: "Listo. Cuando termines de cargar, salí hacia la obra." });
    router.refresh();
  }
  return (
    <>
      <MensajeError>{error}</MensajeError>
      <Boton ancho tamano="grande" icono={<MapPinCheck className="size-6" />} cargando={enviando} onClick={llegue} className="min-h-[64px] text-xl">Llegué al punto de retiro</Boton>
    </>
  );
}

/** Botón chico · "Salgo hacia el destino" (si no lo toca, lo hace el GPS al alejarse 300 m). */
export function BotonSalgo({ pedidoId, numero, onGuardadoLocal }: Base) {
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();
  async function salgo() {
    setEnviando(true);
    const datos = { clientId: crypto.randomUUID(), pedidoId, ocurridoEn: new Date().toISOString() };
    const r = await enviarOGuardar({ id: datos.clientId, tipo: "viaje.salgo", pedidoId, descripcion: `Salida del retiro del pedido ${numero}`, datos }, () => salgoHaciaDestino(datos));
    setEnviando(false);
    if (r.estado === "guardado") return onGuardadoLocal?.("HACIA_DESTINO");
    router.refresh();
  }
  return <Boton variante="secundario" ancho cargando={enviando} onClick={salgo} icono={<Truck className="size-5" />}>Salgo hacia el destino</Boton>;
}

/** Botón 3 · "Llegué al destino": km de llegada, peajes y foto del remito (opcionales). */
export function BotonFinalizar({ pedidoId, numero, obra, kmSalida, onGuardadoLocal }: Base & { obra: string; kmSalida: number | null }) {
  const [abierta, setAbierta] = useState(false);
  const [kmLlegada, setKmLlegada] = useState("");
  const [peajes, setPeajes] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [obs, setObs] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [terminado, setTerminado] = useState<"guardado" | null>(null);
  const router = useRouter();

  const recorridos = kmLlegada && kmSalida != null ? Number(kmLlegada) - kmSalida : null;

  async function llegar() {
    setError(undefined);
    if (recorridos != null && recorridos < 0) return setError(`Los km de llegada no pueden ser menos que los de salida (${km(kmSalida)}).`);
    // Lo mismo que valida el servidor, para no guardar sin señal algo que después se va a rechazar.
    if (recorridos != null && recorridos > 2000) return setError("Son más de 2.000 km en un viaje. Revisá el número.");
    setEnviando(true);
    const datos = { clientId: crypto.randomUUID(), pedidoId, kmLlegada: Number(kmLlegada), peajes: peajes || "0", observaciones: obs, foto: foto ?? undefined, ocurridoEn: new Date().toISOString() };
    const r = await enviarOGuardar({ id: datos.clientId, tipo: "viaje.finalizar", pedidoId, descripcion: `Llegada del pedido ${numero} a ${obra}`, datos }, () => finalizarViaje(datos));
    setEnviando(false);
    if (r.estado === "error") return setError(r.error);
    if (r.estado === "guardado") {
      onGuardadoLocal?.("FINALIZADO");
      setTerminado("guardado");
      return;
    }
    setAbierta(false);
    router.push(`/viaje/${pedidoId}`);
    router.refresh();
  }

  function cerrar() {
    setAbierta(false);
    setTerminado(null);
    router.refresh();
  }

  return (
    <>
      <Boton ancho tamano="grande" icono={<Flag className="size-6" />} onClick={() => setAbierta(true)} className="min-h-[64px] text-xl">Llegué al destino</Boton>
      <Hoja abierta={abierta} onCerrar={cerrar} titulo={terminado ? "Viaje terminado" : `Llegada a ${obra}`}>
        <div className="p-4">
          {terminado === "guardado" ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CloudOff className="size-10" />
              <p className="text-lg font-bold">Llegada guardada en el teléfono</p>
              <p className="text-suave">Está pendiente de envío. Se manda sola cuando vuelva la señal.</p>
              <Boton ancho onClick={cerrar}>Listo</Boton>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Campo etiqueta="Km del tablero al llegar" htmlFor={`kml-${pedidoId}`} ayuda={kmSalida != null ? `Saliste con ${km(kmSalida)}` : undefined}>
                <Entrada id={`kml-${pedidoId}`} inputMode="numeric" value={kmLlegada} onChange={(e) => setKmLlegada(soloNumeros(e.target.value))} placeholder={kmSalida != null ? String(kmSalida) : ""} className="text-3xl font-bold tabular-nums" autoFocus />
              </Campo>
              {recorridos != null && recorridos >= 0 && <p className="-mt-2 font-semibold">{km(recorridos)} recorridos</p>}
              <Campo etiqueta="Peajes ($, opcional)" htmlFor={`peajes-${pedidoId}`}>
                <Entrada id={`peajes-${pedidoId}`} inputMode="decimal" value={peajes} onChange={(e) => setPeajes(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" />
              </Campo>
              <CampoFoto etiqueta="Foto del remito (opcional)" valor={foto} onCambio={setFoto} />
              <Campo etiqueta="Observaciones (opcional)" htmlFor={`obs-${pedidoId}`}>
                <AreaTexto id={`obs-${pedidoId}`} rows={2} value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} />
              </Campo>
              <MensajeError>{error}</MensajeError>
              <Boton ancho tamano="grande" disabled={!kmLlegada} cargando={enviando} onClick={llegar} icono={<Flag className="size-5" />}>Terminar viaje</Boton>
            </div>
          )}
        </div>
      </Hoja>
    </>
  );
}

/** UN SOLO botón grande con lo que sigue según la etapa (y el chico de "Salgo" mientras carga). */
export function BotonEtapa({ etapa, pedidoId, numero, vehiculo, kmActual, kmSalida, obra, irAlViaje, bloqueado, onGuardadoLocal }: Base & {
  etapa: EtapaViaje; vehiculo: string; kmActual: number; kmSalida: number | null; obra: string; irAlViaje?: boolean; bloqueado?: string;
}) {
  const base = { pedidoId, numero, onGuardadoLocal };
  switch (etapa) {
    case "PROGRAMADO":
      return <BotonIniciar {...base} vehiculo={vehiculo} kmActual={kmActual} irAlViaje={irAlViaje} bloqueado={bloqueado} />;
    case "HACIA_RETIRO":
      return <BotonLlegueRetiro {...base} />;
    case "EN_RETIRO":
      return (
        <div className="flex flex-col gap-2">
          <BotonFinalizar {...base} obra={obra} kmSalida={kmSalida} />
          <BotonSalgo {...base} />
        </div>
      );
    case "HACIA_DESTINO":
      return <BotonFinalizar {...base} obra={obra} kmSalida={kmSalida} />;
    case "FINALIZADO":
      return null;
  }
}
