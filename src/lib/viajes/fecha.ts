import type { Franja } from "@prisma/client";
import { ZONA, diaISO, hora } from "@/lib/formato";

/**
 * La fecha de un viaje como la lee el chofer: grande y en palabras, siempre la de paraCuando del
 * pedido en hora argentina (nunca la de aceptación ni la de creación). Pura: la prueban los tests.
 *
 *   "HOY · 8:30" · "MAÑANA · por la tarde" · "LUNES 13/10 · 8:30" · "EN 9 DÍAS · jueves 23/10 · 8:30"
 *   "ATRASADO · ayer 8:30" (fecha pasada y todavía sin iniciar)
 */
export type TonoFecha = "hoy" | "manana" | "futuro" | "atrasado" | "pasado";
export type FechaViaje = { texto: string; tono: TonoFecha; dias: number };

const fmtSemana = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, weekday: "long" });
const mediodia = (iso: string) => new Date(`${iso}T12:00:00-03:00`);

/** Días calendario argentinos de hoy a d (0 hoy, 1 mañana, -1 ayer). */
export function diasEntre(d: Date, ahora: Date = new Date()) {
  return Math.round((mediodia(diaISO(d)).getTime() - mediodia(diaISO(ahora)).getTime()) / 86_400_000);
}

/** "lunes" del día argentino de d. */
export const diaSemana = (d: Date) => fmtSemana.format(mediodia(diaISO(d)));
/** "13/10". */
export const ddmm = (d: Date) => diaISO(d).split("-").slice(1).reverse().map(Number).join("/");
/** "8:30", "por la mañana", "por la tarde" (la franja, salvo que el pedido tenga otra hora cargada). */
export function horaViaje(d: Date, franja: Franja) {
  const h = hora(d);
  if (franja === "MANANA" && h === "08:00") return "por la mañana";
  if (franja === "TARDE" && h === "14:00") return "por la tarde";
  return h.replace(/^0(\d)/, "$1");
}
/** "a las 8:30", "por la mañana". */
export const aLaHora = (d: Date, franja: Franja) => {
  const h = horaViaje(d, franja);
  return h.startsWith("por") ? h : `a las ${h}`;
};

export function fechaViaje(paraCuando: Date, franja: Franja, o: { iniciado?: boolean; ahora?: Date } = {}): FechaViaje {
  const ahora = o.ahora ?? new Date();
  const n = diasEntre(paraCuando, ahora);
  const h = horaViaje(paraCuando, franja);
  const elDia = `${diaSemana(paraCuando)} ${ddmm(paraCuando)}`;
  if (n < 0) {
    const cuando = n === -1 ? `ayer ${h}` : `${elDia} · ${h}`;
    return o.iniciado ? { texto: `${cuando[0].toUpperCase()}${cuando.slice(1)}`, tono: "pasado", dias: n } : { texto: `ATRASADO · ${cuando}`, tono: "atrasado", dias: n };
  }
  if (n === 0) return { texto: `HOY · ${h}`, tono: "hoy", dias: n };
  if (n === 1) return { texto: `MAÑANA · ${h}`, tono: "manana", dias: n };
  if (n <= 6) return { texto: `${elDia.toUpperCase()} · ${h}`, tono: "futuro", dias: n };
  return { texto: `EN ${n} DÍAS · ${elDia} · ${h}`, tono: "futuro", dias: n };
}

/** Color de cada tono (hoy negro, mañana ámbar, futuro gris, atrasado rojo). */
export const CLASE_TONO: Record<TonoFecha, string> = {
  hoy: "text-tinta",
  manana: "text-aviso-texto",
  futuro: "text-suave",
  atrasado: "text-critico",
  pasado: "text-suave",
};

/**
 * Bloqueo por fecha: "Iniciar viaje" solo si el pedido es para hoy o ya pasó. Si es para más adelante,
 * el motivo ("Este viaje es para el lunes 13/10"); si no, null. Lo usan el botón y la action.
 */
export function bloqueoPorFecha(paraCuando: Date, ahora: Date = new Date()): string | null {
  const n = diasEntre(paraCuando, ahora);
  if (n <= 0) return null;
  if (n === 1) return `Este viaje es para mañana (${diaSemana(paraCuando)} ${ddmm(paraCuando)})`;
  return `Este viaje es para el ${diaSemana(paraCuando)} ${ddmm(paraCuando)}`;
}

/** "ayer", "el lunes 13/10": para "Claudio salió (estaba previsto para ayer)". */
export function previstoPara(paraCuando: Date, ahora: Date = new Date()) {
  const n = diasEntre(paraCuando, ahora);
  return n === -1 ? "ayer" : n === 0 ? "hoy" : `el ${diaSemana(paraCuando)} ${ddmm(paraCuando)}`;
}
