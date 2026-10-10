/**
 * REPARTO DEL COSTO DE UN VIAJE CON PARADAS (puro: lo prueban los tests). Fórmula (también en CLAUDE.md):
 *
 *   km de cada tramo = km reales del viaje × (distancia planeada del tramo / suma de las distancias)
 *   costo del tramo  = km del tramo × costoKm del vehículo
 *   - el costo de cada tramo va a los pedidos de la PARADA DE LLEGADA de ese tramo, en partes iguales
 *     (un retiro compartido reparte su tramo entre los pedidos que se cargan ahí; una entrega, entre
 *     los que se entregan ahí);
 *   - los peajes se reparten en partes iguales entre todos los pedidos del viaje.
 *
 * Se redondea a centavos y la diferencia va al último, así la suma da exactamente el total del viaje.
 */
export type TramoReparto = { distanciaM: number | null; pedidos: string[] };
export type Parte = { costo: number; km: number; peajes: number };

const centavos = (n: number) => Math.round(n * 100) / 100;

export function repartirCostos(tramos: TramoReparto[], o: { kmReales: number; costoKm: number; peajes: number; pedidos: string[] }): Map<string, Parte> {
  const partes = new Map<string, Parte>(o.pedidos.map((id) => [id, { costo: 0, km: 0, peajes: 0 }]));
  const validos = tramos.filter((t) => t.pedidos.length);
  const suma = validos.reduce((s, t) => s + (t.distanciaM ?? 0), 0);
  for (const t of validos) {
    const proporcion = suma > 0 ? (t.distanciaM ?? 0) / suma : 1 / validos.length;
    const km = o.kmReales * proporcion;
    for (const id of t.pedidos) {
      const p = partes.get(id) ?? { costo: 0, km: 0, peajes: 0 };
      p.km += km / t.pedidos.length;
      p.costo += (km * o.costoKm) / t.pedidos.length;
      partes.set(id, p);
    }
  }
  for (const id of o.pedidos) {
    const p = partes.get(id)!;
    p.peajes = o.peajes / o.pedidos.length;
    p.costo += p.peajes;
  }
  // Centavos exactos: lo que sobra del redondeo va al último.
  const total = centavos(o.kmReales * o.costoKm + o.peajes);
  const ids = [...partes.keys()];
  let acumulado = 0;
  ids.forEach((id, i) => {
    const p = partes.get(id)!;
    p.km = Math.round(p.km * 10) / 10;
    p.peajes = centavos(p.peajes);
    p.costo = i === ids.length - 1 ? centavos(total - acumulado) : centavos(p.costo);
    acumulado = centavos(acumulado + p.costo);
  });
  return partes;
}
