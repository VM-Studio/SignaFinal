import { db } from "@/lib/db";
import { DOCUMENTO } from "@/lib/etiquetas";
import { diasHasta, fecha, km } from "@/lib/formato";
import { conConsumo, documentosVigentes } from "@/lib/flota/calculos";
import type { AlertaCalculada, Regla } from "../tipos";

const venceTexto = (n: number) => (n < 0 ? `venció hace ${-n} día${n === -1 ? "" : "s"}` : n === 0 ? "vence hoy" : `vence en ${n} día${n === 1 ? "" : "s"}`);

/** Documento de vehículo: vence en 15 días (aviso) o venció (crítica). */
async function documentos(): Promise<AlertaCalculada[]> {
  const vehiculos = await db.vehiculo.findMany({ where: { activo: true }, select: { id: true, nombre: true, documentos: { select: { id: true, tipo: true, vencimiento: true, archivoUrl: true, notas: true, creadoEn: true } } } });
  const out: AlertaCalculada[] = [];
  for (const v of vehiculos) {
    for (const d of documentosVigentes(v.documentos)) {
      if (!d.vencimiento) continue;
      const n = diasHasta(d.vencimiento);
      if (n > 15) continue;
      out.push({
        claveUnica: `DOCUMENTO:${v.id}:${d.tipo}`, regla: "DOCUMENTO", severidad: n < 0 ? "CRITICA" : "AVISO",
        titulo: `${v.nombre}: ${DOCUMENTO[d.tipo]} ${venceTexto(n)}`,
        detalle: n < 0 ? `Venció el ${fecha(d.vencimiento)}. No se puede usar para viajes hasta renovarla.` : `Vence el ${fecha(d.vencimiento)}. Sacar turno o renovar.`,
        entidadTipo: "Vehiculo", entidadId: v.id, enlace: `/flota/${v.id}?tab=documentacion`,
      });
    }
  }
  return out;
}

/** Licencia de chofer vence en 30 días (o venció). */
async function licencias(): Promise<AlertaCalculada[]> {
  const c = await db.usuario.findMany({ where: { rol: "CHOFER", activo: true }, select: { id: true, nombre: true, licenciaVencimiento: true } });
  return c.flatMap((x): AlertaCalculada[] => {
    if (!x.licenciaVencimiento) {
      return [{ claveUnica: `LICENCIA:${x.id}`, regla: "LICENCIA", severidad: "AVISO", titulo: `${x.nombre}: falta cargar la licencia`, detalle: "Sin fecha de vencimiento no puede tomar viajes.", entidadTipo: "Usuario", entidadId: x.id, enlace: "/usuarios", usuarioId: x.id }];
    }
    const n = diasHasta(x.licenciaVencimiento);
    if (n > 30) return [];
    return [{
      claveUnica: `LICENCIA:${x.id}`, regla: "LICENCIA", severidad: n < 0 ? "CRITICA" : "AVISO",
      titulo: `Licencia de ${x.nombre}: ${venceTexto(n)}`, detalle: `Vence el ${fecha(x.licenciaVencimiento)}.${n < 0 ? " No puede manejar para la empresa." : ""}`,
      entidadTipo: "Usuario", entidadId: x.id, enlace: "/usuarios", usuarioId: x.id,
    }];
  });
}

/** Service próximo: menos de 1.000 km o 15 días (pasado = crítica). */
async function service(): Promise<AlertaCalculada[]> {
  const vehiculos = await db.vehiculo.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, kmActual: true, mantenimientos: { where: { OR: [{ proximoKm: { not: null } }, { proximaFecha: { not: null } }] }, orderBy: { fecha: "desc" }, take: 1 } },
  });
  const out: AlertaCalculada[] = [];
  for (const v of vehiculos) {
    const m = v.mantenimientos[0];
    if (!m) continue;
    const faltanKm = m.proximoKm != null ? m.proximoKm - v.kmActual : null;
    const faltanDias = m.proximaFecha ? diasHasta(m.proximaFecha) : null;
    const cercaKm = faltanKm != null && faltanKm < 1000;
    const cercaFecha = faltanDias != null && faltanDias <= 15;
    if (!cercaKm && !cercaFecha) continue;
    const pasado = (faltanKm != null && faltanKm <= 0) || (faltanDias != null && faltanDias < 0);
    const partes = [faltanKm != null && cercaKm ? (faltanKm > 0 ? `faltan ${km(faltanKm)}` : `pasado por ${km(-faltanKm)}`) : null, faltanDias != null && cercaFecha ? venceTexto(faltanDias).replace("vence", "toca").replace("venció", "tocaba") : null].filter(Boolean);
    out.push({
      claveUnica: `SERVICE:${v.id}`, regla: "SERVICE", severidad: pasado ? "CRITICA" : "AVISO",
      titulo: `${v.nombre}: service ${pasado ? "atrasado" : "próximo"}`, detalle: `${partes.join(" · ")}. Tiene ${km(v.kmActual)}.`,
      entidadTipo: "Vehiculo", entidadId: v.id, enlace: `/flota/${v.id}?tab=mantenimiento`,
    });
  }
  return out;
}

/** Consumo de la última carga 25% sobre el promedio del vehículo. */
async function consumo(): Promise<AlertaCalculada[]> {
  const vehiculos = await db.vehiculo.findMany({ where: { activo: true }, select: { id: true, nombre: true, cargas: { orderBy: { fecha: "desc" }, take: 12, select: { id: true, km: true, litros: true, fecha: true } } } });
  const out: AlertaCalculada[] = [];
  for (const v of vehiculos) {
    const conC = conConsumo(v.cargas.map((c) => ({ ...c, litros: Number(c.litros) }))).filter((c) => c.consumo != null);
    if (conC.length < 3) continue; // hace falta historia para comparar
    const [ultima, ...previas] = [...conC].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
    const promedio = previas.reduce((s, c) => s + c.consumo!, 0) / previas.length;
    if (ultima.consumo! <= promedio * 1.25) continue;
    out.push({
      claveUnica: `CONSUMO:${ultima.id}`, regla: "CONSUMO", severidad: "AVISO",
      titulo: `${v.nombre}: consumo alto`, detalle: `${ultima.consumo!.toFixed(1)} l/100 km en la última carga, ${Math.round((ultima.consumo! / promedio - 1) * 100)}% sobre su promedio (${promedio.toFixed(1)}). Revisar pérdidas o el ticket.`,
      entidadTipo: "CargaCombustible", entidadId: ultima.id, enlace: `/flota/${v.id}?tab=combustible`,
    });
  }
  return out;
}

export const REGLAS_FLOTA: Regla[] = [
  { nombre: "DOCUMENTO", modulo: "flota", evaluar: documentos },
  { nombre: "LICENCIA", modulo: "flota", evaluar: licencias },
  { nombre: "SERVICE", modulo: "flota", evaluar: service },
  { nombre: "CONSUMO", modulo: "flota", evaluar: consumo },
];
