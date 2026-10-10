"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { FileText, MapPinned, Phone } from "lucide-react";
import { Boton, claseBoton } from "@/components/ui/boton";
import { useAviso } from "@/components/ui/avisos";
import { haceSeg, hora } from "@/lib/formato";
import type { DatosSeguimiento } from "@/lib/viajes/seguimiento";
import { avanzarSimulado, simularEtapa, type PasoDemo } from "@/lib/viajes/simulador";
import { useAlCambiar } from "@/components/layout/avisos-en-vivo";
import { ColumnaMapa } from "@/components/ui/columna-mapa";

const MapaSeguimiento = dynamic(() => import("@/components/mapa/mapa-seguimiento"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-fondo text-sm text-suave">Cargando mapa…</div>,
});

const CADA_MS = 20_000;
const EN_CURSO = ["HACIA_RETIRO", "EN_RETIRO", "HACIA_DESTINO", "EN_DESTINO"];

/**
 * Seguimiento en vivo, como PedidosYa: cuatro pasos, el mapa con el vehículo (cada 20 s),
 * una frase grande con cuánto falta, y llamar al chofer.
 */
export function SeguimientoViaje({ pedidoId, inicial, demo = false, cabecera, resto, embebido = false }: { pedidoId: string; inicial: DatosSeguimiento; demo?: boolean; cabecera?: ReactNode; resto?: ReactNode; embebido?: boolean }) {
  const [d, setD] = useState(inicial);
  const [moviendo, setMoviendo] = useState(false);
  const [simulando, setSimulando] = useState<PasoDemo | null>(null);
  const aviso = useAviso();

  const actualizar = useCallback(async () => {
    try {
      const r = await fetch(`/api/viajes/${pedidoId}/seguimiento`, { cache: "no-store" });
      if (r.ok) setD((await r.json()) as DatosSeguimiento);
    } catch {
      // Sin señal: queda lo último que se vio y se reintenta en 20 s.
    }
  }, [pedidoId]);

  // Cada aviso nuevo del viaje (aceptado, salió, llegó…) refresca el seguimiento sin esperar los 20 s.
  useAlCambiar((tipo) => tipo === "aviso" && void actualizar());

  const vivo = d.etapa !== null && d.etapa !== "FINALIZADO" && d.estado !== "ENTREGADO" && d.estado !== "CANCELADO";
  useEffect(() => {
    if (!vivo) return;
    const t = window.setInterval(actualizar, CADA_MS);
    return () => window.clearInterval(t);
  }, [vivo, actualizar]);

  const pasos = [
    { titulo: "Aceptado", fecha: d.pasos.aceptado },
    { titulo: "Salió", fecha: d.pasos.salio },
    { titulo: "En el retiro", fecha: d.pasos.retiro },
    { titulo: "En camino", fecha: d.pasos.enCamino },
    { titulo: "Entregado", fecha: d.pasos.entregado },
  ];
  const actual = pasos.reduce((a, p, i) => (p.fecha ? i : a), 0);
  const conMapa = !!d.posicion && d.etapa !== null && EN_CURSO.includes(d.etapa);

  const info = (
    <section aria-label="Seguimiento del pedido" className="rounded-[var(--radius-caja)] border border-linea bg-papel">
      <ol className="grid grid-cols-5 gap-1 p-4 pb-3">
        {pasos.map((p, i) => (
          <li key={p.titulo}>
            <span className={`block h-1 rounded-full ${i <= actual ? "bg-tinta" : "bg-linea"}`} />
            <span className={`mt-1.5 block text-[12px] leading-tight ${i === actual ? "font-semibold" : i < actual ? "font-medium" : "text-suave"}`}>{p.titulo}</span>
            <span className="block text-[11px] text-suave tabular-nums">{p.fecha ? hora(p.fecha) : " "}</span>
          </li>
        ))}
      </ol>

      <div className="border-t border-linea p-4">
        <p aria-live="polite" className="text-lg leading-6 font-semibold">{d.frase}</p>
        {conMapa && d.posicion && (
          <p suppressHydrationWarning className="mt-1 text-sm text-suave">
            {d.posicion.fuente === "TELEFONO" ? "GPS del teléfono" : d.posicion.fuente === "CUSAT" ? "GPS Cusat" : "GPS"} · {haceSeg(d.posicion.fecha)} · se actualiza sola
          </p>
        )}
        {d.vehiculo && <p className="mt-1 text-sm text-suave">{d.chofer?.nombre} · {d.vehiculo}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {d.chofer?.telefono ? (
            <a href={`tel:${d.chofer.telefono.replace(/\s/g, "")}`} className={claseBoton("primario", "normal", true)}><Phone /> Llamar a {d.chofer.nombre}</a>
          ) : <span />}
          <a href="#detalle" className={claseBoton("secundario", "normal", true)}><FileText /> Ver qué pidió</a>
        </div>
        {demo && vivo && d.etapa && EN_CURSO.includes(d.etapa) && d.etapa !== "EN_DESTINO" && (
          <div className="mt-3 rounded-[var(--radius-caja)] border border-dashed border-linea-fuerte p-3">
            <p className="mb-2 etiqueta">Demo · simular GPS</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {([["retiro", "Llegó al retiro", "HACIA_RETIRO"], ["salio", "Salió", "EN_RETIRO"], ["destino", "Llegó a destino", "HACIA_DESTINO"]] as const).map(([paso, titulo, cuando]) => (
                <Boton key={paso} variante="secundario" disabled={d.etapa !== cuando || !!simulando} cargando={simulando === paso} onClick={async () => {
                  setSimulando(paso);
                  const r = await simularEtapa(pedidoId, paso);
                  setSimulando(null);
                  if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
                  await actualizar();
                }}>
                  Simular: {titulo.toLowerCase()}
                </Boton>
              ))}
            </div>
          </div>
        )}
        {demo && vivo && d.etapa && EN_CURSO.includes(d.etapa) && (
          <Boton variante="secundario" ancho className="mt-2" cargando={moviendo} icono={<MapPinned />} onClick={async () => {
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
  const mapa = conMapa && d.posicion && <MapaSeguimiento retiro={d.retiro} destino={d.destino} vehiculo={d.posicion} ruta={d.ruta} etapaRetiro={d.etapa === "HACIA_RETIRO"} paradas={d.paradas} />;
  // Dentro de otra pantalla (pedido de material): la tarjeta y el mapa debajo.
  if (embebido) {
    return (
      <div className="flex flex-col gap-3">
        {info}
        {mapa && <div className="relative isolate h-[240px] overflow-hidden rounded-[var(--radius-caja)] border border-linea">{mapa}</div>}
      </div>
    );
  }
  const detalle = <div id="detalle" className="flex scroll-mt-20 flex-col gap-3">{resto}</div>;
  // Con el vehículo en camino: columna de 400px y el mapa a la derecha (en el celular, el mapa en el medio).
  if (mapa) return <ColumnaMapa arriba={<>{cabecera}{info}</>} abajo={detalle} altoCelular="h-[260px]" mapa={mapa} />;
  return (
    <div className="flex flex-col gap-4">
      {cabecera}
      <div className="grid gap-4 lg:grid-cols-[400px_1fr] lg:items-start">
        {info}
        {detalle}
      </div>
    </div>
  );
}
