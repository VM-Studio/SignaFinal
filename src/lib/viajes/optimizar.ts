/**
 * ORDEN ESTRATÉGICO DE LAS PARADAS (puro: lo prueban los tests). Recorrer menos km respetando que
 * cada entrega va después de su retiro.
 *
 * 1. Vecino más cercano con precedencia: desde la posición del vehículo (o su base), la parada más
 *    cercana entre las que ya se pueden hacer (sus retiros ya están antes).
 * 2. Mejora 2-opt: invertir tramos del recorrido solo si queda válido y más corto.
 * 3. Nunca empeora: si el orden que vino (por ejemplo, el que eligió el chofer) es válido y más corto, queda ese.
 *
 * La matriz de distancias la arma el servidor (OSRM table si hay pocas paradas, línea recta × 1,3 si no):
 * índice 0 = punto de partida, i + 1 = paradas[i].
 */
export type Precedencia = [antes: string, despues: string];
export type Matriz = number[][];

/** ¿Cada entrega queda después de su retiro? (las claves fijas ya hechas no se mueven). */
export function ordenValido(orden: string[], precedencias: Precedencia[]) {
  const pos = new Map(orden.map((c, i) => [c, i]));
  return precedencias.every(([a, b]) => !pos.has(a) || !pos.has(b) || pos.get(a)! < pos.get(b)!);
}

/** Metros del recorrido: partida → orden[0] → orden[1] → … (con los índices de la matriz). */
export function largo(indices: number[], m: Matriz, desde = 0) {
  let total = 0;
  let previo = desde;
  for (const i of indices) {
    total += m[previo][i];
    previo = i;
  }
  return total;
}

export type Optimizado = { orden: string[]; totalM: number; tramos: number[] };

/**
 * claves[i] corresponde a la fila i + 1 de la matriz. fijas: prefijo de claves que ya se hicieron (o la
 * actual): no se reordenan y el recorrido de las demás empieza en la última fija.
 */
export function optimizarOrden(claves: string[], precedencias: Precedencia[], m: Matriz, o: { fijas?: string[]; actual?: string[] } = {}): Optimizado {
  const indice = new Map(claves.map((c, i) => [c, i + 1]));
  const fijas = (o.fijas ?? []).filter((c) => indice.has(c));
  const libres = claves.filter((c) => !fijas.includes(c));
  const inicio = fijas.length ? indice.get(fijas[fijas.length - 1])! : 0;
  // Lo ya hecho cuenta como visitado para las precedencias.
  const antesDe = (c: string) => precedencias.filter(([, b]) => b === c).map(([a]) => a);

  // 1) Vecino más cercano con precedencia.
  const visitadas = new Set(fijas);
  const nn: string[] = [];
  let actual = inicio;
  while (nn.length < libres.length) {
    const posibles = libres.filter((c) => !visitadas.has(c) && antesDe(c).every((a) => visitadas.has(a) || !indice.has(a)));
    if (!posibles.length) break; // precedencias imposibles: no debería pasar
    const sig = posibles.reduce((mejor, c) => (m[actual][indice.get(c)!] < m[actual][indice.get(mejor)!] ? c : mejor));
    nn.push(sig);
    visitadas.add(sig);
    actual = indice.get(sig)!;
  }
  if (nn.length < libres.length) nn.push(...libres.filter((c) => !nn.includes(c)));

  // 2) 2-opt: invertir [i..j] si queda válido y más corto.
  const valido = (orden: string[]) => ordenValido([...fijas, ...orden], precedencias);
  const metros = (orden: string[]) => largo(orden.map((c) => indice.get(c)!), m, inicio);
  let mejor = nn;
  let mejorM = metros(mejor);
  for (let vuelta = 0, mejoro = true; mejoro && vuelta < 50; vuelta++) {
    mejoro = false;
    for (let i = 0; i < mejor.length - 1; i++) {
      for (let j = i + 1; j < mejor.length; j++) {
        const prueba = [...mejor.slice(0, i), ...mejor.slice(i, j + 1).reverse(), ...mejor.slice(j + 1)];
        if (!valido(prueba)) continue;
        const pm = metros(prueba);
        if (pm < mejorM - 0.5) {
          mejor = prueba;
          mejorM = pm;
          mejoro = true;
        }
      }
    }
  }

  // 3) Nunca peor que el orden que vino (si era válido).
  const vino = (o.actual ?? libres).filter((c) => libres.includes(c));
  if (vino.length === libres.length && valido(vino) && metros(vino) < mejorM) {
    mejor = vino;
    mejorM = metros(vino);
  }

  const orden = [...fijas, ...mejor];
  const idx = orden.map((c) => indice.get(c)!);
  const tramos = idx.map((i, k) => m[k === 0 ? 0 : idx[k - 1]][i]);
  return { orden, totalM: Math.round(fijas.length ? largo(idx, m) : mejorM), tramos: tramos.map(Math.round) };
}
