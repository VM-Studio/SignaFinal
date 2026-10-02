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

/**
 * "2026-10-01" en hora argentina. Las fechas sin hora de la base (@db.Date) llegan como
 * medianoche UTC: esas se toman tal cual, si no caerían en el día anterior.
 */
export function diaISO(d: Date | string = new Date()) {
  const f = new Date(d);
  if (f.getUTCHours() === 0 && f.getUTCMinutes() === 0 && f.getUTCSeconds() === 0 && f.getUTCMilliseconds() === 0) return f.toISOString().slice(0, 10);
  return fmtISO.format(f);
}
/** Instante de un día y hora argentinos: aFecha("2026-10-01", "08:30"). */
export const aFecha = (dia: string, hhmm = "00:00") => new Date(`${dia}T${hhmm}:00${OFFSET}`);
export const sumarDias = (dia: string, n: number) => diaISO(new Date(aFecha(dia, "12:00").getTime() + n * 86_400_000));
export const inicioDelDia = (d: Date = new Date()) => aFecha(diaISO(d));

export const hora = (d: Date | string) => fmtHora.format(new Date(d));
export const fecha = (d: Date | string | null | undefined) => (d ? fmtFecha.format(aFecha(diaISO(d), "12:00")).replace(".", "") : "—");

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
  if (n < 0) return { dias: n, texto: `Vencido hace ${-n} día${n === -1 ? "" : "s"}`, tono: "critico" as const };
  if (n === 0) return { dias: n, texto: "Vence hoy", tono: "critico" as const };
  return { dias: n, texto: `Vence en ${n} día${n === 1 ? "" : "s"}`, tono: n <= 7 ? ("critico" as const) : ("aviso" as const) };
}

/** Primer instante del mes (hora argentina) de la fecha dada. */
export const inicioDelMes = (d: Date = new Date()) => aFecha(`${diaISO(d).slice(0, 7)}-01`);
/** Primer instante del mes siguiente. */
export function inicioMesSiguiente(d: Date = new Date()) {
  const [a, m] = diaISO(d).split("-").map(Number);
  return aFecha(m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`);
}
export const litros = (n: number | null | undefined) => (n == null ? "—" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(n)} l`);
export const dec = (n: number | null | undefined) => (n == null ? "—" : new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(n));

/** "hace 3 min", "hace 2 h", "hace 4 días". */
export function hace(d: Date | string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return "recién";
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86_400) return `hace ${Math.round(s / 3600)} h`;
  const n = Math.round(s / 86_400);
  return `hace ${n} día${n === 1 ? "" : "s"}`;
}
