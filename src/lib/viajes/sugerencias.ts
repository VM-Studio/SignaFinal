import type { LugarParada, TipoPedido } from "@prisma/client";
import { distancia, type Punto } from "@/lib/geo";
import { metros } from "@/lib/rutas/formato";
import { diaISO } from "@/lib/formato";
import { diaSemana } from "./fecha";
import { PARAMETROS_RUTEO as R } from "./parametros";

/**
 * "APROVECHÁ EL VIAJE" (puro: lo prueban los tests). Al aceptar un pedido, qué otros conviene llevar
 * en el mismo viaje:
 *   a) MISMO LUGAR: salen del mismo corralón, depósito u obra (mismo id o a menos de radioMismoLugarM).
 *   b) CERCA DE TU CAMINO: su origen o destino queda a menos de radioCercaM de alguna parada, o el desvío
 *      para pasar a buscarlo es menor que desvioMaximoM.
 * Los de otro día (posterior al viaje) aparecen en gris; personas y escombros no se combinan.
 */
export type PedidoCombinable = {
  id: string;
  numero: number;
  tipo: TipoPedido;
  descripcion: string;
  pesoKg: number | null;
  paraCuando: Date;
  solicitante: string;
  oc: string | null;
  origen: { tipo: LugarParada; id: string | null; nombre: string; punto: Punto };
  /** null: no hay retiro (lo que lleva ya está arriba). */
  sinRetiro?: boolean;
  destino: { nombre: string; obra: string; punto: Punto };
  /** Ya es del chofer (aceptado para el mismo día, sin iniciar). */
  propio?: boolean;
};

export type Sugerencia = {
  id: string;
  grupo: "mismoLugar" | "cerca";
  /** "hierro para Chubut (OC-2026-0010, 800 kg)" o "A 1,2 km del corralón: retirar hormigonera en Terreno Humboldt para Darwin". */
  texto: string;
  /** Lugar de referencia del grupo "mismo lugar" ("Corralón San Martín"). */
  lugar: string;
  distanciaM: number;
  /** Si no se puede elegir: "es para el jueves", "no se combinan personas con escombros". */
  gris: string | null;
  pedido: PedidoCombinable;
};

