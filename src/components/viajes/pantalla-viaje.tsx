"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Flag, Navigation, PackageOpen, Satellite, Smartphone, WifiOff } from "lucide-react";
import type { EtapaViaje } from "@prisma/client";
import { BotonLink, claseBoton } from "@/components/ui/boton";
import { FechaGrande, TarjetaChofer } from "./tarjeta-chofer";
import { haceSeg, hora, km, peso } from "@/lib/formato";
import { metros, minutos } from "@/lib/rutas/formato";
import type { PantallaViaje as Datos } from "@/lib/viajes/chofer";
import { useEscritorio } from "@/components/ui/escritorio";
import { BotonEtapa, BotonManual, ConfirmarLlegada } from "./acciones-viaje";
import { PendienteEnvio } from "./pendiente-envio";
import { useAlCambiar } from "@/components/layout/avisos-en-vivo";
import { BotonSoltar } from "@/components/pedidos/acciones-detalle";

const MapaTramo = dynamic(() => import("@/components/mapa/mapa-tramo"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-fondo text-sm text-suave">Cargando mapa…</div>,
});

/** Mientras la pantalla está abierta, se refresca para ver lo que detectó el GPS. */
const REFRESCO_MS = 15_000;
const CON_MOTOR: EtapaViaje[] = ["HACIA_RETIRO", "EN_RETIRO", "HACIA_DESTINO", "EN_DESTINO"];

