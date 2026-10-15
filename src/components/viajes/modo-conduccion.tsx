"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Navigation, SatelliteDish, X } from "lucide-react";
import type { PantallaViaje as Datos } from "@/lib/viajes/chofer";
import { hora } from "@/lib/formato";
import { metros, minutos } from "@/lib/rutas/formato";
import { abrirEnGoogleMaps } from "@/lib/viajes/navegar";
import { iniciarViaje, llegueAlDestino, marcarItem, responderLlegada, salgoHaciaDestino } from "@/lib/viajes/acciones";
import { pasosDelViaje, type Paso } from "@/lib/viajes/pasos";
import { bloqueoPorFecha } from "@/lib/viajes/fecha";
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
 * MODO CONDUCCIÓN (/viaje/[id]/conducir): el viaje es una secuencia de deslizadores, UN paso por pantalla
 * (src/lib/viajes/pasos.ts): "Paso 2 de 4", letra grande y solo la parada actual. El deslizador es el único
 * control: si el GPS detecta la llegada se pone verde y vibra, pero se puede deslizar igual sin esperar; sin
 * señal funciona igual (es manual) y abajo dice "Sin señal GPS". El chofer nunca escribe un número. Todo termina
 * en las mismas acciones del motor, con la auditoría de origen DESLIZADOR (o GPS, cuando lo marca el motor).
 */
