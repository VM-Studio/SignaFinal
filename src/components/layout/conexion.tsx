"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CloudOff, RefreshCw } from "lucide-react";
import { Hoja } from "@/components/ui/hoja";
import { finalizarViaje, iniciarViaje, registrarCarga } from "@/lib/viajes/acciones";
import { crearPedido } from "@/lib/pedidos/acciones";
import { descartar, enviarPendientes, escuchar, leerEnvios, type Envio } from "@/lib/offline/cola";
import { cuando } from "@/lib/formato";

const ejecutores = {
  // Si al llegar la señal resulta que alguien ya pidió lo mismo, no se crea y se avisa.
  "pedido.crear": async (d: Record<string, unknown>) => {
    const r = await crearPedido(d as Parameters<typeof crearPedido>[0]);
    if (r.ok && r.datos.estado === "duplicado") return { ok: false as const, error: `${r.datos.existente.quien} ya pidió esto ${r.datos.existente.cuando} (pedido ${r.datos.existente.numero}). No se creó otro.` };
    return r;
  },
  "viaje.iniciar": (d: Record<string, unknown>) => iniciarViaje(d as Parameters<typeof iniciarViaje>[0]),
  "viaje.finalizar": (d: Record<string, unknown>) => finalizarViaje(d as Parameters<typeof finalizarViaje>[0]),
  "combustible.cargar": (d: Record<string, unknown>) => registrarCarga(d as Parameters<typeof registrarCarga>[0]),
};

const VACIO: Envio[] = [];
let cache = { texto: "[]", lista: VACIO };
function instantanea() {
  const texto = localStorage.getItem("signa:envios") ?? "[]";
  if (texto !== cache.texto) cache = { texto, lista: leerEnvios() };
  return cache.lista;
}

/** Los envíos guardados en el teléfono (para mostrar "pendiente de envío" donde corresponda). */
export function useEnvios() {
  return useSyncExternalStore(escuchar, instantanea, () => VACIO);
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

/** Franja visible arriba: sin señal y/o envíos pendientes. Manda solo al volver la señal. */
export function IndicadorConexion() {
  const enLinea = useEnLinea();
  const envios = useEnvios();
  const [abierta, setAbierta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();

  async function enviar() {
    setEnviando(true);
    const n = await enviarPendientes(ejecutores);
    setEnviando(false);
    if (n) router.refresh();
  }

  useEffect(() => {
    if (!enLinea) return;
    void enviar();
    const t = window.setInterval(() => void enviar(), 20_000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enLinea]);

  const esperando = envios.filter((e) => !e.error);
  const rechazados = envios.filter((e) => e.error);
  if (enLinea && envios.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setAbierta(true)}
        className={`flex min-h-10 w-full items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white ${rechazados.length ? "bg-critico" : enLinea ? "bg-aviso" : "bg-carbon"}`}
      >
        {!enLinea ? <CloudOff className="size-4" /> : rechazados.length ? <AlertTriangle className="size-4" /> : <RefreshCw className="size-4" />}
        {!enLinea && "Sin señal. "}
        {esperando.length > 0 && `${esperando.length} pendiente${esperando.length === 1 ? "" : "s"} de envío${enLinea ? " · enviando…" : ""}`}
        {esperando.length === 0 && !enLinea && "Lo que cargues se guarda en el teléfono."}
        {rechazados.length > 0 && ` · ${rechazados.length} no se pudo enviar`}
      </button>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Guardado en el teléfono">
        {envios.length === 0 ? (
          <p className="text-suave">No hay nada esperando.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {envios.map((e) => (
              <li key={e.id} className="rounded-[var(--radius-caja)] border border-linea bg-papel p-3">
                <p className="font-semibold">{e.descripcion}</p>
                <p className="text-sm text-suave">Guardado {cuando(e.creadoEn)}</p>
                {e.error ? (
                  <div className="mt-2 flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-critico">No se pudo enviar: {e.error}</p>
                    <button onClick={() => descartar(e.id)} className="min-h-11 shrink-0 px-2 text-sm font-bold underline">Descartar</button>
                  </div>
                ) : (
                  <p className="mt-1 text-sm font-medium">{enLinea ? "Enviando…" : "Pendiente de envío"}</p>
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
      </Hoja>
    </>
  );
}
