"use client";

/**
 * Cola de envíos pendientes en el dispositivo.
 * Pedido nuevo, salida y llegada de viaje y carga de combustible se guardan acá
 * si no hay señal, y se mandan solos cuando vuelve. Cada envío lleva un clientId:
 * el servidor lo usa para no duplicar si llega dos veces.
 */

import type { Resultado } from "@/lib/acciones/resultado";

export type TipoEnvio = "pedido.crear" | "viaje.iniciar" | "viaje.finalizar" | "combustible.cargar";

export type Envio = {
  id: string;
  tipo: TipoEnvio;
  descripcion: string; // "Pedido para Obra Darwin"
  datos: Record<string, unknown>;
  creadoEn: string;
  intentos: number;
  error?: string; // rechazado por el servidor (no es falta de señal)
};

const CLAVE = "signa:envios-pendientes";
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
  } catch {}
  window.dispatchEvent(new Event(EVENTO));
}

export function escucharEnvios(fn: () => void) {
  window.addEventListener(EVENTO, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENTO, fn);
    window.removeEventListener("storage", fn);
  };
}

export function encolar(tipo: TipoEnvio, descripcion: string, datos: Record<string, unknown>) {
  const envios = leerEnvios();
  const id = String(datos.clientId ?? crypto.randomUUID());
  if (envios.some((e) => e.id === id)) return;
  guardar([...envios, { id, tipo, descripcion, datos: { ...datos, ocurridoEn: datos.ocurridoEn ?? new Date().toISOString() }, creadoEn: new Date().toISOString(), intentos: 0 }]);
}

export function descartar(id: string) {
  guardar(leerEnvios().filter((e) => e.id !== id));
}

/** Errores de red (sin señal, servidor caído) vs. respuestas del servidor. */
export function esErrorDeRed(e: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const m = e instanceof Error ? e.message : String(e);
  return /fetch|network|Failed|Load failed|conexi/i.test(m) || e instanceof TypeError;
}

type Ejecutor = (datos: Record<string, unknown>) => Promise<Resultado<unknown>>;

let enviando = false;

export async function enviarPendientes(ejecutores: Record<TipoEnvio, Ejecutor>) {
  if (enviando || !navigator.onLine) return { enviados: 0 };
  enviando = true;
  let enviados = 0;
  try {
    for (const envio of leerEnvios()) {
      if (envio.error) continue;
      try {
        const r = await ejecutores[envio.tipo](envio.datos);
        if (r.ok) {
          guardar(leerEnvios().filter((e) => e.id !== envio.id));
          enviados++;
        } else {
          guardar(leerEnvios().map((e) => (e.id === envio.id ? { ...e, error: r.error, intentos: e.intentos + 1 } : e)));
        }
      } catch (e) {
        if (esErrorDeRed(e)) break; // sigue sin señal: se reintenta después
        guardar(leerEnvios().map((x) => (x.id === envio.id ? { ...x, intentos: x.intentos + 1 } : x)));
      }
    }
  } finally {
    enviando = false;
  }
  return { enviados };
}

/**
 * Intenta mandar ya; si no hay señal, lo guarda. Devuelve "enviado", "guardado"
 * o el error del servidor.
 */
export async function enviarOGuardar<T>(
  tipo: TipoEnvio,
  descripcion: string,
  datos: Record<string, unknown>,
  accion: () => Promise<Resultado<T>>,
): Promise<{ estado: "enviado"; datos: T } | { estado: "guardado" } | { estado: "error"; error: string }> {
  if (!navigator.onLine) {
    encolar(tipo, descripcion, datos);
    return { estado: "guardado" };
  }
  try {
    const r = await accion();
    return r.ok ? { estado: "enviado", datos: r.datos } : { estado: "error", error: r.error };
  } catch (e) {
    if (esErrorDeRed(e)) {
      encolar(tipo, descripcion, datos);
      return { estado: "guardado" };
    }
    return { estado: "error", error: "No se pudo completar. Probá de nuevo." };
  }
}
