import type { Franja, OrigenTipo, TipoRecordatorio } from "@prisma/client";
import { aFecha, diaISO, sumarDias } from "@/lib/formato";
import { aLaHora, horaViaje } from "./fecha";

/**
 * RECORDATORIOS DEL CHOFER (solo CHOFER; Dirección recibe un resumen). Puro: lo prueban los tests.
 * Cuándo, para un viaje aceptado con fecha paraCuando (hora argentina):
 *   - el día anterior a las 18:00 ("Mañana tenés un retiro en…");
 *   - el mismo día a las 7:00 ("Hoy: retiro en…"; con varios viajes, UN aviso con la lista en orden);
 *   - si llegó la hora y no inició: a la hora exacta y cada 60 minutos, máximo 4 ("Todavía no iniciaste…").
 * Al iniciar, al soltar o al cancelar se cancelan los que faltan; al reprogramar se vuelven a calcular.
 */
export const PARAMETROS_RECORDATORIOS = {
  diaAnterior: "18:00",
  mismoDia: "07:00",
  resumenDireccion: "09:00",
  cadaMin: 60,
  maxSinIniciar: 4,
  /** Un recordatorio que se tendría que haber mandado hace más que esto ya no se manda (el cron estuvo caído). */
  vigenciaMs: 3 * 3600_000,
  /** "Todavía no iniciaste": solo vale hasta el siguiente (si se atrasó, se manda el último). */
  vigenciaSinIniciarMs: 60 * 60_000,
} as const;

export type Programado = { tipo: TipoRecordatorio; programadoPara: Date; n: number };

/** Todos los recordatorios de un viaje, los que todavía no pasaron (con un minuto de margen). */
export function planRecordatorios(paraCuando: Date, ahora: Date = new Date()): Programado[] {
  const P = PARAMETROS_RECORDATORIOS;
  const dia = diaISO(paraCuando);
  const todos: Programado[] = [
    { tipo: "VIAJE_MANANA", programadoPara: aFecha(sumarDias(dia, -1), P.diaAnterior), n: 0 },
    { tipo: "VIAJE_HOY", programadoPara: aFecha(dia, P.mismoDia), n: 0 },
    ...Array.from({ length: P.maxSinIniciar }, (_, n) => ({ tipo: "VIAJE_SIN_INICIAR" as const, programadoPara: new Date(paraCuando.getTime() + n * P.cadaMin * 60_000), n })),
  ];
  return todos
    // "Todavía no iniciaste" es del mismo día: nunca pasa de medianoche.
    .filter((r) => r.tipo !== "VIAJE_SIN_INICIAR" || diaISO(r.programadoPara) === dia)
    // El de las 7:00 no tiene sentido si el viaje es antes de las 7:00 (ya lo cubre "Todavía no iniciaste").
    .filter((r) => r.tipo !== "VIAJE_HOY" || r.programadoPara < paraCuando)
    .filter((r) => r.programadoPara.getTime() > ahora.getTime() - 60_000);
}

/** Clave única: tipo:usuario:pedido:momento. Reprogramar cambia el momento, así que no choca con los viejos. */
export const claveRecordatorio = (usuarioId: string, pedidoId: string, r: Pick<Programado, "tipo" | "programadoPara">) =>
  `${r.tipo}:${usuarioId}:${pedidoId}:${r.programadoPara.toISOString()}`;

/** ¿Sigue valiendo? (el pedido no cambió de fecha desde que se programó). */
export function sigueValiendo(r: { tipo: TipoRecordatorio; programadoPara: Date }, paraCuando: Date) {
  const dia = diaISO(paraCuando);
  if (r.tipo === "VIAJE_MANANA") return sumarDias(diaISO(r.programadoPara), 1) === dia;
  if (r.tipo === "VIAJE_HOY") return diaISO(r.programadoPara) === dia;
  if (r.tipo === "VIAJE_SIN_INICIAR") return diaISO(r.programadoPara) === dia && r.programadoPara >= paraCuando;
  return true;
}

/** ¿Todavía se manda o ya es tarde? */
export function vigente(r: { tipo: TipoRecordatorio; programadoPara: Date }, ahora: Date = new Date()) {
  const atraso = ahora.getTime() - r.programadoPara.getTime();
  return atraso < (r.tipo === "VIAJE_SIN_INICIAR" ? PARAMETROS_RECORDATORIOS.vigenciaSinIniciarMs : PARAMETROS_RECORDATORIOS.vigenciaMs);
}

// ─────────────────────────────── Textos ───────────────────────────────

export type ViajeRecordado = { origenTipo: OrigenTipo; origen: string; destino: string; paraCuando: Date; franja: Franja };

/** Lo que hace: "un retiro en Corralón San Martín" o, si sale de la base con todo arriba, "una entrega en Obra Darwin". */
const esEntrega = (v: ViajeRecordado) => v.origenTipo === "BASE";
const lugar = (v: ViajeRecordado) => (esEntrega(v) ? v.destino : v.origen);
const para = (v: ViajeRecordado) => (esEntrega(v) ? "" : ` para ${v.destino}`);
const que = (v: ViajeRecordado) => `${esEntrega(v) ? "entrega" : "retiro"} en ${lugar(v)}`;
const frase = (v: ViajeRecordado) => `${que(v)} ${aLaHora(v.paraCuando, v.franja)}${para(v)}`;
/** "1) 8:30: retiro en Corralón San Martín para Obra Darwin · 2) por la tarde: …", en orden. */
const lista = (vs: ViajeRecordado[]) =>
  [...vs].sort((a, b) => a.paraCuando.getTime() - b.paraCuando.getTime()).map((v, i) => `${i + 1}) ${horaViaje(v.paraCuando, v.franja)}: ${que(v)}${para(v)}`).join(" · ");

export const TEXTO_RECORDATORIO = {
  manana: (vs: ViajeRecordado[]) =>
    vs.length === 1
      ? { titulo: "Mañana tenés un viaje", cuerpo: `Mañana tenés ${esEntrega(vs[0]) ? "una" : "un"} ${frase(vs[0])}.` }
      : { titulo: `Mañana tenés ${vs.length} viajes`, cuerpo: `Mañana, en orden: ${lista(vs)}.` },
  hoy: (vs: ViajeRecordado[]) =>
    vs.length === 1
      ? { titulo: "Hoy tenés un viaje", cuerpo: `Hoy: ${frase(vs[0])}.` }
      : { titulo: `Hoy tenés ${vs.length} viajes`, cuerpo: `Hoy, en orden: ${lista(vs)}.` },
  sinIniciar: (v: ViajeRecordado) => ({
    titulo: "Todavía no iniciaste el viaje",
    cuerpo: `Todavía no iniciaste el viaje a ${lugar(v)} (${horaViaje(v.paraCuando, v.franja)}). Cuando salgas, tocá Iniciar viaje.`,
  }),
  resumenDireccion: (vs: (ViajeRecordado & { chofer: string })[]) => ({
    titulo: vs.length === 1 ? "1 viaje de hoy sin iniciar" : `${vs.length} viajes de hoy sin iniciar`,
    cuerpo: [...vs].sort((a, b) => a.paraCuando.getTime() - b.paraCuando.getTime()).map((v) => `${v.chofer}: ${frase(v)}`).join(" · "),
  }),
};
