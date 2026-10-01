import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";

/** Formatos que se usan en toda la app. Funciones puras: sirven en servidor y cliente. */

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

export const plata = (n: number | null | undefined) => (n == null ? "—" : pesos.format(n));
export const num = (n: number | null | undefined) => (n == null ? "—" : numero.format(n));
export const dec = (n: number | null | undefined) => (n == null ? "—" : decimal.format(n));
export const km = (n: number | null | undefined) => (n == null ? "—" : `${numero.format(n)} km`);

export function peso(kg: number | null | undefined) {
  if (kg == null) return "—";
  if (kg >= 1000) return `${decimal.format(kg / 1000)} tn`;
  return `${numero.format(kg)} kg`;
}

export const fecha = (d: Date | string | null | undefined) =>
  d ? format(new Date(d), "d MMM yyyy", { locale: es }) : "—";

export const fechaCorta = (d: Date | string | null | undefined) =>
  d ? format(new Date(d), "d/M", { locale: es }) : "—";

export const hora = (d: Date | string | null | undefined) => (d ? format(new Date(d), "HH:mm") : "—");

export function cuando(d: Date | string | null | undefined) {
  if (!d) return "—";
  const f = new Date(d);
  if (isToday(f)) return `hoy ${hora(f)}`;
  if (isYesterday(f)) return `ayer ${hora(f)}`;
  return format(f, "d MMM HH:mm", { locale: es });
}

export function diaRelativo(d: Date | string | null | undefined) {
  if (!d) return "—";
  const f = new Date(d);
  if (isToday(f)) return "hoy";
  if (isTomorrow(f)) return "mañana";
  if (isYesterday(f)) return "ayer";
  return format(f, "EEE d MMM", { locale: es });
}

export const hace = (d: Date | string) =>
  `hace ${formatDistanceToNowStrict(new Date(d), { locale: es })}`;

/** Días hasta una fecha (negativo = vencida). */
export const diasHasta = (d: Date | string) => differenceInCalendarDays(new Date(d), new Date());

export function vencimiento(d: Date | string | null | undefined): { texto: string; nivel: "ok" | "aviso" | "critico" | "nada" } {
  if (!d) return { texto: "Sin cargar", nivel: "aviso" };
  const dias = diasHasta(d);
  if (dias < 0) return { texto: `Vencido el ${fecha(d)}`, nivel: "critico" };
  if (dias === 0) return { texto: "Vence hoy", nivel: "critico" };
  if (dias <= 30) return { texto: `Vence en ${dias} día${dias === 1 ? "" : "s"}`, nivel: "aviso" };
  return { texto: `Vigente hasta ${fecha(d)}`, nivel: "ok" };
}

/** Para inputs type=date */
export const aInputFecha = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : "";
