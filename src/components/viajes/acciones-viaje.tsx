"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, Flag, Navigation, Play } from "lucide-react";
import type { EtapaViaje } from "@prisma/client";
import { Boton, BotonLink } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { AreaTexto, Campo, Entrada, MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { finalizarViaje, iniciarViaje, llegueAlDestino, llegueAlRetiro, responderLlegada, salgoHaciaDestino } from "@/lib/viajes/acciones";
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
        <div className="flex flex-col gap-4">
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

/** Botones chicos de respaldo: hacen la misma transición que el motor ("Marcar a mano"). */
function BotonManual({ pedidoId, numero, tipo, etiqueta, onGuardadoLocal }: Base & { tipo: "viaje.retiro" | "viaje.salgo" | "viaje.llegada"; etiqueta: string }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string>();
  const router = useRouter();
  const accion = { "viaje.retiro": llegueAlRetiro, "viaje.salgo": salgoHaciaDestino, "viaje.llegada": llegueAlDestino }[tipo];
  const siguiente: EtapaViaje = { "viaje.retiro": "EN_RETIRO" as const, "viaje.salgo": "HACIA_DESTINO" as const, "viaje.llegada": "EN_DESTINO" as const }[tipo];
  async function marcar() {
    setEnviando(true);
    setError(undefined);
    const gps = await posicionActual();
    const datos = { clientId: crypto.randomUUID(), pedidoId, ocurridoEn: new Date().toISOString(), ...(gps ?? {}) };
    const r = await enviarOGuardar({ id: datos.clientId, tipo, pedidoId, descripcion: `${etiqueta} · pedido ${numero}`, datos }, () => accion(datos));
    setEnviando(false);
    if (r.estado === "error") return setError(r.error);
    if (r.estado === "guardado") return onGuardadoLocal?.(siguiente);
    router.refresh();
  }
  return (
    <>
      <MensajeError>{error}</MensajeError>
      <Boton variante="fantasma" ancho cargando={enviando} onClick={marcar} className="underline">{etiqueta}</Boton>
    </>
  );
}

export const BotonLlegueRetiro = (p: Base) => <BotonManual {...p} tipo="viaje.retiro" etiqueta="¿Ya llegaste? Marcar a mano" />;
export const BotonSalgo = (p: Base) => <BotonManual {...p} tipo="viaje.salgo" etiqueta="Salgo ahora" />;
export const BotonLlegueDestino = (p: Base) => <BotonManual {...p} tipo="viaje.llegada" etiqueta="Marcar llegada a mano" />;

/** "Llegaste a Corralón San Martín": Sí, estoy acá / No, todavía no (lo detectó el GPS). */
export function ConfirmarLlegada({ pedidoId, lugar }: { pedidoId: string; lugar: string }) {
  const [enviando, setEnviando] = useState<"si" | "no" | null>(null);
  const router = useRouter();
  const aviso = useAviso();
  async function responder(si: boolean) {
    setEnviando(si ? "si" : "no");
    const r = await responderLlegada(pedidoId, si);
    setEnviando(null);
    if (!r.ok) aviso({ mensaje: r.error, tono: "error" });
    else if (!si) aviso({ mensaje: "Listo. No te vamos a volver a preguntar hasta que salgas y vuelvas a llegar." });
    router.refresh();
  }
  return (
    <section className="rounded-[var(--radius-caja)] border-[3px] border-ok bg-ok-fondo p-4">
      <p className="text-sm font-bold tracking-wider text-ok uppercase">El GPS te ubicó</p>
      <p className="mt-1 text-2xl leading-tight font-bold">Llegaste a {lugar}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Boton tamano="grande" cargando={enviando === "si"} onClick={() => responder(true)}>Sí, estoy acá</Boton>
        <Boton tamano="grande" variante="secundario" cargando={enviando === "no"} onClick={() => responder(false)}>No, todavía no</Boton>
      </div>
      <p className="mt-2 text-sm text-suave">Si no tocás nada en 5 minutos, vale lo del GPS.</p>
    </section>
  );
}

/** "Viaje terminado": km de llegada (≥ salida), peajes y foto del remito (opcionales). */
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
      <Boton ancho tamano="grande" icono={<Flag className="size-6" />} onClick={() => setAbierta(true)} className="min-h-[64px] text-xl">Viaje terminado</Boton>
      <Hoja abierta={abierta} onCerrar={cerrar} titulo={terminado ? "Viaje terminado" : `Llegada a ${obra}`}>
        <div>
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

/**
 * El único botón que corresponde según la etapa (inicio del chofer y pantalla del viaje):
 * PROGRAMADO "Iniciar viaje"; EN_DESTINO "Viaje terminado". En el medio no hay que tocar nada:
 * lo detecta el GPS (en el inicio, "Abrir el viaje"; en la pantalla del viaje, los botones chicos de respaldo).
 */
export function BotonEtapa({ etapa, pedidoId, numero, vehiculo, kmActual, kmSalida, obra, irAlViaje, bloqueado, onGuardadoLocal }: Base & {
  etapa: EtapaViaje; vehiculo: string; kmActual: number; kmSalida: number | null; obra: string; irAlViaje?: boolean; bloqueado?: string;
}) {
  const base = { pedidoId, numero, onGuardadoLocal };
  switch (etapa) {
    case "PROGRAMADO":
      return <BotonIniciar {...base} vehiculo={vehiculo} kmActual={kmActual} irAlViaje={irAlViaje} bloqueado={bloqueado} />;
    case "HACIA_RETIRO":
    case "EN_RETIRO":
    case "HACIA_DESTINO":
      return irAlViaje ? <BotonLink href={`/viaje/${pedidoId}`} ancho tamano="grande" icono={<Navigation className="size-6" />} className="min-h-[64px] text-xl">Abrir el viaje</BotonLink> : null;
    case "EN_DESTINO":
      return <BotonFinalizar {...base} obra={obra} kmSalida={kmSalida} />;
    case "FINALIZADO":
      return null;
  }
}
