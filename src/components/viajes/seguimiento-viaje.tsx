"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { FileText, MapPinned, Phone } from "lucide-react";
import { Boton, claseBoton } from "@/components/ui/boton";
import { useAviso } from "@/components/ui/avisos";
import { hora } from "@/lib/formato";
import type { DatosSeguimiento } from "@/lib/viajes/seguimiento";
import { avanzarSimulado } from "@/lib/viajes/simulador";

const MapaSeguimiento = dynamic(() => import("@/components/mapa/mapa-seguimiento"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-[#e9e9e5] text-suave">Cargando mapa…</div>,
});

const CADA_MS = 20_000;
const EN_CURSO = ["HACIA_RETIRO", "EN_RETIRO", "HACIA_DESTINO"];

/**
 * Seguimiento en vivo, como PedidosYa: cuatro pasos, el mapa con el vehículo (cada 20 s),
 * una frase grande con cuánto falta, y llamar al chofer.
 */
export function SeguimientoViaje({ pedidoId, inicial, demo = false }: { pedidoId: string; inicial: DatosSeguimiento; demo?: boolean }) {
  const [d, setD] = useState(inicial);
  const [moviendo, setMoviendo] = useState(false);
  const aviso = useAviso();

  const actualizar = useCallback(async () => {
    try {
      const r = await fetch(`/api/viajes/${pedidoId}/seguimiento`, { cache: "no-store" });
      if (r.ok) setD((await r.json()) as DatosSeguimiento);
    } catch {
      // Sin señal: queda lo último que se vio y se reintenta en 20 s.
    }
  }, [pedidoId]);

  const vivo = d.etapa !== null && d.etapa !== "FINALIZADO" && d.estado !== "ENTREGADO" && d.estado !== "CANCELADO";
  useEffect(() => {
    if (!vivo) return;
    const t = window.setInterval(actualizar, CADA_MS);
    return () => window.clearInterval(t);
  }, [vivo, actualizar]);

  const pasos = [
    { titulo: "Pedido", fecha: d.pasos.pedido },
    { titulo: "Aceptado", fecha: d.pasos.aceptado },
    { titulo: "Retiro", fecha: d.pasos.retiro },
    { titulo: "Entregado", fecha: d.pasos.entregado },
  ];
  const actual = pasos.reduce((a, p, i) => (p.fecha ? i : a), 0);
  const conMapa = !!d.posicion && d.etapa !== null && EN_CURSO.includes(d.etapa);

  return (
    <section aria-label="Seguimiento del pedido" className="mt-3 overflow-hidden rounded-[var(--radius-caja)] border-2 border-negro bg-papel">
      <ol className="grid grid-cols-4 gap-1 p-4 pb-3">
        {pasos.map((p, i) => (
          <li key={p.titulo}>
            <span className={`block h-2 rounded-full ${i <= actual ? "bg-negro" : "bg-linea"}`} />
            <span className={`mt-1.5 block text-[13px] leading-tight ${i === actual ? "font-bold" : i < actual ? "font-medium" : "text-apagado"}`}>{p.titulo}</span>
            <span className="block text-xs text-suave tabular-nums">{p.fecha ? hora(p.fecha) : " "}</span>
          </li>
        ))}
      </ol>

      {conMapa && d.posicion && (
        <div className="relative isolate h-[240px] border-y border-linea">
          <MapaSeguimiento retiro={d.retiro} destino={d.destino} vehiculo={d.posicion} ruta={d.ruta} etapaRetiro={d.etapa === "HACIA_RETIRO"} />
        </div>
      )}

      <div className="p-4">
        <p aria-live="polite" className="text-2xl leading-tight font-bold">{d.frase}</p>
        {conMapa && d.posicion && <p className="mt-1 text-sm text-suave">Posición de las {hora(d.posicion.fecha)} · se actualiza sola</p>}
        {d.vehiculo && <p className="mt-1 text-suave">{d.chofer?.nombre} · {d.vehiculo}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {d.chofer?.telefono ? (
            <a href={`tel:${d.chofer.telefono.replace(/\s/g, "")}`} className={claseBoton("primario", "normal", true)}><Phone className="size-5" /> Llamar a {d.chofer.nombre}</a>
          ) : <span />}
          <a href="#detalle" className={claseBoton("secundario", "normal", true)}><FileText className="size-5" /> Ver qué pidió</a>
        </div>
        {demo && vivo && d.etapa && EN_CURSO.includes(d.etapa) && (
          <Boton variante="secundario" ancho className="mt-2" cargando={moviendo} icono={<MapPinned className="size-5" />} onClick={async () => {
            setMoviendo(true);
            const r = await avanzarSimulado(pedidoId);
            setMoviendo(false);
            if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
            await actualizar();
          }}>
            Demo: avanzar 1 km
          </Boton>
        )}
      </div>
    </section>
  );
}
