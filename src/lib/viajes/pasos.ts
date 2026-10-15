/**
 * LOS PASOS DEL CHOFER (modo conducción): el viaje es una secuencia de deslizadores, uno por pantalla, armada
 * a partir de las paradas. Pura (la prueban los tests).
 *
 *   Iniciar viaje → por cada parada menos la última: "Llegué a X" y "En camino a Y" → "Terminar viaje".
 *
 *   Simple (retiro + entrega): Iniciar → Llegué al Corralón → En camino a Obra Darwin → Terminar (4 pasos).
 *   Varios retiros para una obra: Iniciar → Llegué a A → En camino a B → Llegué a B → En camino a la obra → Terminar.
 *   Un retiro para varias obras: Iniciar → Llegué al proveedor → En camino a Obra A → Llegué a Obra A → … → Terminar.
 *   Sin retiro: Iniciar → Terminar.
 *
 * Nunca hay un "salgo" aparte del "en camino": deslizar "En camino a Y" completa la parada donde está.
 */

export type EstadoParadaPaso = "PENDIENTE" | "EN_CAMINO" | "LLEGO" | "COMPLETADA" | "SALTEADA";
export type ParadaPaso = { id: string; nombre: string; estado: EstadoParadaPaso | string };
export type TipoPaso = "INICIAR" | "LLEGUE" | "EN_CAMINO" | "TERMINAR";
export type Paso = {
  clave: string;
  tipo: TipoPaso;
  titulo: string;
  /** La parada donde se hace el paso (Llegué a X: X; En camino a Y: la parada de la que sale; Terminar: la última). */
  paradaId: string | null;
  /** A dónde va después (En camino a Y: Y). */
  haciaId: string | null;
  hecho: boolean;
};

const terminada = (e: string) => e === "COMPLETADA" || e === "SALTEADA";
const llego = (e: string) => e === "LLEGO" || terminada(e);

/**
 * La secuencia completa con cada paso hecho o no, y cuál es el actual.
 * `porConfirmar`: la parada donde el GPS marcó una llegada que el chofer todavía no confirmó: su "Llegué" sigue
 * como paso actual (el deslizador se pone verde).
 */
export function pasosDelViaje(paradas: ParadaPaso[], estado: { iniciado: boolean; terminado: boolean; porConfirmar?: string | null }) {
  const pasos: Paso[] = [{ clave: "iniciar", tipo: "INICIAR", titulo: "Iniciar viaje", paradaId: null, haciaId: paradas[0]?.id ?? null, hecho: estado.iniciado || estado.terminado }];
  paradas.forEach((p, i) => {
    const siguiente = paradas[i + 1];
    if (!siguiente) return;
    pasos.push({ clave: `llegue:${p.id}`, tipo: "LLEGUE", titulo: `Llegué a ${p.nombre}`, paradaId: p.id, haciaId: null, hecho: estado.terminado || (llego(p.estado) && estado.porConfirmar !== p.id) });
    pasos.push({ clave: `camino:${p.id}`, tipo: "EN_CAMINO", titulo: `En camino a ${siguiente.nombre}`, paradaId: p.id, haciaId: siguiente.id, hecho: estado.terminado || terminada(p.estado) });
  });
  const ultima = paradas[paradas.length - 1] ?? null;
  pasos.push({ clave: "terminar", tipo: "TERMINAR", titulo: "Terminar viaje", paradaId: ultima?.id ?? null, haciaId: null, hecho: estado.terminado });
  const indice = pasos.findIndex((p) => !p.hecho);
  return { pasos, actual: indice === -1 ? null : pasos[indice], numero: indice === -1 ? pasos.length : indice + 1, total: pasos.length };
}
