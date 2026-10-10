"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, CheckCircle2, Flag, Map as MapIcon, Navigation, PackageCheck, Satellite, Smartphone, Truck, WifiOff } from "lucide-react";
import { BotonLink, claseBoton, Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { MensajeError } from "@/components/ui/campos";
import { FechaGrande, TarjetaChofer } from "./tarjeta-chofer";
import { haceSeg, hora, km, peso } from "@/lib/formato";
import { metros, minutos } from "@/lib/rutas/formato";
import type { PantallaViaje as Datos } from "@/lib/viajes/chofer";
import { useEscritorio } from "@/components/ui/escritorio";
import { BotonFinalizar, BotonIniciar, BotonManual, ConfirmarLlegada } from "./acciones-viaje";
import { BotonAgregarParada, BotonReordenar, ListaParadas, ListaVerificacion } from "./paradas";
import { CampoFoto } from "./campo-foto";
import { PendienteEnvio } from "./pendiente-envio";
import { useAlCambiar } from "@/components/layout/avisos-en-vivo";
import { BotonSoltar } from "@/components/pedidos/acciones-detalle";
import { salgoHaciaDestino } from "@/lib/viajes/acciones";
import { enviarOGuardar } from "@/lib/offline/cola";
import { posicionActual } from "./seguimiento-chofer";

const MapaTramo = dynamic(() => import("@/components/mapa/mapa-tramo"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-fondo text-sm text-suave">Cargando mapa…</div>,
});

/** Mientras la pantalla está abierta, se refresca para ver lo que detectó el GPS. */
const REFRESCO_MS = 15_000;

/**
 * La pantalla que el chofer tiene abierta mientras maneja, por paradas. Arriba la parada actual (a dónde
 * va, distancia, qué carga o entrega ahí con su lista de verificación); abajo, la lista numerada de todas.
 * Toca "Iniciar viaje", tilda lo que carga y "Viaje terminado"; las llegadas y salidas las detecta el GPS
 * (y si falla, el botón manual de la parada: "Llegué al proveedor").
 */
export function PantallaViaje({ d }: { d: Datos }) {
  const router = useRouter();
  const enCurso = d.estado === "EN_CURSO";

  useEffect(() => {
    if (!enCurso) return;
    const t = window.setInterval(() => !document.hidden && router.refresh(), REFRESCO_MS);
    return () => window.clearInterval(t);
  }, [enCurso, router]);
  // Si el GPS cambió la parada (el stream de avisos lo detecta), se refresca al instante.
  useAlCambiar((tipo) => tipo === "viaje" && router.refresh());

  const base = { pedidoId: d.pedidoId, numero: d.numero };
  const actual = d.paradas.find((p) => p.id === d.actualId) ?? null;
  const ultima = actual && d.paradas.filter((p) => p.estado !== "COMPLETADA" && p.estado !== "SALTEADA").length === 1;
  const llego = actual?.estado === "LLEGO";
  const escritorio = useEscritorio();
  const mapaTramo = d.tramo && actual && (
    <MapaTramo geometria={d.tramo.geometria} desde={d.tramo.desde} hasta={d.tramo.hasta} nombreHasta={actual.nombre}
      otras={d.paradas.filter((p) => p.id !== actual.id && p.estado !== "COMPLETADA").map((p) => ({ lat: p.lat, lng: p.lng, n: d.paradas.indexOf(p) + 1 }))} />
  );
  // Celular: el mapa chico se abre a pedido (navega con Google Maps; así la pantalla carga rápido y gasta menos datos).
  const [verMapa, setVerMapa] = useState(false);
  const mapa = !escritorio && mapaTramo && (verMapa
    ? <div className="relative isolate h-[220px] overflow-hidden rounded-[var(--radius-caja)] border border-linea">{mapaTramo}</div>
    : <Boton variante="secundario" ancho icono={<MapIcon />} onClick={() => setVerMapa(true)}>Ver el recorrido en el mapa</Boton>);
  const telefono = actual?.retiro?.contacto?.match(/(\d[\d\s-]{6,}\d)/)?.[1];

  // La parada actual: qué hacer, dónde, a cuánto.
  const tarjetaActual = actual && (
    <section className="rounded-[var(--radius-caja)] border border-linea bg-papel p-4 lg:border-0 lg:bg-transparent lg:p-0">
      <p className="etiqueta">
        {!enCurso ? "Primero vas a" : llego ? (actual.tipo === "RETIRO" ? "Estás cargando en" : "Estás entregando en") : actual.tipo === "RETIRO" ? "Vas a retirar en" : "Vas a entregar en"}
        {d.paradas.length > 2 && ` · parada ${d.paradas.indexOf(actual) + 1} de ${d.paradas.length}`}
      </p>
      <p className="mt-1 text-2xl leading-7 font-semibold">{actual.nombre}</p>
      <p className="mt-0.5 text-sm text-suave">{actual.direccion}</p>
      {actual.retiro && (actual.retiro.horario || actual.retiro.contacto || actual.retiro.oc) && (
        <dl className="mt-3 grid gap-1 rounded-md bg-fondo px-3 py-2 text-sm">
          {actual.retiro.horario && <div className="flex gap-2"><dt className="text-suave">Horario</dt><dd>{actual.retiro.horario}</dd></div>}
          {actual.retiro.contacto && (
            <div className="flex gap-2"><dt className="text-suave">Preguntar por</dt>
              <dd>{telefono ? <a className="font-medium underline" href={`tel:${telefono.replace(/[\s-]/g, "")}`}>{actual.retiro.contacto}</a> : actual.retiro.contacto}</dd>
            </div>
          )}
          {actual.retiro.oc && <div className="flex gap-2"><dt className="text-suave">OC</dt><dd>{actual.retiro.oc}</dd></div>}
        </dl>
      )}
      {/* Sin tránsito real (sin Google) solo distancia; con Google, minutos y "llegás 11:04 (con tránsito)". */}
      {d.tramo && (
        <p className="mt-4 text-[15px] font-medium tabular-nums">
          {metros(d.tramo.distanciaM)}
          {d.eta && <span suppressHydrationWarning> · {minutos(Math.max(60, (new Date(d.eta).getTime() - Date.now()) / 1000))} · llegás {hora(d.eta)} (con tránsito)</span>}
          {d.tramo.estimada && <span className="block text-[12px] font-normal text-suave">Distancia aproximada (sin ruteo).</span>}
        </p>
      )}
      {!enCurso && d.salidaEstimada && <p className="mt-3 text-sm text-suave">km actual {km(d.kmActual)} · {d.vehiculo}</p>}
      {enCurso && !llego && d.maps && (
        <a href={d.maps} target="_blank" rel="noopener" className={claseBoton("secundario", "normal", false, "mt-3 w-full lg:w-auto")}>
          <Navigation /> Abrir en Google Maps{d.paradas.filter((p) => p.estado !== "COMPLETADA" && p.estado !== "LLEGO").length > 1 ? " (con las paradas)" : ""}
        </a>
      )}
    </section>
  );

  const columna = (
    <div className="flex flex-col gap-3 lg:gap-4">
      <Link href="/hoy" className="inline-flex min-h-10 items-center gap-1 self-start text-sm font-medium text-suave hover:text-tinta lg:min-h-8"><ArrowLeft className="size-4" /> Hoy</Link>

      {/* Primero, la fecha del viaje: la del pedido, grande y en palabras. */}
      {d.estado !== "FINALIZADO" && <FechaGrande fecha={d.paraCuando} franja={d.franja} iniciado={enCurso} className="text-[22px] leading-7" />}
      {d.pedidos.length > 1 && (
        <p className="-mt-1 text-sm text-suave">{d.pedidos.length} pedidos · {d.paradas.length} paradas{d.totalM ? ` · ${metros(d.totalM)}` : ""}{d.pesoKg ? ` · ${peso(d.pesoKg)}` : ""}</p>
      )}

      {/* El GPS detectó una llegada (o a otra parada antes de la que tocaba): el chofer la confirma o la niega. */}
      {d.confirmar && <ConfirmarLlegada pedidoId={d.pedidoId} lugar={d.confirmar.lugar} antesDe={d.confirmar.adelantadaDe} />}

      {d.estado !== "FINALIZADO" && tarjetaActual}

      {/* Lista de verificación de la parada actual (tildable cuando llegó; antes, para saber qué se carga). */}
      {actual && actual.items.length > 0 && d.estado !== "FINALIZADO" && <ListaVerificacion parada={actual} editable={enCurso && llego} />}

      <PendienteEnvio pedidoId={d.pedidoId} />

      {/* Lo que sigue: iniciar, llegar (manual), "Cargué todo, salgo" / "Entregado acá", o "Viaje terminado". */}
      {d.estado === "PROGRAMADO" && (
        <BotonIniciar {...base} vehiculo={d.vehiculo} kmActual={d.kmActual} paraCuando={d.paraCuando}
          bloqueado={d.otroEnCurso ? "Tenés otro viaje en curso. Terminalo antes de iniciar este." : undefined} />
      )}
      {enCurso && actual && !llego && (
        <BotonManual {...base} tipo="viaje.llegada" etiqueta={d.manual.llegue} paradaId={d.manual.paradaId} principal={d.sinGps} />
      )}
      {enCurso && actual && llego && !ultima && <BotonCompletar pedidoId={d.pedidoId} numero={d.numero} paradaId={actual.id} tipo={actual.tipo} lugar={actual.nombre} />}
      {enCurso && (!actual || (llego && ultima)) && <BotonFinalizar {...base} obra={actual?.nombre ?? d.paradas[d.paradas.length - 1]?.nombre ?? ""} kmSalida={d.kmSalida} />}

      {d.estado === "FINALIZADO" && (
        <>
          <div className="flex gap-3 rounded-[var(--radius-caja)] bg-ok-fondo p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" />
            <p className="font-medium">Viaje terminado.{d.kmRecorridos != null ? ` ${km(d.kmRecorridos)}.` : ""} {d.pedidos.length > 1 ? "Cada uno ya sabe que llegó lo suyo." : `${d.pedidos[0]?.pidio} ya sabe que llegó.`}</p>
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

      {/* Celular: el mapa chico va después de lo que hay que tocar (primero a dónde y qué hacer). */}
      {d.estado !== "FINALIZADO" && mapa}

      {/* Todas las paradas, numeradas, con su estado. */}
      {d.paradas.length > 1 && <ListaParadas paradas={d.paradas} actualId={d.actualId} totalM={d.totalM} />}
      {(d.puedeReordenar || d.puedeAgregar) && d.estado !== "FINALIZADO" && (
        <div className="grid grid-cols-2 gap-2">
          {d.puedeReordenar && <BotonReordenar pedidoId={d.pedidoId} paradas={d.paradas} fijas={d.fijas} />}
          {d.puedeAgregar && <BotonAgregarParada pedidoId={d.pedidoId} />}
        </div>
      )}

      <section className="rounded-[var(--radius-caja)] border border-linea bg-papel">
        {d.pedidos.map((q) => (
          <div key={q.id} className="border-b border-linea px-4 py-3 last:border-b-0">
            <p className="etiqueta">Pedido {q.numero} · {q.obra}</p>
            <p className="mt-1 font-medium">{q.que}</p>
            <p className="mt-0.5 text-sm text-suave">Pidió {q.pidio}{q.pesoKg ? ` · hasta ${peso(q.pesoKg)}` : ""}</p>
          </div>
        ))}
        <p className="flex items-center gap-1.5 border-t border-linea px-4 py-2.5 text-sm text-suave"><Truck className="size-4" /> {d.vehiculo} ({d.patente})</p>
      </section>

      {d.estado === "PROGRAMADO" && <BotonSoltar pedidoId={d.pedidoId} numero={d.numero} />}

      {d.senal && enCurso && <Senal s={d.senal} />}
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
              {d.estado === "PROGRAMADO" ? "El recorrido aparece cuando inicies el viaje." : "Sin recorrido para mostrar."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * "Cargué todo, salgo" (retiro) o "Entregado acá" (entrega): completa la parada actual (también lo detecta
 * el GPS al alejarse). Con foto del remito opcional.
 */
function BotonCompletar({ pedidoId, numero, paradaId, tipo, lugar }: { pedidoId: string; numero: number; paradaId: string; tipo: string; lugar: string }) {
  const [abierta, setAbierta] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string>();
  const router = useRouter();
  const etiqueta = tipo === "RETIRO" ? "Cargué todo, salgo" : "Entregado acá";
  async function completar(conFoto: string | null) {
    setEnviando(true);
    setError(undefined);
    const gps = await posicionActual();
    const datos = { clientId: crypto.randomUUID(), pedidoId, paradaId, ocurridoEn: new Date().toISOString(), foto: conFoto ?? undefined, ...(gps ?? {}) };
    const r = await enviarOGuardar({ id: datos.clientId, tipo: "viaje.salgo", pedidoId, descripcion: `${etiqueta} en ${lugar} · pedido ${numero}`, datos }, () => salgoHaciaDestino(datos));
    setEnviando(false);
    if (r.estado === "error") return setError(r.error);
    setAbierta(false);
    router.refresh();
  }
  return (
    <div className="flex flex-col gap-2">
      <MensajeError>{error}</MensajeError>
      <Boton ancho tamano="grande" icono={tipo === "RETIRO" ? <PackageCheck /> : <Flag />} cargando={enviando && !abierta} onClick={() => completar(null)}>{etiqueta}</Boton>
      <Boton ancho variante="fantasma" icono={<Camera />} onClick={() => setAbierta(true)}>Con foto del remito</Boton>
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo={`${etiqueta} · ${lugar}`}>
        <div className="flex flex-col gap-4">
          <CampoFoto etiqueta="Foto del remito (opcional)" valor={foto} onCambio={setFoto} />
          <MensajeError>{error}</MensajeError>
          <Boton ancho tamano="grande" cargando={enviando} onClick={() => completar(foto)}>{etiqueta}</Boton>
        </div>
      </Hoja>
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
