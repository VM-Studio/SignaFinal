/**
 * ¿Dos descripciones de pedido hablan de lo mismo?
 * "Hierro del 10, 40 barras" ≈ "Hierro del 10 para losa (40 barras)".
 */

const VACIAS = new Set([
  "del", "de", "la", "las", "los", "el", "para", "con", "por", "una", "uno", "unos", "unas", "que", "y", "en", "a", "al",
  "obra", "traer", "llevar", "retirar", "buscar", "mas", "hay",
]);

export function palabras(texto: string): Set<string> {
  return new Set(
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9ñ ]/g, " ")
      .split(/\s+/)
      .map((p) => (p.length > 4 && p.endsWith("s") ? p.slice(0, -1) : p)) // plural simple
      .filter((p) => p.length >= 2 && !VACIAS.has(p)),
  );
}

/** 0 a 1. Usa la proporción de palabras del texto más corto que aparecen en el otro. */
export function parecido(a: string, b: string): number {
  const A = palabras(a);
  const B = palabras(b);
  if (A.size === 0 || B.size === 0) return 0;
  const [chico, grande] = A.size <= B.size ? [A, B] : [B, A];
  let comunes = 0;
  for (const p of chico) if (grande.has(p)) comunes++;
  return comunes / chico.size;
}

export const UMBRAL_PARECIDO = 0.6;
