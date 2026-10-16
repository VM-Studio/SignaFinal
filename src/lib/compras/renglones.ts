/**
 * "PASAR A RENGLONES": Alejandra escribe el Detalle del Pedido como lista, una línea por material
 * ("40 - bolsas de cemento", "16 Unidades - Protex Seal 77", "1 unidad: reja 15x15", "2) Malla 15x15,
 * 10 rollos"). Cada línea pasa a un renglón con cantidad, unidad y descripción; lo que no se entiende
 * queda como descripción con cantidad 1 y unidad "u" para que ella lo corrija. Pura (tests).
 */
export type RenglonDetalle = { descripcion: string; cantidad: number; unidad: string };

const UNIDADES: [RegExp, string][] = [
  [/^(u|un|und|unid|unidad|unidades|uds?)\.?$/i, "u"],
  [/^(bolsas?|bls?)\.?$/i, "bolsas"],
  [/^(m2|m²|mts2|metros?\s*cuadrados?)$/i, "m²"],
  [/^(m3|m³|mts3|metros?\s*c[uú]bicos?)$/i, "m³"],
  [/^(m|mts?|metros?|ml)\.?$/i, "m"],
  [/^(kg|kgs|kilos?)\.?$/i, "kg"],
  [/^(tn|ton|toneladas?)\.?$/i, "tn"],
  [/^(barras?)$/i, "barras"],
  [/^(rollos?)$/i, "rollos"],
  [/^(cajas?)$/i, "cajas"],
  [/^(pallets?|palets?)$/i, "pallets"],
  [/^(litros?|lts?|l)\.?$/i, "litros"],
  [/^(latas?)$/i, "latas"],
  [/^(baldes?)$/i, "baldes"],
  [/^(placas?)$/i, "placas"],
  [/^(chapas?)$/i, "chapas"],
  [/^(pares?)$/i, "pares"],
  [/^(juegos?)$/i, "juegos"],
];

export const unidadDe = (palabra: string) => UNIDADES.find(([re]) => re.test(palabra.trim()))?.[1] ?? null;
const numero = (t: string) => {
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const limpiar = (s: string) => s.replace(/^[\s\-–—:.,]+|[\s\-–—:.,]+$/g, "").replace(/\s+/g, " ").trim();
const NUM = "(\\d+(?:[.,]\\d+)?)";

export function lineaARenglon(lineaOriginal: string): RenglonDetalle | null {
  // Viñetas y numeración de la lista: "1)", "2.", "-", "•".
  const linea = lineaOriginal.replace(/^\s*(?:\d+\s*\)\s*|\d+\.\s+|[-•*·]\s+)/, "").trim();
  if (!linea || /^[?¿\s-]+$/.test(linea)) return null;

  // Adelante: "40 - bolsas de cemento", "16 Unidades - Protex", "1 unidad: reja", "40 bolsas cemento", "10 x rollos de malla".
  const adelante = linea.match(new RegExp(`^${NUM}\\s*(?:x\\s+)?([A-Za-zÁÉÍÓÚáéíóúñÑ²³0-9.]*)\\s*(?:[-–—:]\\s*)?(?:de\\s+)?(.+)$`, "i"));
  if (adelante) {
    const cantidad = numero(adelante[1]);
    const unidad = unidadDe(adelante[2]);
    if (cantidad) {
      if (unidad) return { cantidad, unidad, descripcion: limpiar(adelante[3]) || unidad };
      // "40 - bolsas de cemento": la unidad viene después del guion.
      const resto = `${adelante[2]} ${adelante[3]}`.trim();
      const conUnidad = resto.match(/^([A-Za-zÁÉÍÓÚáéíóúñÑ²³]+)\s+(?:de\s+)?(.+)$/i);
      if (conUnidad && unidadDe(conUnidad[1])) return { cantidad, unidad: unidadDe(conUnidad[1])!, descripcion: limpiar(conUnidad[2]) };
      return { cantidad, unidad: "u", descripcion: limpiar(resto) };
    }
  }
  // Atrás: "Malla 15x15, 10 rollos", "Corte y plegado 5,50 Un."
  const atras = linea.match(new RegExp(`^(.+?)[,\\s]+${NUM}\\s*([A-Za-zÁÉÍÓÚáéíóúñÑ²³.]+)?\\.?$`));
  if (atras) {
    const cantidad = numero(atras[2]);
    const unidad = atras[3] ? unidadDe(atras[3]) : null;
    if (cantidad && (unidad || !atras[3])) return { cantidad, unidad: unidad ?? "u", descripcion: limpiar(atras[1]) };
  }
  return { cantidad: 1, unidad: "u", descripcion: limpiar(linea) };
}

export function pasarARenglones(detalle: string): RenglonDetalle[] {
  return detalle.split(/\r?\n/).map(lineaARenglon).filter((r): r is RenglonDetalle => !!r && !!r.descripcion).slice(0, 200);
}
