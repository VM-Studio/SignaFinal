"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Navigation } from "lucide-react";
import type { EtapaViaje } from "@prisma/client";
import { BotonLink, claseBoton } from "@/components/ui/boton";
import { CheckCircle2 } from "lucide-react";
import { TarjetaChofer } from "./tarjeta-chofer";
import { hora, km, peso } from "@/lib/formato";
import { metros, minutos } from "@/lib/rutas";
import type { PantallaViaje as Datos } from "@/lib/viajes/chofer";
import { BotonEtapa } from "./acciones-viaje";
import { PendienteEnvio } from "./pendiente-envio";
import { BotonSoltar } from "@/components/pedidos/acciones-detalle";

const MapaTramo = dynamic(() => import("@/components/mapa/mapa-tramo"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-[#e9e9e5] text-suave">Cargando mapa…</div>,
});

const TITULO: Record<EtapaViaje, string> = {
  PROGRAMADO: "Primero vas a retirar a",
  HACIA_RETIRO: "Vas a retirar a",
  EN_RETIRO: "Cargando. Después vas a",
  HACIA_DESTINO: "Vas a entregar a",
  FINALIZADO: "Entregado en",
};

/**
 * La pantalla que el chofer tiene abierta mientras maneja: una columna, mapa chico del tramo,
 * a dónde va ahora, "Abrir en Google Maps" y UN SOLO botón con lo que sigue.
 */
export function PantallaViaje({ d }: { d: Datos }) {
  // Si se guardó sin señal, la pantalla avanza igual (queda "Pendiente de envío").
  const [etapaLocal, setEtapaLocal] = useState<EtapaViaje | null>(null);
  const etapa = etapaLocal ?? d.etapa;
  const aDestino = etapa === "EN_RETIRO" || etapa === "HACIA_DESTINO" || etapa === "FINALIZADO";
  const punto = aDestino ? d.entregar : d.retirar;
  const tramo = d.tramo && (d.tramo.hacia === "destino") === aDestino ? d.tramo : null;
  const maps = `https://www.google.com/maps/dir/?api=1&destination=${punto.lat},${punto.lng}&travelmode=driving`;
  const eta = etapa === "HACIA_RETIRO" ? d.etaRetiro : aDestino ? d.etaDestino : null;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      <Link href="/hoy" className="inline-flex min-h-11 items-center gap-1 font-semibold text-suave"><ArrowLeft className="size-5" /> Hoy</Link>

      {tramo && etapa !== "FINALIZADO" && (
        <div className="relative isolate h-[200px] overflow-hidden rounded-[var(--radius-caja)] border border-linea">
          <MapaTramo geometria={tramo.geometria} desde={tramo.desde} hasta={tramo.hasta} nombreHasta={punto.nombre} />
        </div>
      )}

      <section className="rounded-[var(--radius-caja)] border-[3px] border-negro bg-papel p-4">
        <p className="text-sm font-bold tracking-wider text-suave uppercase">{TITULO[etapa]}</p>
        <p className="mt-1 text-2xl leading-tight font-bold">{punto.nombre}</p>
        <p className="text-lg text-suave">{punto.direccion}</p>
        {tramo && etapa !== "FINALIZADO" && etapa !== "EN_RETIRO" && (
          <p className="mt-3 text-xl font-bold tabular-nums">
            {metros(tramo.distanciaM)} · {minutos(tramo.duracionS)}
            {eta && <span className="font-semibold text-suave"> · llegás {hora(eta)}</span>}
            {tramo.estimada && <span className="block text-sm font-normal text-suave">Distancia aproximada (sin ruteo).</span>}
          </p>
        )}
        {!aDestino && d.retiro && (d.retiro.horario || d.retiro.contacto || d.retiro.oc) && (
          <dl className="mt-3 grid gap-1 rounded-[var(--radius-caja)] bg-fondo px-3 py-2 text-[17px]">
            {d.retiro.horario && <div className="flex gap-2"><dt className="font-bold">Horario:</dt><dd>{d.retiro.horario}</dd></div>}
            {d.retiro.contacto && (
              <div className="flex gap-2"><dt className="font-bold">Contacto:</dt>
                <dd>{/(\d[\d\s-]{6,}\d)/.test(d.retiro.contacto) ? <a className="font-semibold underline" href={`tel:${d.retiro.contacto.match(/(\d[\d\s-]{6,}\d)/)![1].replace(/[\s-]/g, "")}`}>{d.retiro.contacto}</a> : d.retiro.contacto}</dd>
              </div>
            )}
            {d.retiro.oc && <div className="flex gap-2"><dt className="font-bold">OC:</dt><dd>{d.retiro.oc}</dd></div>}
          </dl>
        )}
        {etapa !== "FINALIZADO" && (
          <a href={maps} target="_blank" rel="noopener" className={claseBoton("secundario", "grande", true, "mt-4")}>
            <Navigation className="size-5" /> Abrir en Google Maps
          </a>
        )}
      </section>

      <PendienteEnvio pedidoId={d.pedidoId} />

      {etapa === "FINALIZADO" && (
        <>
          <div className="flex gap-3 rounded-[var(--radius-caja)] border-2 border-ok bg-ok-fondo p-4">
            <CheckCircle2 className="size-7 shrink-0 text-ok" />
            <p className="text-lg font-bold">Viaje terminado.{d.kmRecorridos != null ? ` ${km(d.kmRecorridos)}.` : ""} {d.pidio} ya sabe que llegó.</p>
          </div>
          {d.siguiente ? (
            <>
              <p className="mt-2 text-sm font-bold tracking-wider text-suave uppercase">Siguiente</p>
              <ul><TarjetaChofer t={d.siguiente} href={`/viaje/${d.siguiente.pedidoId}`} destacada accion={<BotonLink href={`/viaje/${d.siguiente.pedidoId}`} ancho tamano="grande">Ir al siguiente</BotonLink>} /></ul>
            </>
          ) : (
            <BotonLink href="/hoy" variante="secundario" ancho>No tenés más viajes para hoy · Volver a Hoy</BotonLink>
          )}
        </>
      )}

      <div className="pb-2">
        <BotonEtapa
          etapa={etapa} pedidoId={d.pedidoId} numero={d.numero} vehiculo={d.vehiculo} kmActual={d.kmActual} kmSalida={d.kmSalida}
          obra={d.entregar.nombre} onGuardadoLocal={setEtapaLocal}
          bloqueado={etapa === "PROGRAMADO" && d.otroEnCurso ? "Tenés otro viaje en curso. Terminalo antes de iniciar este." : undefined}
        />
      </div>

      <section className="rounded-[var(--radius-caja)] border border-linea bg-papel p-4 text-[17px]">
        <p className="font-bold">{d.que}</p>
        <p className="text-suave">Pidió {d.pidio}{d.pesoKg ? ` · hasta ${peso(d.pesoKg)}` : ""} · {d.vehiculo} ({d.patente})</p>
        {!aDestino && <p className="mt-2"><span className="text-sm font-bold tracking-wider text-suave uppercase">Después: </span>{d.entregar.nombre} · {d.entregar.direccion}</p>}
        {aDestino && etapa !== "FINALIZADO" && <p className="mt-2"><span className="text-sm font-bold tracking-wider text-suave uppercase">Retiró en: </span>{d.retirar.nombre}</p>}
        {etapa === "PROGRAMADO" && d.salidaEstimada && <p className="mt-2 text-suave">Salida estimada {hora(d.salidaEstimada)} · km actual {km(d.kmActual)}</p>}
      </section>

      {etapa === "PROGRAMADO" && <BotonSoltar pedidoId={d.pedidoId} numero={d.numero} />}
    </div>
  );
}
