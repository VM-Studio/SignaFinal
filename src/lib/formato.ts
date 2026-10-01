/**
 * Formatos de la app, siempre en hora de Buenos Aires (el servidor de Vercel corre en UTC).
 * Funciones puras: sirven en servidor y cliente.
 */

export const ZONA = "America/Argentina/Buenos_Aires";
const OFFSET = "-03:00"; // Argentina no tiene horario de verano

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const entero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const fmtHora = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false });
const fmtFecha = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, day: "numeric", month: "short", year: "numeric" });
const fmtDiaCorto = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, weekday: "short", day: "numeric", month: "short" });
const fmtISO = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });

export const plata = (n: number | null | undefined) => (n == null ? "—" : pesos.format(n));
export const num = (n: number | null | undefined) => (n == null ? "—" : entero.format(n));
export const km = (n: number | null | undefined) => (n == null ? "—" : `${entero.format(n)} km`);

export function peso(kg: number | null | undefined) {
  if (kg == null) return "—";
  return kg >= 1000 ? `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(kg / 1000)} tn` : `${entero.format(kg)} kg`;
}

/** "2026-10-01" en hora argentina. */
export const diaISO = (d: Date | string = new Date()) => fmtISO.format(new Date(d));
/** Instante de un día y hora argentinos: aFecha("2026-10-01", "08:30"). */
export const aFecha = (dia: string, hhmm = "00:00") => new Date(`${dia}T${hhmm}:00${OFFSET}`);
export const sumarDias = (dia: string, n: number) => diaISO(new Date(aFecha(dia, "12:00").getTime() + n * 86_400_000));
export const inicioDelDia = (d: Date = new Date()) => aFecha(diaISO(d));

export const hora = (d: Date | string) => fmtHora.format(new Date(d));
export const fecha = (d: Date | string | null | undefined) => (d ? fmtFecha.format(new Date(d)).replace(".", "") : "—");

/** Diferencia en días calendario (argentinos) entre hoy y d. */
export function diasHasta(d: Date | string) {
  return Math.round((aFecha(diaISO(d), "12:00").getTime() - aFecha(diaISO(), "12:00").getTime()) / 86_400_000);
}

/** "hoy", "mañana", "ayer", "jue 3 oct". */
export function dia(d: Date | string) {
  const n = diasHasta(d);
  if (n === 0) return "hoy";
  if (n === 1) return "mañana";
  if (n === -1) return "ayer";
  return fmtDiaCorto.format(new Date(d)).replace(".", "");
}

/** "hoy 08:30", "ayer 14:00". */
export const cuando = (d: Date | string | null | undefined) => (d ? `${dia(d)} ${hora(d)}` : "—");

/** "Vencido hace 3 días", "Vence en 5 días". */
export function vencimiento(d: Date | string) {
  const n = diasHasta(d);
  if (n < 0) return { texto: `Vencido hace ${-n} día${n === -1 ? "" : "s"}`, tono: "critico" as const };
  if (n === 0) return { texto: "Vence hoy", tono: "critico" as const };
  return { texto: `Vence en ${n} día${n === 1 ? "" : "s"}`, tono: n <= 7 ? ("critico" as const) : ("aviso" as const) };
}
