"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Navigation, X } from "lucide-react";
import type { PantallaViaje as Datos } from "@/lib/viajes/chofer";
import { hora } from "@/lib/formato";
import { metros, minutos } from "@/lib/rutas/formato";
import { abrirEnGoogleMaps } from "@/lib/viajes/navegar";
import { llegueAlDestino, marcarItem, responderLlegada, responderSalida, salgoHaciaDestino } from "@/lib/viajes/acciones";
import { enviarOGuardar } from "@/lib/offline/cola";
import { useAviso } from "@/components/ui/avisos";
import { useAlCambiar } from "@/components/layout/avisos-en-vivo";
import { Deslizador } from "./deslizador";
import { HojaFinalizar } from "./acciones-viaje";
import { posicionActual } from "./seguimiento-chofer";

const MapaTramo = dynamic(() => import("@/components/mapa/mapa-tramo"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-white/60">Cargando mapa…</div>,
});

/** Lo que sigue en el viaje (en el mismo celular se recuerda para volver acá desde Google Maps). */
export const CLAVE_CONDUCIENDO = "signa:conduciendo";
const REFRESCO_MS = 10_000;

/**
 * MODO CONDUCCIÓN (/viaje/[id]/conducir): pantalla completa y oscura, el mapa arriba (60 %) y abajo la
 * tarjeta de la parada actual con UN deslizador para lo que sigue (llegué, salgo, terminar). Nunca un botón
 * común para esas acciones. Mantiene la pantalla prendida (Wake Lock) y, al volver de Google Maps, trae el
 * estado del servidor. Todo termina en las mismas acciones del motor (auditoría con origen DESLIZADOR).
 */
