"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, RefreshCw, AlertTriangle, X } from "lucide-react";
import { crearPedido } from "@/lib/acciones/pedidos";
import { finalizarViaje, iniciarViaje } from "@/lib/acciones/viajes";
import { cargarCombustible } from "@/lib/acciones/flota";
import { descartar, enviarPendientes, escucharEnvios, leerEnvios, type Envio } from "@/lib/offline/cola";
import { cuando } from "@/lib/formato";

const ejecutores = {
  "pedido.crear": (d: Record<string, unknown>) => crearPedido(d as Parameters<typeof crearPedido>[0]),
  "viaje.iniciar": (d: Record<string, unknown>) => iniciarViaje(d as Parameters<typeof iniciarViaje>[0]),
  "viaje.finalizar": (d: Record<string, unknown>) => finalizarViaje(d as Parameters<typeof finalizarViaje>[0]),
  "combustible.cargar": (d: Record<string, unknown>) => cargarCombustible(d as Parameters<typeof cargarCombustible>[0]),
};

const SIN_ENVIOS: Envio[] = [];
let cache: { texto: string; envios: Envio[] } = { texto: "[]", envios: SIN_ENVIOS };

function instantanea() {
  const texto = typeof localStorage === "undefined" ? "[]" : localStorage.getItem("signa:envios-pendientes") ?? "[]";
  if (texto !== cache.texto) cache = { texto, envios: leerEnvios() };
  return cache.envios;
}

function useEnLinea() {
  return useSyncExternalStore(
    (fn) => {
      window.addEventListener("online", fn);
      window.addEventListener("offline", fn);
      return () => {
        window.removeEventListener("online", fn);
        window.removeEventListener("offline", fn);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

/** Franja visible cuando no hay señal o hay cosas esperando para enviarse. */
export function IndicadorConexion() {
  const enLinea = useEnLinea();
  const envios = useSyncExternalStore(escucharEnvios, instantanea, () => SIN_ENVIOS);
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();

  async function enviar() {
    setEnviando(true);
    const { enviados } = await enviarPendientes(ejecutores);
    setEnviando(false);
    if (enviados) router.refresh();
  }

  useEffect(() => {
    if (!enLinea) return;
    void enviar();
    const t = window.setInterval(() => void enviar(), 30_000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enLinea]);

  const esperando = envios.filter((e) => !e.error);
  const rechazados = envios.filter((e) => e.error);
  if (enLinea && envios.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className={`flex w-full items-center justify-center gap-2 px-4 py-2 text-sm font-semibold ${
          rechazados.length ? "bg-critico text-white" : enLinea ? "bg-aviso text-white" : "bg-carbon text-white"
        }`}
      >
        {!enLinea ? <CloudOff className="size-4" /> : rechazados.length ? <AlertTriangle className="size-4" /> : <RefreshCw className="size-4" />}
        {!enLinea && "Sin señal. "}
        {esperando.length > 0 && `${esperando.length} ${esperando.length === 1 ? "envío guardado" : "envíos guardados"}${enLinea ? ", enviando…" : ", se mandan al volver la señal"}`}
        {esperando.length === 0 && !enLinea && "Lo que cargues se guarda en el teléfono."}
        {rechazados.length > 0 && ` ${rechazados.length} no se pudo enviar. Tocá para ver.`}
      </button>

      {abierto && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 lg:items-center" onClick={() => setAbierto(false)}>
          <div className="pb-segura w-full max-w-md rounded-t-2xl bg-papel p-4 lg:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Guardado en el teléfono</h2>
              <button aria-label="Cerrar" onClick={() => setAbierto(false)} className="grid size-11 place-items-center">
                <X className="size-5" />
              </button>
            </div>
            {envios.length === 0 ? (
              <p className="text-suave">No hay nada esperando.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {envios.map((e) => (
                  <li key={e.id} className="rounded-[var(--radius-caja)] border border-linea p-3">
                    <p className="font-semibold">{e.descripcion}</p>
                    <p className="text-sm text-suave">Guardado {cuando(e.creadoEn)}</p>
                    {e.error ? (
                      <div className="mt-2 flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-critico">No se pudo enviar: {e.error}</p>
                        <button onClick={() => descartar(e.id)} className="shrink-0 text-sm font-bold underline">
                          Descartar
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm font-medium">{enLinea ? "Enviando…" : "Esperando señal"}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {enLinea && esperando.length > 0 && (
              <button onClick={enviar} disabled={enviando} className="mt-3 min-h-[52px] w-full rounded-[var(--radius-caja)] bg-negro font-semibold text-white disabled:opacity-50">
                {enviando ? "Enviando…" : "Enviar ahora"}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
