"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Flag, Navigation, PackageOpen, Satellite, Smartphone, WifiOff } from "lucide-react";
import type { EtapaViaje } from "@prisma/client";
import { BotonLink, claseBoton } from "@/components/ui/boton";
import { TarjetaChofer } from "./tarjeta-chofer";
import { haceSeg, hora, km, peso } from "@/lib/formato";
import { metros, minutos } from "@/lib/rutas";
import type { PantallaViaje as Datos } from "@/lib/viajes/chofer";
import { BotonEtapa, BotonLlegueDestino, BotonLlegueRetiro, BotonSalgo, ConfirmarLlegada } from "./acciones-viaje";
import { PendienteEnvio } from "./pendiente-envio";
import { BotonSoltar } from "@/components/pedidos/acciones-detalle";

const MapaTramo = dynamic(() => import("@/components/mapa/mapa-tramo"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-[#e9e9e5] text-suave">Cargando mapa…</div>,
});

/** Mientras la pantalla está abierta, se refresca para ver lo que detectó el GPS. */
const REFRESCO_MS = 15_000;
const CON_MOTOR: EtapaViaje[] = ["HACIA_RETIRO", "EN_RETIRO", "HACIA_DESTINO", "EN_DESTINO"];

/**
 * La pantalla que el chofer tiene abierta mientras maneja. Toca dos botones: "Iniciar viaje" y
 * "Viaje terminado". Lo del medio (llegó al retiro, salió, llegó a la obra) lo detecta el GPS y la
 * pantalla cambia sola; abajo, chicos, los botones para marcarlo a mano si el GPS falla.
 */
export function PantallaViaje({ d }: { d: Datos }) {
  const router = useRouter();
  // Si se guardó sin señal, la pantalla avanza igual (queda "Pendiente de envío").
  const [local, setLocal] = useState<{ de: EtapaViaje; a: EtapaViaje } | null>(null);
  const etapa = local && local.de === d.etapa ? local.a : d.etapa;

  useEffect(() => {
    if (!CON_MOTOR.includes(d.etapa)) return;
    const t = window.setInterval(() => !document.hidden && router.refresh(), REFRESCO_MS);
    return () => window.clearInterval(t);
  }, [d.etapa, router]);

  const base = { pedidoId: d.pedidoId, numero: d.numero, onGuardadoLocal: (a: EtapaViaje) => setLocal({ de: d.etapa, a }) };
  const aRetiro = etapa === "PROGRAMADO" || etapa === "HACIA_RETIRO";
  const punto = aRetiro ? d.retirar : d.entregar;
  const tramo = d.tramo && (d.tramo.hacia === "retiro") === aRetiro ? d.tramo : null;
  const maps = (p: { lat: number; lng: number }) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;
  const eta = etapa === "HACIA_RETIRO" ? d.etaRetiro : etapa === "HACIA_DESTINO" || etapa === "EN_RETIRO" ? d.etaDestino : null;
  const mapa = tramo && (etapa === "PROGRAMADO" || etapa === "HACIA_RETIRO" || etapa === "HACIA_DESTINO" || etapa === "EN_RETIRO") && (
    <div className="relative isolate h-[200px] overflow-hidden rounded-[var(--radius-caja)] border border-linea">
      <MapaTramo geometria={tramo.geometria} desde={tramo.desde} hasta={tramo.hasta} nombreHasta={punto.nombre} />
    </div>
  );
  const distancia = tramo && (
    <p className="mt-3 text-xl font-bold tabular-nums">
      {metros(tramo.distanciaM)} · {minutos(tramo.duracionS)}
      {eta && <span className="font-semibold text-suave"> · llegás {hora(eta)}</span>}
      {tramo.estimada && <span className="block text-sm font-normal text-suave">Distancia aproximada (sin ruteo).</span>}
    </p>
  );
  const abrirMaps = (p: { lat: number; lng: number }) => (
    <a href={maps(p)} target="_blank" rel="noopener" className={claseBoton("secundario", "grande", true, "mt-4")}>
      <Navigation className="size-5" /> Abrir en Google Maps
    </a>
  );
  const telefono = d.retiro?.contacto?.match(/(\d[\d\s-]{6,}\d)/)?.[1];
  const datosRetiro = d.retiro && (d.retiro.horario || d.retiro.contacto || d.retiro.oc) && (
    <dl className="mt-3 grid gap-1 rounded-[var(--radius-caja)] bg-fondo px-3 py-2 text-[17px]">
      {d.retiro.horario && <div className="flex gap-2"><dt className="font-bold">Horario:</dt><dd>{d.retiro.horario}</dd></div>}
      {d.retiro.contacto && (
        <div className="flex gap-2"><dt className="font-bold">Preguntar por:</dt>
          <dd>{telefono ? <a className="font-semibold underline" href={`tel:${telefono.replace(/[\s-]/g, "")}`}>{d.retiro.contacto}</a> : d.retiro.contacto}</dd>
        </div>
      )}
      {d.retiro.oc && <div className="flex gap-2"><dt className="font-bold">OC:</dt><dd>{d.retiro.oc}</dd></div>}
    </dl>
  );

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      <Link href="/hoy" className="inline-flex min-h-11 items-center gap-1 font-semibold text-suave"><ArrowLeft className="size-5" /> Hoy</Link>

      {/* El GPS detectó una llegada: el chofer la confirma o la niega. */}
      {d.confirmar && etapa === d.etapa && <ConfirmarLlegada pedidoId={d.pedidoId} lugar={d.confirmar.lugar} />}

      {(etapa === "PROGRAMADO" || etapa === "HACIA_RETIRO") && (
        <>
          {mapa}
          <section className="rounded-[var(--radius-caja)] border-[3px] border-negro bg-papel p-4">
            <p className="text-sm font-bold tracking-wider text-suave uppercase">{etapa === "PROGRAMADO" ? "Primero vas a" : "Vas a"}</p>
            <p className="mt-1 text-2xl leading-tight font-bold">{d.retirar.nombre}</p>
            <p className="text-lg text-suave">{d.retirar.direccion}</p>
            {datosRetiro}
            {etapa === "HACIA_RETIRO" ? (
              <>
                {distancia}
                {abrirMaps(d.retirar)}
              </>
            ) : (
              d.salidaEstimada && <p className="mt-2 text-suave">Salida estimada {hora(d.salidaEstimada)} · km actual {km(d.kmActual)}</p>
            )}
          </section>
        </>
      )}

      {etapa === "EN_RETIRO" && (
        <>
          <section className="flex gap-3 rounded-[var(--radius-caja)] border-[3px] border-negro bg-papel p-4">
            <PackageOpen className="mt-1 size-7 shrink-0" />
            <div>
              <p className="text-2xl leading-tight font-bold">Cargando en {d.retirar.nombre}</p>
              <p className="mt-1 text-suave">Cuando salgas no toques nada: el GPS se da cuenta solo.</p>
            </div>
          </section>
          {mapa}
          <section className="rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
            <p className="text-sm font-bold tracking-wider text-suave uppercase">Después vas a</p>
            <p className="mt-1 text-xl leading-tight font-bold">{d.entregar.nombre}</p>
            <p className="text-suave">{d.entregar.direccion}</p>
            {distancia}
            {abrirMaps(d.entregar)}
          </section>
        </>
      )}

      {etapa === "HACIA_DESTINO" && (
        <>
          {mapa}
          <section className="rounded-[var(--radius-caja)] border-[3px] border-negro bg-papel p-4">
            <p className="text-sm font-bold tracking-wider text-suave uppercase">Vas a entregar a</p>
            <p className="mt-1 text-2xl leading-tight font-bold">{d.entregar.nombre}</p>
            <p className="text-lg text-suave">{d.entregar.direccion}</p>
            {distancia}
            {abrirMaps(d.entregar)}
          </section>
        </>
      )}

      {etapa === "EN_DESTINO" && (
        <section className="flex gap-3 rounded-[var(--radius-caja)] border-[3px] border-ok bg-ok-fondo p-4">
          <Flag className="mt-1 size-7 shrink-0 text-ok" />
          <div>
            <p className="text-2xl leading-tight font-bold">Llegaste a {d.entregar.nombre}</p>
            <p className="mt-1">Cuando descargues, tocá <b>Viaje terminado</b> y anotá los km.</p>
          </div>
        </section>
      )}

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

      <PendienteEnvio pedidoId={d.pedidoId} />

      {/* El botón grande: solo para empezar y para terminar. */}
      {(etapa === "PROGRAMADO" || etapa === "EN_DESTINO") && (
        <BotonEtapa
          etapa={etapa} {...base} vehiculo={d.vehiculo} kmActual={d.kmActual} kmSalida={d.kmSalida} obra={d.entregar.nombre}
          bloqueado={etapa === "PROGRAMADO" && d.otroEnCurso ? "Tenés otro viaje en curso. Terminalo antes de iniciar este." : undefined}
        />
      )}

      {/* Respaldo manual, chico: hace lo mismo que el GPS. */}
      {etapa === "HACIA_RETIRO" && <BotonLlegueRetiro {...base} />}
      {etapa === "EN_RETIRO" && <BotonSalgo {...base} />}
      {(etapa === "HACIA_DESTINO" || etapa === "EN_RETIRO") && <BotonLlegueDestino {...base} />}

      <section className="rounded-[var(--radius-caja)] border border-linea bg-papel p-4 text-[17px]">
        <p className="font-bold">{d.que}</p>
        <p className="text-suave">Pidió {d.pidio}{d.pesoKg ? ` · hasta ${peso(d.pesoKg)}` : ""} · {d.vehiculo} ({d.patente})</p>
        {aRetiro && <p className="mt-2"><span className="text-sm font-bold tracking-wider text-suave uppercase">Después: </span>{d.entregar.nombre} · {d.entregar.direccion}</p>}
      </section>

      {etapa === "PROGRAMADO" && <BotonSoltar pedidoId={d.pedidoId} numero={d.numero} />}

      {d.senal && etapa !== "FINALIZADO" && etapa !== "PROGRAMADO" && <Senal s={d.senal} />}
    </div>
  );
}

/** Al pie, chico: de dónde sale la posición y hace cuánto. */
function Senal({ s }: { s: NonNullable<Datos["senal"]> }) {
  if (s.sinSenal || !s.fecha) {
    return <p suppressHydrationWarning className="flex items-center justify-center gap-1.5 pb-2 text-sm font-semibold text-critico"><WifiOff className="size-4" /> Sin señal: usá los botones</p>;
  }
  const Icono = s.fuente === "TELEFONO" ? Smartphone : Satellite;
  const fuente = s.fuente === "TELEFONO" ? "GPS del teléfono" : s.fuente === "CUSAT" ? "GPS Cusat" : "GPS simulado";
  return <p suppressHydrationWarning className="flex items-center justify-center gap-1.5 pb-2 text-sm text-suave"><Icono className="size-4" /> {fuente} {haceSeg(s.fecha)}</p>;
}