const corto = (s: string) => s.replace(/^Obra\s+/i, "").replace(/\s+\d+.*$/, "").replace(/\s+(Country Club|Connect)$/i, "").trim() || s;
const que = (d: string) => {
  const t = d.split(/[,(·]/)[0].trim().replace(/^Ver lista adjunta.*/i, "material");
  return (t.charAt(0).toLowerCase() + t.slice(1)).replace(/\s+\d+\s*(bolsas|barras|u|unidades)$/i, "");
};
const kg = (n: number | null) => (n ? (n >= 1000 ? `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(n / 1000)} tn` : `${n} kg`) : null);
/** "del corralón", "del galpón", "de la obra". */
function delLugar(tipo: LugarParada, nombre: string) {
  if (tipo === "PROVEEDOR_SUCURSAL") return /corral[oó]n/i.test(nombre) ? "del corralón" : "del proveedor";
  if (tipo === "DEPOSITO") return /terreno/i.test(nombre) ? "del terreno" : "del depósito";
  if (tipo === "BASE") return "de la base";
  return `de ${nombre}`;
}

const mismoLugar = (a: PedidoCombinable["origen"], b: PedidoCombinable["origen"]) =>
  a.id && b.id && a.tipo === b.tipo ? a.id === b.id : distancia(a.punto, b.punto) <= R.radioMismoLugarM;

export const esPersonas = (t: TipoPedido) => t === "TRASLADO_PERSONAS";
export const esEscombros = (t: TipoPedido) => t === "RETIRO_ESCOMBROS";

/** Desvío de pasar por x entre a y b (metros extra). */
const desvio = (a: Punto, b: Punto, x: Punto, d: (p: Punto, q: Punto) => number) => d(a, x) + d(x, b) - d(a, b);

export function sugerir(base: PedidoCombinable[], candidatos: PedidoCombinable[], o: { dia: string; dist?: (a: Punto, b: Punto) => number }): Sugerencia[] {
  const d = o.dist ?? ((a: Punto, b: Punto) => distancia(a, b) * 1.3);
  const retiros = base.filter((p) => !p.sinRetiro).map((p) => p.origen);
  const paradas = [...retiros.map((r) => ({ punto: r.punto, nombre: r.nombre, tipo: r.tipo })), ...base.map((p) => ({ punto: p.destino.punto, nombre: p.destino.nombre, tipo: "OBRA" as LugarParada }))];
  // Recorrido base aproximado: retiros y después entregas (para medir el desvío).
  const camino = paradas.map((p) => p.punto);
  const hayPersonas = base.some((p) => esPersonas(p.tipo));
  const hayEscombros = base.some((p) => esEscombros(p.tipo));

  const out: Sugerencia[] = [];
  for (const c of candidatos) {
    if (base.some((b) => b.id === c.id)) continue;
    const dia = diaISO(c.paraCuando);
    const gris = dia > o.dia
      ? `es para el ${diaSemana(c.paraCuando)}`
      : (hayPersonas && esEscombros(c.tipo)) || (hayEscombros && esPersonas(c.tipo))
        ? "no se combinan personas con escombros"
        : null;
    const detalle = [c.oc, kg(c.pesoKg)].filter(Boolean).join(", ");

    const igual = !c.sinRetiro ? retiros.find((r) => mismoLugar(r, c.origen)) : undefined;
    if (igual) {
      out.push({ id: c.id, grupo: "mismoLugar", lugar: igual.nombre.split(" · ")[0], distanciaM: 0, gris, pedido: c, texto: `${que(c.descripcion)} para ${corto(c.destino.obra)}${detalle ? ` (${detalle})` : ""}` });
      continue;
    }
    // Cerca: el origen a menos de radioCercaM de alguna parada (es lo que importa: pasar a buscarlo);
    // si no, el destino (lo deja de paso).
    // Para un retiro, la referencia son primero los otros retiros ("a 1,2 km del corralón").
    const masCerca = (x: Punto, entre: typeof paradas) =>
      entre.reduce<{ m: number; de: (typeof paradas)[number] } | null>((mejor, pa) => {
        const m = distancia(x, pa.punto);
        return m <= R.radioCercaM && (!mejor || m < mejor.m) ? { m, de: pa } : mejor;
      }, null);
    const deRetiros = paradas.slice(0, retiros.length);
    const cerca = (!c.sinRetiro ? masCerca(c.origen.punto, deRetiros) ?? masCerca(c.origen.punto, paradas) : null) ?? masCerca(c.destino.punto, paradas);
    // …o el desvío para pasar a buscarlo es chico.
    let desvioM = Infinity;
    if (!cerca && camino.length >= 2 && !c.sinRetiro) {
      for (let i = 0; i < camino.length - 1; i++) desvioM = Math.min(desvioM, desvio(camino[i], camino[i + 1], c.origen.punto, d));
    }
    if (!cerca && desvioM > R.desvioMaximoM) continue;
    const verbo = c.tipo === "TRASLADO_MAQUINARIA" || c.tipo === "LLEVAR_A_OBRA" ? "retirar" : c.tipo === "TRASLADO_PERSONAS" ? "buscar a" : "retirar";
    const accion = c.sinRetiro ? `llevar ${que(c.descripcion)} a ${corto(c.destino.obra)}` : `${verbo} ${que(c.descripcion)} en ${c.origen.nombre.split(" · ")[0]} para ${corto(c.destino.obra)}`;
    const mismaObra = base.some((b) => distancia(b.destino.punto, c.destino.punto) <= R.radioMismoLugarM) ? " (va a la misma obra)" : "";
    const texto = (cerca ? `A ${metros(cerca.m)} ${delLugar(cerca.de.tipo, cerca.de.nombre)}: ${accion}` : `Desvío de ${metros(desvioM)}: ${accion}`) + mismaObra;
    out.push({ id: c.id, grupo: "cerca", lugar: cerca?.de.nombre ?? "", distanciaM: Math.round(cerca?.m ?? desvioM), gris, pedido: c, texto });
  }
  return out.sort((a, b) => (a.grupo === b.grupo ? a.distanciaM - b.distanciaM : a.grupo === "mismoLugar" ? -1 : 1));
}

/** Validación de una combinación (al elegir vehículo y en el servidor al confirmar). */
export function validarCombinacion(pedidos: Pick<PedidoCombinable, "tipo" | "pesoKg">[], vehiculo: { nombre: string; capacidadCargaKg: number } | null, paradas: number): string | null {
  if (pedidos.some((p) => esPersonas(p.tipo)) && pedidos.some((p) => esEscombros(p.tipo))) return "No se combinan personas con escombros.";
  if (paradas > R.maxParadasPorViaje) return `Son ${paradas} paradas y el máximo por viaje es ${R.maxParadasPorViaje}. Sacá alguno.`;
  const peso = pedidos.reduce((s, p) => s + (p.pesoKg ?? 0), 0);
  if (vehiculo && peso > vehiculo.capacidadCargaKg) {
    const f = (n: number) => new Intl.NumberFormat("es-AR").format(n);
    return `Son ${f(peso)} kg y ${vehiculo.nombre} carga ${f(vehiculo.capacidadCargaKg)} kg. Sacá alguno o elegí otro vehículo.`;
  }
  return null;
}
