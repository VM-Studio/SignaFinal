import { differenceInCalendarDays, format, isToday, isTomorrow, isYesterday } from "date-fns";
import { es } from "date-fns/locale";

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const entero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

export const plata = (n: number | null | undefined) => (n == null ? "—" : pesos.format(n));
export const num = (n: number | null | undefined) => (n == null ? "—" : entero.format(n));
export const km = (n: number | null | undefined) => (n == null ? "—" : `${entero.format(n)} km`);
export const fecha = (d: Date | string | null | undefined) => (d ? format(new Date(d), "d MMM yyyy", { locale: es }) : "—");
export const hora = (d: Date | string) => format(new Date(d), "HH:mm");
export const diasHasta = (d: Date | string) => differenceInCalendarDays(new Date(d), new Date());

export function cuando(d: Date | string | null | undefined) {
  if (!d) return "—";
  const f = new Date(d);
  if (isToday(f)) return `hoy ${hora(f)}`;
  if (isYesterday(f)) return `ayer ${hora(f)}`;
  if (isTomorrow(f)) return `mañana ${hora(f)}`;
  return format(f, "d MMM HH:mm", { locale: es });
}

/** "Vencido hace 3 días", "Vence en 5 días", "Vence hoy". */
export function vencimiento(d: Date | string) {
  const n = diasHasta(d);
  if (n < 0) return { texto: `Vencido hace ${-n} día${n === -1 ? "" : "s"}`, tono: "critico" as const };
  if (n === 0) return { texto: "Vence hoy", tono: "critico" as const };
  return { texto: `Vence en ${n} día${n === 1 ? "" : "s"}`, tono: n <= 7 ? ("critico" as const) : ("aviso" as const) };
}