export function ModoConduccion({ d }: { d: Datos }) {
  const router = useRouter();
  const aviso = useAviso();
  const [finalizar, setFinalizar] = useState(false);
  const actual = d.paradas.find((p) => p.id === d.actualId) ?? null;
  const faltan = d.paradas.filter((p) => p.estado !== "COMPLETADA" && p.estado !== "SALTEADA");
  const llego = actual?.estado === "LLEGO";
  const ultima = faltan.length <= 1;
  const n = actual ? d.paradas.indexOf(actual) + 1 : d.paradas.length;

  // Recordar el viaje (para volver desde Google Maps) y traer el estado al volver a la pantalla.
  useEffect(() => {
    try {
      sessionStorage.setItem(CLAVE_CONDUCIENDO, d.pedidoId);
    } catch {}
    const volver = () => !document.hidden && router.refresh();
    document.addEventListener("visibilitychange", volver);
    window.addEventListener("focus", volver);
    const t = window.setInterval(() => !document.hidden && router.refresh(), REFRESCO_MS);
    return () => {
      document.removeEventListener("visibilitychange", volver);
      window.removeEventListener("focus", volver);
      window.clearInterval(t);
    };
  }, [d.pedidoId, router]);
  useAlCambiar((tipo) => tipo === "viaje" && router.refresh());

  // Pantalla siempre prendida mientras está acá (se vuelve a pedir al volver a la pantalla).
  useEffect(() => {
    type Bloqueo = { release: () => Promise<void> };
    let bloqueo: Bloqueo | null = null;
    const pedir = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Bloqueo> } }).wakeLock;
        if (wl && !document.hidden) bloqueo = await wl.request("screen");
      } catch {}
    };
    void pedir();
    const alVolver = () => !document.hidden && void pedir();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      void bloqueo?.release().catch(() => {});
    };
  }, []);

  // Llegada detectada por GPS: vibra una vez.
  const detectada = d.confirmar?.lugar ?? null;
  useEffect(() => {
    if (detectada) navigator.vibrate?.(250);
  }, [detectada]);

  const salir = () => {
    try {
      sessionStorage.removeItem(CLAVE_CONDUCIENDO);
    } catch {}
    router.push(`/viaje/${d.pedidoId}`);
  };

  /** Lo mismo que los botones (con su respaldo sin señal), con el origen DESLIZADOR. */
  async function tramo(tipo: "viaje.llegada" | "viaje.salgo") {
    const gps = await posicionActual();
    const datos = { clientId: crypto.randomUUID(), pedidoId: d.pedidoId, paradaId: actual?.id, canal: "DESLIZADOR" as const, ocurridoEn: new Date().toISOString(), ...(gps ?? {}) };
    const accion = tipo === "viaje.llegada" ? llegueAlDestino : salgoHaciaDestino;
    const r = await enviarOGuardar({ id: datos.clientId, tipo, pedidoId: d.pedidoId, descripcion: `${tipo === "viaje.llegada" ? d.manual.llegue : d.manual.salgo} · pedido ${d.numero}`, datos }, () => accion(datos));
    if (r.estado === "error") aviso({ mensaje: r.error, tono: "error" });
    else if (r.estado === "guardado") aviso({ mensaje: "Sin señal: quedó guardado en el teléfono y se manda solo." });
    router.refresh();
  }
  async function confirmar(si: boolean) {
    const r = await responderLlegada(d.pedidoId, si, "DESLIZADOR");
    if (!r.ok) aviso({ mensaje: r.error, tono: "error" });
    else if (!si) aviso({ mensaje: "Listo. Te avisamos cuando llegues." });
    router.refresh();
  }
  async function sigoAca() {
    const r = await responderSalida(d.pedidoId, false, "DESLIZADOR");
    aviso(r.ok ? { mensaje: "Listo: seguís en el lugar." } : { mensaje: r.error, tono: "error" });
    router.refresh();
  }

  // Qué pide el deslizador según el estado.
  const cuando = d.manual.llegue.replace(/^Llegué /, "llegues ");
  const deslizador = !actual || (llego && ultima && !detectada)
    ? { texto: "Deslizá para terminar el viaje", verde: false, hacer: () => setFinalizar(true) }
    : detectada
      ? { texto: `Llegaste a ${detectada} · deslizá para confirmar`, verde: true, hacer: () => confirmar(true) }
      : llego
        ? { texto: "Deslizá cuando salgas", verde: false, hacer: () => tramo("viaje.salgo") }
        : { texto: `Deslizá cuando ${cuando}`, verde: false, hacer: () => tramo("viaje.llegada") };

  const hasta = actual ? { lat: actual.lat, lng: actual.lng } : null;
  const mapa = d.tramo && actual
    ? <MapaTramo geometria={d.tramo.geometria} desde={d.tramo.desde} hasta={d.tramo.hasta} nombreHasta={actual.nombre} otras={faltan.filter((p) => p.id !== actual.id).map((p) => ({ lat: p.lat, lng: p.lng, n: d.paradas.indexOf(p) + 1 }))} />
    : hasta && actual
      ? <MapaTramo geometria={[[hasta.lat, hasta.lng]]} desde={hasta} hasta={hasta} nombreHasta={actual.nombre} />
      : null;

  return (
    <div data-sin-arrastre className="fixed inset-0 z-[45] flex flex-col bg-negro text-white">
      {/* Mapa: 60 % de arriba. */}
      <div className="relative isolate h-[60dvh] min-h-0 shrink-0">
        {mapa ?? <div className="grid h-full place-items-center text-white/60">Sin recorrido para mostrar.</div>}
        <button type="button" onClick={salir} aria-label="Salir del modo conducción" className="absolute top-[calc(12px+env(safe-area-inset-top))] left-3 z-[1000] grid size-12 place-items-center rounded-full bg-negro/85 text-white shadow-[0_4px_16px_rgba(0,0,0,.3)]">
          <X className="size-6" />
        </button>
      </div>

      {/* Tarjeta fija de abajo: todo al alcance del pulgar. */}
      <section className="pb-segura flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-t-2xl border-t border-white/10 bg-white/[0.04] px-4 pt-4">
        {actual ? (
          <>
            <p className="text-[13px] font-medium tracking-[0.04em] text-white/60 uppercase">Parada {n} de {d.paradas.length} · {actual.tipo === "RETIRO" ? "Retiro" : "Entrega"}</p>
            <div>
              <p className="text-[26px] leading-8 font-semibold">{actual.nombre}</p>
              <p className="mt-1 text-[15px] text-white/70">{actual.direccion}</p>
            </div>
            {d.tramo && !llego && (
              <p className="text-[22px] font-semibold tabular-nums">
                {metros(d.tramo.distanciaM)}
                {d.eta && <span suppressHydrationWarning className="text-[15px] font-medium text-white/70"> · {minutos(Math.max(60, (new Date(d.eta).getTime() - Date.now()) / 1000))} · llegás {hora(d.eta)} (con tránsito)</span>}
              </p>
            )}
            {!llego && d.navegacion.length > 0 && (
              <button type="button" onClick={() => abrirEnGoogleMaps(d.navegacion)} className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-white/25 text-[15px] font-semibold active:bg-white/10">
                <Navigation className="size-5" /> Abrir en Google Maps
              </button>
            )}
            {/* En el lugar: la lista para tildar. */}
            {llego && !detectada && actual.items.length > 0 && <Lista items={actual.items} />}
          </>
        ) : (
          <p className="text-[22px] font-semibold">Ya hiciste todas las paradas.</p>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-2 pb-3">
          <Deslizador texto={deslizador.texto} verde={deslizador.verde} onCompletar={deslizador.hacer} />
          {detectada && (
            <button type="button" onClick={() => confirmar(false)} className="h-11 text-[15px] font-medium text-white/80 underline">No llegué todavía</button>
          )}
          {d.sigoAca && !detectada && (
            <button type="button" onClick={sigoAca} className="h-11 text-[15px] font-medium text-white/80 underline">Sigo en {d.sigoAca.lugar}</button>
          )}
        </div>
      </section>

      <HojaFinalizar pedidoId={d.pedidoId} numero={d.numero} obra={actual?.nombre ?? d.paradas[d.paradas.length - 1]?.nombre ?? ""} kmSalida={d.kmSalida} abierta={finalizar} onCerrar={() => setFinalizar(false)} canal="DESLIZADOR"
        onTerminado={() => { try { sessionStorage.removeItem(CLAVE_CONDUCIENDO); } catch {} }} />
    </div>
  );
}

/** La lista de verificación, compacta y oscura: un toque tilda o destilda. */
function Lista({ items }: { items: Datos["paradas"][number]["items"] }) {
  const [marcados, setMarcados] = useState(() => new Set(items.filter((i) => i.marcado && !i.faltante).map((i) => i.id)));
  async function alternar(id: string) {
    const ahora = !marcados.has(id);
    setMarcados((s) => {
      const n = new Set(s);
      if (ahora) n.add(id);
      else n.delete(id);
      return n;
    });
    await marcarItem(id, ahora);
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((i) => {
        const ok = marcados.has(i.id);
        return (
          <li key={i.id}>
            <button type="button" role="checkbox" aria-checked={ok} disabled={i.faltante} onClick={() => alternar(i.id)} className={`flex min-h-12 w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-[15px] ${ok ? "border-ok bg-ok/25" : "border-white/15 bg-white/5"} disabled:opacity-60`}>
              <span aria-hidden className={`grid size-6 shrink-0 place-items-center rounded border ${ok ? "border-ok bg-ok" : "border-white/40"}`}>{ok && <Check className="size-4" strokeWidth={3} />}</span>
              <span className="min-w-0 flex-1 leading-snug">
                {[i.cantidad != null ? new Intl.NumberFormat("es-AR").format(i.cantidad) : null, i.unidad, i.descripcion].filter(Boolean).join(" ")}
                <span className="block text-[13px] text-white/60">→ {i.obra.replace(/^Obra\s+/i, "")}{i.oc ? ` · ${i.oc}` : ""}{i.faltante ? " · faltó" : ""}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
