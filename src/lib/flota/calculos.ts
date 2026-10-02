import type { DocumentoVehiculo, TipoDocumentoVehiculo } from "@prisma/client";

/** Cálculos de flota sin acceso a la base ni a la sesión (los usan pantallas, alertas y la carga de demo). */

/** El vigente de cada tipo de documento = el de vencimiento más lejano. */
export function documentosVigentes(docs: Pick<DocumentoVehiculo, "id" | "tipo" | "vencimiento" | "archivoUrl" | "notas" | "creadoEn">[]) {
  const porTipo = new Map<TipoDocumentoVehiculo, (typeof docs)[number]>();
  for (const d of docs) {
    const actual = porTipo.get(d.tipo);
    if (!actual || (d.vencimiento?.getTime() ?? 0) > (actual.vencimiento?.getTime() ?? 0)) porTipo.set(d.tipo, d);
  }
  return [...porTipo.values()];
}

/** Consumo en l/100 km entre cargas consecutivas (supone tanque lleno en cada carga). */
export function conConsumo<T extends { km: number; litros: number; fecha: Date }>(cargas: T[]) {
  const asc = [...cargas].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  const consumo = new Map<T, number | null>();
  asc.forEach((c, i) => {
    const prev = asc[i - 1];
    const km = prev ? c.km - prev.km : 0;
    consumo.set(c, prev && km > 0 && km < 5000 ? (c.litros / km) * 100 : null);
  });
  return cargas.map((c) => ({ ...c, consumo: consumo.get(c) ?? null }));
}