export function ModoConduccion({ d }: { d: Datos }) {
  const router = useRouter();
  const aviso = useAviso();
  const [finalizar, setFinalizar] = useState(false);
  // Pasos hechos en este teléfono que el servidor todavía no reflejó (enviado o guardado sin señal).
  const [hechosLocal, setHechosLocal] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  // Títulos cortos: "Corralón San Martín" (sin " · Sucursal Villa Crespo"); la dirección va debajo.
  const r = pasosDelViaje(d.paradas.map((x) => ({ ...x, nombre: x.nombre.split(" · ")[0] })), { iniciado: d.estado !== "PROGRAMADO", terminado: d.estado === "FINALIZADO", porConfirmar: d.confirmar?.id ?? null });
  const pasos = r.pasos.map((p) => (hechosLocal.includes(p.clave) ? { ...p, hecho: true } : p));
  const indice = pasos.findIndex((p) => !p.hecho);
  const paso: Paso | null = indice === -1 ? null : pasos[indice];
  const parada = paso?.paradaId ? d.paradas.find((x) => x.id === paso.paradaId) ?? null : null;
  const hacia = paso?.haciaId ? d.paradas.find((x) => x.id === paso.haciaId) ?? null : null;
  const verde = !!paso && !!d.confirmar && paso.paradaId === d.confirmar.id && (paso.tipo === "LLEGUE" || paso.tipo === "TERMINAR");
  const porFecha = paso?.tipo === "INICIAR" ? bloqueoPorFecha(new Date(d.paraCuando)) : null;

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

  // El GPS detectó la llegada (deslizador verde) o el paso cambió solo (salida por GPS): vibra.
  const claveActual = paso?.clave ?? "fin";
  useEffect(() => {
    if (verde) navigator.vibrate?.(250);
  }, [verde, claveActual]);

  const salir = () => {
    try {
      sessionStorage.removeItem(CLAVE_CONDUCIENDO);
    } catch {}
    router.push(`/viaje/${d.pedidoId}`);
  };

  /** Cada paso termina en la misma acción que antes (con su respaldo sin señal), con el origen DESLIZADOR. */
  async function hacer() {
    if (!paso) return;
    if (paso.tipo === "TERMINAR") return setFinalizar(true);
    setEnviando(true);
    const gps = await posicionActual();
    const base = { clientId: crypto.randomUUID(), pedidoId: d.pedidoId, canal: "DESLIZADOR" as const, ocurridoEn: new Date().toISOString(), ...(gps ?? {}) };
    let r: Awaited<ReturnType<typeof enviarOGuardar>>;
    if (paso.tipo === "INICIAR") {
      r = await enviarOGuardar({ id: base.clientId, tipo: "viaje.iniciar", pedidoId: d.pedidoId, descripcion: `Salida del pedido ${d.numero} con ${d.vehiculo}`, datos: base }, () => iniciarViaje(base));
    } else if (paso.tipo === "LLEGUE" && verde) {
      const x = await responderLlegada(d.pedidoId, true, "DESLIZADOR");
      r = x.ok ? { estado: "enviado", datos: null } : { estado: "error", error: x.error };
    } else {
      const datos = { ...base, paradaId: paso.paradaId ?? undefined };
      const tipo = paso.tipo === "LLEGUE" ? "viaje.llegada" : "viaje.salgo";
      r = await enviarOGuardar({ id: base.clientId, tipo, pedidoId: d.pedidoId, descripcion: `${paso.titulo} · pedido ${d.numero}`, datos }, () => (tipo === "viaje.llegada" ? llegueAlDestino(datos) : salgoHaciaDestino(datos)));
    }
    setEnviando(false);
    if (r.estado === "error") return aviso({ mensaje: r.error, tono: "error" });
    setHechosLocal((h) => [...h, paso.clave]);
    if (r.estado === "guardado") aviso({ mensaje: "Sin señal: quedó guardado en el teléfono y se manda solo." });
    router.refresh();
  }

  // El mapa, solo mientras va hacia un lugar (Llegué a… / Terminar antes de llegar).
  const yendo = parada && parada.id === d.actualId && parada.estado !== "LLEGO" && (paso?.tipo === "LLEGUE" || paso?.tipo === "TERMINAR");
  const mapa = yendo && d.tramo
    ? <MapaTramo geometria={d.tramo.geometria} desde={d.tramo.desde} hasta={d.tramo.hasta} nombreHasta={parada.nombre} />
    : yendo
      ? <MapaTramo geometria={[[parada.lat, parada.lng]]} desde={{ lat: parada.lat, lng: parada.lng }} hasta={{ lat: parada.lat, lng: parada.lng }} nombreHasta={parada.nombre} />
      : null;
  const primera = d.paradas[0] ?? null;

  return (
    <div data-sin-arrastre className="fixed inset-0 z-[45] flex flex-col bg-negro text-white">
      <header className="flex shrink-0 items-center gap-3 px-4 pt-[calc(12px+env(safe-area-inset-top))] pb-3">
        <button type="button" onClick={salir} aria-label="Salir del modo conducción" className="grid size-12 shrink-0 place-items-center rounded-full bg-white/10">
          <X className="size-6" />
        </button>
        <p className="min-w-0 flex-1 text-[15px] font-semibold tracking-[0.04em] text-white/70 uppercase">{paso ? `Paso ${indice + 1} de ${pasos.length}` : "Viaje terminado"}</p>
      </header>

      {mapa && <div className="relative isolate h-[26dvh] min-h-0 shrink-0">{mapa}</div>}

      <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-4 pb-4">
        {paso?.tipo === "INICIAR" && (
          <>
            <p className="text-[32px] leading-9 font-semibold">Iniciar viaje</p>
            <p className="text-[17px] text-white/70">Con {d.vehiculo}{primera ? ` · primero: ${primera.nombre}` : ""}</p>
            {primera && <p className="text-[15px] text-white/60">{primera.direccion}</p>}
            {porFecha && <p className="text-[17px] font-semibold text-[#F5C26B]">{porFecha}</p>}
          </>
        )}

        {paso && paso.tipo !== "INICIAR" && parada && (
          <>
            <p className="text-[32px] leading-9 font-semibold break-words">{paso.titulo}</p>
            {paso.tipo === "EN_CAMINO" && hacia ? (
              <p className="text-[17px] text-white/70">{hacia.direccion}</p>
            ) : (
              <p className="text-[17px] text-white/70">{parada.direccion}</p>
            )}
            {yendo && d.tramo && (
              <p className="text-[22px] font-semibold tabular-nums">
                {metros(d.tramo.distanciaM)}
                {d.eta && <span suppressHydrationWarning className="text-[15px] font-medium text-white/70"> · {minutos(Math.max(60, (new Date(d.eta).getTime() - Date.now()) / 1000))} · llegás {hora(d.eta)} (con tránsito)</span>}
              </p>
            )}
            {yendo && d.navegacion.length > 0 && (
              <button type="button" onClick={() => abrirEnGoogleMaps(d.navegacion)} className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-white/25 text-[15px] font-semibold active:bg-white/10">
                <Navigation className="size-5" /> Abrir en Google Maps
              </button>
            )}
            {/* Datos del lugar de retiro (horario, contacto, OC). */}
            {parada.retiro && (paso.tipo === "LLEGUE" || paso.tipo === "EN_CAMINO") && (parada.retiro.horario || parada.retiro.contacto || parada.retiro.oc) && (
              <dl className="flex flex-col gap-1 rounded-md bg-white/5 px-3 py-2 text-[15px]">
                {parada.retiro.horario && <div className="flex gap-2"><dt className="text-white/60">Horario</dt><dd>{parada.retiro.horario}</dd></div>}
                {parada.retiro.contacto && <div className="flex gap-2"><dt className="text-white/60">Preguntar por</dt><dd className="min-w-0 break-words">{parada.retiro.contacto}</dd></div>}
                {parada.retiro.oc && <div className="flex gap-2"><dt className="text-white/60">OC</dt><dd>{parada.retiro.oc}</dd></div>}
              </dl>
            )}
            {/* Lo que se carga o se entrega acá: para tildar. */}
            {parada.items.length > 0 && (
              <>
                <p className="mt-1 text-[13px] font-semibold tracking-[0.04em] text-white/60 uppercase">{parada.tipo === "RETIRO" ? `Cargar en ${parada.nombre}` : `Entregar en ${parada.nombre}`}</p>
                <Lista items={parada.items} editable={d.estado === "EN_CURSO"} />
              </>
            )}
          </>
        )}

        {!paso && <p className="text-[26px] font-semibold">Ya hiciste todos los pasos.</p>}
      </section>

      {/* El deslizador, fijo abajo y siempre a la vista (lo de arriba se desplaza si es largo). */}
      <div className="pb-segura flex shrink-0 flex-col gap-2 border-t border-white/10 px-4 pt-3">
          {paso && (
            <Deslizador
              key={paso.clave}
              texto={paso.titulo}
              verde={verde}
              deshabilitado={!!porFecha || enviando}
              onCompletar={hacer}
            />
          )}
          {d.estado === "EN_CURSO" && d.sinGps && (
            <p className="flex items-center justify-center gap-1.5 text-[13px] text-white/50"><SatelliteDish className="size-4" /> Sin señal GPS</p>
          )}
        <div className="h-3" />
      </div>

      <HojaFinalizar pedidoId={d.pedidoId} numero={d.numero} obra={parada?.nombre ?? d.paradas[d.paradas.length - 1]?.nombre ?? ""} abierta={finalizar} onCerrar={() => setFinalizar(false)} canal="DESLIZADOR"
        onTerminado={() => { try { sessionStorage.removeItem(CLAVE_CONDUCIENDO); } catch {} }} />
    </div>
  );
}

/** La lista de verificación, compacta y oscura: un toque tilda o destilda (en curso). */
function Lista({ items, editable }: { items: Datos["paradas"][number]["items"]; editable: boolean }) {
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
            <button type="button" role="checkbox" aria-checked={ok} disabled={i.faltante || !editable} onClick={() => alternar(i.id)} className={`flex min-h-12 w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-[17px] ${ok ? "border-ok bg-ok/25" : "border-white/15 bg-white/5"} disabled:opacity-80`}>
              <span aria-hidden className={`grid size-6 shrink-0 place-items-center rounded border ${ok ? "border-ok bg-ok" : "border-white/40"}`}>{ok && <Check className="size-4" strokeWidth={3} />}</span>
              <span className="min-w-0 flex-1 leading-snug break-words">
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
