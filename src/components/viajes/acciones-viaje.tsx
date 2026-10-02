"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, CloudOff, Flag, Play } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { AreaTexto, Campo, Entrada, MensajeError } from "@/components/ui/campos";
import { useAviso } from "@/components/ui/avisos";
import { iniciarViaje, finalizarViaje, type ResultadoFin } from "@/lib/viajes/acciones";
import { enviarOGuardar } from "@/lib/offline/cola";
import { km, plata } from "@/lib/formato";
import { CampoFoto } from "./campo-foto";

const soloNumeros = (v: string) => v.replace(/\D/g, "");

/** Iniciar: solo el km del tablero, precargado con el último registrado. Funciona sin señal. */
export function BotonIniciar({ pedidoId, numero, vehiculo, kmActual, onGuardadoLocal }: {
  pedidoId: string; numero: number; vehiculo: string; kmActual: number; onGuardadoLocal?: (kmSalida: number) => void;
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
    const datos = { clientId: crypto.randomUUID(), pedidoId, kmSalida: Number(valor), ocurridoEn: new Date().toISOString() };
    const r = await enviarOGuardar({ id: datos.clientId, tipo: "viaje.iniciar", pedidoId, descripcion: `Salida del pedido ${numero} con ${vehiculo}`, datos }, () => iniciarViaje(datos));
    setEnviando(false);
    if (r.estado === "error") return setError(r.error);
    setAbierta(false);
    if (r.estado === "guardado") {
      onGuardadoLocal?.(Number(valor));
      aviso({ mensaje: "Sin señal: la salida quedó guardada y se manda sola." });
      return;
    }
    aviso({ mensaje: `Buen viaje. Saliste con ${r.datos.vehiculo}.` });
    router.refresh();
  }

  return (
    <>
      <Boton ancho tamano="grande" icono={<Play className="size-6" />} onClick={() => setAbierta(true)}>Iniciar viaje</Boton>
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

/** Finalizar: km de llegada, peajes, foto del remito y observaciones. Funciona sin señal. */
export function BotonFinalizar({ pedidoId, numero, obra, kmSalida, onGuardadoLocal }: {
  pedidoId: string; numero: number; obra: string; kmSalida: number | null; onGuardadoLocal?: () => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const [kmLlegada, setKmLlegada] = useState("");
  const [peajes, setPeajes] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [obs, setObs] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [terminado, setTerminado] = useState<ResultadoFin | "guardado" | null>(null);
  const router = useRouter();

  const recorridos = kmLlegada && kmSalida != null ? Number(kmLlegada) - kmSalida : null;

  async function llegar() {
    setError(undefined);
    if (recorridos != null && recorridos < 0) return setError(`Los km de llegada no pueden ser menos que los de salida (${km(kmSalida)}).`);
    // Lo mismo que valida el servidor, para no guardar sin señal algo que después se va a rechazar.
    if (recorridos != null && recorridos > 2000) return setError("Son más de 2.000 km en un viaje. Revisá el número.");
    setEnviando(true);
    const datos = { clientId: crypto.randomUUID(), pedidoId, kmLlegada: Number(kmLlegada), peajes: peajes || "0", observaciones: obs, foto: foto ?? undefined, ocurridoEn: new Date().toISOString() };
    const r = await enviarOGuardar({ id: datos.clientId, tipo: "viaje.finalizar", pedidoId, descripcion: `Llegada del pedido ${numero} a Obra ${obra}`, datos }, () => finalizarViaje(datos));
    setEnviando(false);
    if (r.estado === "error") return setError(r.error);
    if (r.estado === "guardado") {
      onGuardadoLocal?.();
      setTerminado("guardado");
      return;
    }
    setTerminado(r.datos);
  }

  function cerrar() {
    setAbierta(false);
    setTerminado(null);
    router.refresh();
  }

  return (
    <>
      <Boton ancho tamano="grande" icono={<Flag className="size-6" />} onClick={() => setAbierta(true)}>Finalizar viaje</Boton>
      <Hoja abierta={abierta} onCerrar={cerrar} titulo={terminado ? "Viaje terminado" : `Llegada a Obra ${obra}`}>
        {terminado === "guardado" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CloudOff className="size-10" />
            <p className="text-lg font-bold">Llegada guardada en el teléfono</p>
            <p className="text-suave">Está pendiente de envío. Se manda sola cuando vuelva la señal.</p>
            <Boton ancho onClick={cerrar}>Listo</Boton>
          </div>
        ) : terminado ? (
          <div className="flex flex-col gap-4">
            <div className="flex gap-3 rounded-[var(--radius-caja)] border-2 border-ok bg-ok-fondo p-4">
              <CheckCircle2 className="size-7 shrink-0 text-ok" />
              <p className="text-lg font-bold">
                Viaje terminado. {km(terminado.km)}, {plata(terminado.costo)} imputados a Obra {terminado.obra}.
              </p>
            </div>
            {terminado.siguiente ? (
              <Link href={`/viajes#${terminado.siguiente.pedidoId}`} onClick={cerrar} className="flex min-h-[72px] flex-col justify-center rounded-[var(--radius-caja)] bg-negro px-5 py-3 text-white">
                <span className="text-sm text-white/70">Siguiente</span>
                <span className="text-lg font-bold">{terminado.siguiente.descripcion} → Obra {terminado.siguiente.obra}</span>
              </Link>
            ) : (
              <p className="text-suave">No tenés más pedidos tomados.</p>
            )}
            <Boton variante="secundario" ancho onClick={cerrar}>Listo</Boton>
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
      </Hoja>
    </>
  );
}