/**
 * La pantalla que el chofer tiene abierta mientras maneja. Toca dos botones: "Iniciar viaje" y
 * "Viaje terminado". Lo del medio (llegó al retiro, salió, llegó a la obra) lo detecta el GPS y la
 * pantalla cambia sola; abajo, el botón manual de la parada actual ("Llegué al proveedor") por si el GPS falla.
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

  // Si el GPS cambió la etapa (el stream de avisos lo detecta), se refresca al instante.
  useAlCambiar((tipo) => tipo === "viaje" && router.refresh());

  const base = { pedidoId: d.pedidoId, numero: d.numero, onGuardadoLocal: (a: EtapaViaje) => setLocal({ de: d.etapa, a }) };
  const aRetiro = etapa === "PROGRAMADO" || etapa === "HACIA_RETIRO";
  const punto = aRetiro ? d.retirar : d.entregar;
  const tramo = d.tramo && (d.tramo.hacia === "retiro") === aRetiro ? d.tramo : null;
  const maps = (p: { lat: number; lng: number }) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;
  const eta = etapa === "HACIA_RETIRO" ? d.etaRetiro : etapa === "HACIA_DESTINO" || etapa === "EN_RETIRO" ? d.etaDestino : null;
  // Celular: el mapa va debajo de la tarjeta (lo primero que se lee es a dónde va) y no antes de salir.
  // Escritorio: a la derecha, a todo el alto, siempre que haya tramo.
  const escritorio = useEscritorio();
  const conMapa = tramo && (etapa === "HACIA_RETIRO" || etapa === "HACIA_DESTINO" || etapa === "EN_RETIRO");
  const mapaTramo = tramo && <MapaTramo geometria={tramo.geometria} desde={tramo.desde} hasta={tramo.hasta} nombreHasta={punto.nombre} />;
  const mapa = !escritorio && conMapa && <div className="relative isolate h-[200px] overflow-hidden rounded-[var(--radius-caja)] border border-linea">{mapaTramo}</div>;
  // Sin tránsito real (sin Google) solo distancia; con Google, minutos y "llegás 11:04 (con tránsito)".
  const distancia = tramo && (
    <p className="mt-4 text-[15px] font-medium tabular-nums">
      {metros(tramo.distanciaM)}
      {eta && <span suppressHydrationWarning> · {minutos(Math.max(60, (new Date(eta).getTime() - Date.now()) / 1000))} · llegás {hora(eta)} (con tránsito)</span>}
      {tramo.estimada && <span className="block text-[12px] font-normal text-suave">Distancia aproximada (sin ruteo).</span>}
    </p>
  );
  const abrirMaps = (p: { lat: number; lng: number }) => (
    <a href={maps(p)} target="_blank" rel="noopener" className={claseBoton("secundario", "normal", false, "mt-3 w-full lg:w-auto")}>
      <Navigation /> Abrir en Google Maps
    </a>
  );
  const telefono = d.retiro?.contacto?.match(/(\d[\d\s-]{6,}\d)/)?.[1];
  const datosRetiro = d.retiro && (d.retiro.horario || d.retiro.contacto || d.retiro.oc) && (
    <dl className="mt-3 grid gap-1 rounded-md bg-fondo px-3 py-2 text-sm">
      {d.retiro.horario && <div className="flex gap-2"><dt className="text-suave">Horario</dt><dd>{d.retiro.horario}</dd></div>}
      {d.retiro.contacto && (
        <div className="flex gap-2"><dt className="text-suave">Preguntar por</dt>
          <dd>{telefono ? <a className="font-medium underline" href={`tel:${telefono.replace(/[\s-]/g, "")}`}>{d.retiro.contacto}</a> : d.retiro.contacto}</dd>
        </div>
      )}
      {d.retiro.oc && <div className="flex gap-2"><dt className="text-suave">OC</dt><dd>{d.retiro.oc}</dd></div>}
    </dl>
  );
  /** A dónde va: etiqueta de 11px, destino a 22px, dirección gris. En el celular es la tarjeta del viaje en curso. */
  const destino = (etiqueta: string, nombre: string, direccion: string, resto?: React.ReactNode) => (
    <section className="rounded-[var(--radius-caja)] border border-linea bg-papel p-4 lg:border-0 lg:bg-transparent lg:p-0">
      <p className="etiqueta">{etiqueta}</p>
      <p className="mt-1 text-2xl leading-7 font-semibold">{nombre}</p>
      <p className="mt-0.5 text-sm text-suave">{direccion}</p>
      {resto}
    </section>
  );

  const columna = (
    <div className="flex flex-col gap-3 lg:gap-4">
      <Link href="/hoy" className="inline-flex min-h-10 items-center gap-1 self-start text-sm font-medium text-suave hover:text-tinta lg:min-h-8"><ArrowLeft className="size-4" /> Hoy</Link>

      {/* Primero, la fecha del viaje: la del pedido, grande y en palabras. */}
      {etapa !== "FINALIZADO" && <FechaGrande fecha={d.paraCuando} franja={d.franja} iniciado={etapa !== "PROGRAMADO"} className="text-[22px] leading-7" />}

      {/* El GPS detectó una llegada: el chofer la confirma o la niega. */}
      {d.confirmar && etapa === d.etapa && <ConfirmarLlegada pedidoId={d.pedidoId} lugar={d.confirmar.lugar} />}

      {(etapa === "PROGRAMADO" || etapa === "HACIA_RETIRO") && (
        <>
          {destino(etapa === "PROGRAMADO" ? "Primero vas a" : "Vas a", d.retirar.nombre, d.retirar.direccion, (
            <>
              {datosRetiro}
              {etapa === "HACIA_RETIRO" ? (
                <>
                  {distancia}
                  {abrirMaps(d.retirar)}
                </>
              ) : (
                d.salidaEstimada && <p className="mt-3 text-sm text-suave">Salida estimada {hora(d.salidaEstimada)} · km actual {km(d.kmActual)}</p>
              )}
            </>
          ))}
          {mapa}
        </>
      )}

      {etapa === "EN_RETIRO" && (
        <>
          <section className="flex gap-3 rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
            <PackageOpen className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="text-lg leading-6 font-semibold">Cargando en {d.retirar.nombre}</p>
              <p className="mt-1 text-sm text-suave">Cuando salgas no toques nada: el GPS se da cuenta solo.</p>
            </div>
          </section>
          {mapa}
          {destino("Después vas a", d.entregar.nombre, d.entregar.direccion, (
            <>
              {distancia}
              {abrirMaps(d.entregar)}
            </>
          ))}
        </>
      )}

      {etapa === "HACIA_DESTINO" && (
        <>
          {destino("Vas a entregar a", d.entregar.nombre, d.entregar.direccion, (
            <>
              {distancia}
              {abrirMaps(d.entregar)}
            </>
          ))}
          {mapa}
        </>
      )}

      {etapa === "EN_DESTINO" && (
        <section className="flex gap-3 rounded-[var(--radius-caja)] bg-ok-fondo p-4">
          <Flag className="mt-0.5 size-5 shrink-0 text-ok" />
          <div>
            <p className="text-lg leading-6 font-semibold">Llegaste a {d.entregar.nombre}</p>
            <p className="mt-1 text-sm">Cuando descargues, tocá <b>Viaje terminado</b> y anotá los km.</p>
          </div>
        </section>
      )}

      {etapa === "FINALIZADO" && (
        <>
          <div className="flex gap-3 rounded-[var(--radius-caja)] bg-ok-fondo p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" />
            <p className="font-medium">Viaje terminado.{d.kmRecorridos != null ? ` ${km(d.kmRecorridos)}.` : ""} {d.pidio} ya sabe que llegó.</p>
          </div>
          {d.siguiente ? (
            <>
              <p className="mt-2 etiqueta">Siguiente</p>
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
          etapa={etapa} {...base} vehiculo={d.vehiculo} kmActual={d.kmActual} kmSalida={d.kmSalida} obra={d.entregar.nombre} paraCuando={d.paraCuando}
          bloqueado={etapa === "PROGRAMADO" && d.otroEnCurso ? "Tenés otro viaje en curso. Terminalo antes de iniciar este." : undefined}
        />
      )}

      {/* Manual, de la parada actual y con la palabra del lugar: hace lo mismo que el GPS. Sin GPS, es el principal. */}
      {etapa === "HACIA_RETIRO" && <BotonManual {...base} tipo="viaje.retiro" etiqueta={d.manual.llegue} paradaId={d.manual.paradaId} principal={d.sinGps} />}
      {etapa === "EN_RETIRO" && <BotonManual {...base} tipo="viaje.salgo" etiqueta={d.manual.salgo} paradaId={d.manual.paradaId} principal={d.sinGps} />}
      {etapa === "HACIA_DESTINO" && <BotonManual {...base} tipo="viaje.llegada" etiqueta={d.manual.llegue} paradaId={d.manual.paradaId} principal={d.sinGps} />}

      <section className="rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
        <p className="etiqueta">Pedido {d.numero}</p>
        <p className="mt-1 font-medium">{d.que}</p>
        <p className="mt-0.5 text-sm text-suave">Pidió {d.pidio}{d.pesoKg ? ` · hasta ${peso(d.pesoKg)}` : ""} · {d.vehiculo} ({d.patente})</p>
        {aRetiro && <p className="mt-2 text-sm"><span className="text-suave">Después: </span>{d.entregar.nombre} · {d.entregar.direccion}</p>}
      </section>

      {etapa === "PROGRAMADO" && <BotonSoltar pedidoId={d.pedidoId} numero={d.numero} />}

      {d.senal && etapa !== "FINALIZADO" && etapa !== "PROGRAMADO" && <Senal s={d.senal} />}
    </div>
  );

  // Escritorio: columna de 400px con la información y el mapa a la derecha, a todo el alto.
  return (
    <div className="lg:-m-6 lg:grid lg:h-[calc(100dvh-48px)] lg:grid-cols-[400px_1fr]">
      <div className="lg:overflow-y-auto lg:border-r lg:border-linea lg:bg-papel lg:p-6">{columna}</div>
      {escritorio && (
        <div className="relative isolate hidden lg:block">
          {mapaTramo ?? (
            <div className="grid h-full place-items-center bg-fondo text-sm text-suave">
              {etapa === "PROGRAMADO" ? "El recorrido aparece cuando inicies el viaje." : "Sin recorrido para mostrar."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Al pie, chico: de dónde sale la posición y hace cuánto. */
function Senal({ s }: { s: NonNullable<Datos["senal"]> }) {
  if (s.sinSenal || !s.fecha) {
    return <p suppressHydrationWarning className="flex items-center gap-1.5 pb-2 text-[11px] font-medium text-critico"><WifiOff className="size-3.5" /> Sin señal: usá los botones</p>;
  }
  const Icono = s.fuente === "TELEFONO" ? Smartphone : Satellite;
  const fuente = s.fuente === "TELEFONO" ? "GPS del teléfono" : s.fuente === "CUSAT" ? "GPS Cusat" : "GPS simulado";
  return <p suppressHydrationWarning className="flex items-center gap-1.5 pb-2 text-[11px] text-suave"><Icono className="size-3.5" /> {fuente} {haceSeg(s.fecha)}</p>;
}
