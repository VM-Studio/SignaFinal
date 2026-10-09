import { db } from "@/lib/db";
import { CLAVE, guardarEstado, type SinEnlazar } from "./estado";
import type { PosicionExterna } from "./tipos";

/** "AH 282 PU", "ah-282-pu" → "AH282PU". */
export const normalizarPatente = (p: string) => p.toUpperCase().replace(/[^A-Z0-9]/g, "");
const normalizarNombre = (n: string) => n.trim().toUpperCase().replace(/\s+/g, " ");

/**
 * Enlaza cada unidad de Cusat con un vehículo de la base y guarda idCusat:
 * 1) el que ya tiene ese idCusat (incluye los enlazados a mano), 2) por patente normalizada,
 * 3) por cusatNombre (sin importar mayúsculas). Las que no enlazan quedan en "sin enlazar"
 * (Configuración → Rastreo). Devuelve idExterno → vehiculoId.
 */
export async function emparejar(posiciones: PosicionExterna[]) {
  const vehiculos = await db.vehiculo.findMany({ select: { id: true, patente: true, cusatNombre: true, idCusat: true, activo: true } });
  const porId = new Map(vehiculos.filter((v) => v.idCusat).map((v) => [v.idCusat!, v]));
  const enlace = new Map<string, string>();
  const sinEnlazar: SinEnlazar = [];
  const usados = new Set<string>();

  for (const p of posiciones) {
    const ya = porId.get(p.idExterno);
    if (ya) {
      enlace.set(p.idExterno, ya.id);
      usados.add(ya.id);
    }
  }
  for (const p of posiciones) {
    if (enlace.has(p.idExterno)) continue;
    const libres = vehiculos.filter((v) => !usados.has(v.id) && !v.idCusat);
    const v =
      libres.find((x) => normalizarPatente(x.patente) === normalizarPatente(p.patente)) ??
      libres.find((x) => x.cusatNombre && normalizarNombre(x.cusatNombre) === normalizarNombre(p.nombre));
    if (!v) {
      sinEnlazar.push({ idExterno: p.idExterno, nombre: p.nombre, patente: p.patente, lat: p.latitud, lng: p.longitud, fechaGps: p.fechaGps.toISOString() });
      continue;
    }
    await db.vehiculo.update({ where: { id: v.id }, data: { idCusat: p.idExterno, ...(v.cusatNombre ? {} : { cusatNombre: p.nombre }) } });
    enlace.set(p.idExterno, v.id);
    usados.add(v.id);
  }
  await guardarEstado(CLAVE.sinEnlazar, sinEnlazar);
  return { enlace, sinEnlazar };
}
