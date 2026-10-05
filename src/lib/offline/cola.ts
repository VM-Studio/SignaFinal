"use client";

/**
 * Envíos guardados en el teléfono cuando no hay señal.
 * Pedidos nuevos, los botones del viaje (iniciar, llegué al retiro, salgo, llegué) y cargas de combustible se guardan acá y se mandan solos al
 * volver la señal, en el mismo orden. Cada envío lleva un clientId: el servidor no duplica.
 */
import type { Resultado } from "@/lib/resultado";

export type TipoEnvio = "pedido.crear" | "pedido.aceptar" | "viaje.iniciar" | "viaje.retiro" | "viaje.salgo" | "viaje.finalizar" | "combustible.cargar";

export type Envio = {
  id: string;
  tipo: TipoEnvio;
  descripcion: string;
  pedidoId?: string;
  datos: Record<string, unknown>;
  creadoEn: string;
  error?: string; // el servidor lo rechazó (no es falta de señal)
};

const CLAVE = "signa:envios";
const EVENTO = "signa:envios-cambio";

export function leerEnvios(): Envio[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? "[]") as Envio[];
  } catch {
    return [];
  }
}

function guardar(envios: Envio[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(envios));
  } catch {
    throw new Error("El teléfono no tiene lugar para guardar. Probá sin la foto.");
  }
  window.dispatchEvent(new Event(EVENTO));
}

export function escuchar(fn: () => void) {
  window.addEventListener(EVENTO, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENTO, fn);
    window.removeEventListener("storage", fn);
  };
}

export function encolar(e: Omit<Envio, "creadoEn">) {
  const lista = leerEnvios();
  if (lista.some((x) => x.id === e.id)) return;
  guardar([...lista, { ...e, creadoEn: new Date().toISOString() }]);
}

export function descartar(id: string) {
  guardar(leerEnvios().filter((e) => e.id !== id));
}

export function esErrorDeRed(e: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const m = e instanceof Error ? e.message : String(e);
  return e instanceof TypeError || /fetch|network|Failed|Load failed|conexi/i.test(m);
}

type Ejecutor = (datos: Record<string, unknown>) => Promise<Resultado<unknown>>;
let enviando = false;

/** Manda lo guardado, en orden. Si se corta la señal, para y reintenta después. */
export async function enviarPendientes(ejecutores: Record<TipoEnvio, Ejecutor>) {
  if (enviando || !navigator.onLine) return 0;
  enviando = true;
  let enviados = 0;
  try {
    for (const e of leerEnvios()) {
      if (e.error) continue;
      try {
        const r = await ejecutores[e.tipo](e.datos);
        if (r.ok) {
          guardar(leerEnvios().filter((x) => x.id !== e.id));
          enviados++;
        } else {
          guardar(leerEnvios().map((x) => (x.id === e.id ? { ...x, error: r.error } : x)));
        }
      } catch (err) {
        if (esErrorDeRed(err)) break;
      }
    }
  } finally {
    enviando = false;
  }
  return enviados;
}

/** Intenta mandar ya; sin señal (o si se corta), lo guarda en el teléfono. */
export async function enviarOGuardar<T>(envio: Omit<Envio, "creadoEn">, accion: () => Promise<Resultado<T>>): Promise<{ estado: "enviado"; datos: T } | { estado: "guardado" } | { estado: "error"; error: string }> {
  const guardarLocal = () => {
    try {
      encolar(envio);
      return { estado: "guardado" as const };
    } catch (e) {
      return { estado: "error" as const, error: e instanceof Error ? e.message : "No se pudo guardar." };
    }
  };
  if (!navigator.onLine) return guardarLocal();
  try {
    const r = await accion();
    return r.ok ? { estado: "enviado", datos: r.datos } : { estado: "error", error: r.error };
  } catch (e) {
    if (esErrorDeRed(e)) return guardarLocal();
    return { estado: "error", error: "No se pudo completar. Probá de nuevo." };
  }
}
