import "server-only";
import type { LugarParada, OrigenTipo, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { UsuarioSesion } from "@/lib/auth/sesion";
import { conAlcance } from "@/lib/alcance";
import { diaISO, finDelDia, sumarDias, aFecha } from "@/lib/formato";
import { distancia, type Punto } from "@/lib/geo";
import { matrizDistancias } from "@/lib/rutas";
import { optimizarOrden, ordenValido, type Precedencia } from "./optimizar";
import { sugerir, type PedidoCombinable, type Sugerencia } from "./sugerencias";
import { baseDe } from "./tramos";

/**
 * VIAJES COMBINADOS (servidor): sugerencias al aceptar ("Aprovechá el viaje"), orden estratégico de las
 * paradas y reorden manual. Lo puro está en sugerencias.ts y optimizar.ts.
 */

const LUGAR: Record<OrigenTipo, LugarParada> = { PROVEEDOR: "PROVEEDOR_SUCURSAL", DEPOSITO: "DEPOSITO", OBRA: "OBRA", BASE: "BASE" };
const hecha = (p: { estado: string }) => p.estado === "COMPLETADA" || p.estado === "SALTEADA";
const punto = (p: { latitud: number; longitud: number }): Punto => ({ lat: p.latitud, lng: p.longitud });

export const seleccionCombinable = {
  id: true, numero: true, tipo: true, descripcion: true, pesoKg: true, paraCuando: true, origenTipo: true, origenId: true, sucursalId: true,
  origenNombre: true, origenLat: true, origenLng: true, destinoNombre: true, destinoLat: true, destinoLng: true, estado: true, tomadoPorId: true,
  obra: { select: { nombre: true } },
  solicitante: { select: { nombre: true } },
  materialesListos: { where: { estado: { not: "CANCELADO" } }, select: { ordenCompraNumero: true } },
  viaje: { select: { id: true, estado: true, _count: { select: { pedidos: true } } } },
} satisfies Prisma.PedidoViajeSelect;
type FilaCombinable = Prisma.PedidoViajeGetPayload<{ select: typeof seleccionCombinable }>;

export function aCombinable(p: FilaCombinable, propio = false): PedidoCombinable {
  const oc = [...new Set(p.materialesListos.map((m) => m.ordenCompraNumero).filter(Boolean))].join(", ") || null;
  return {
    id: p.id, numero: p.numero, tipo: p.tipo, descripcion: p.descripcion, pesoKg: p.pesoKg, paraCuando: p.paraCuando, solicitante: p.solicitante.nombre, oc,
    origen: { tipo: LUGAR[p.origenTipo], id: p.sucursalId ?? p.origenId, nombre: p.origenNombre, punto: { lat: p.origenLat, lng: p.origenLng } },
    sinRetiro: p.origenTipo === "BASE",
    destino: { nombre: p.destinoNombre, obra: p.obra.nombre, punto: { lat: p.destinoLat, lng: p.destinoLng } },
    propio,
  };
}

export type SugerenciaPlana = Omit<Sugerencia, "pedido"> & {
  pedido: { id: string; numero: number; tipo: PedidoCombinable["tipo"]; pesoKg: number | null; paraCuando: string; solicitante: string; oc: string | null; obra: string; propio: boolean };
};

/**
 * Sugerencias para combinar con estos pedidos (el que acepta y, si ya hay viaje, los que lleva): pendientes
 * de cualquiera y los propios del mismo día sin iniciar. Los de los próximos 7 días aparecen en gris.
 */
export async function sugerenciasPara(u: Pick<UsuarioSesion, "id" | "rol">, pedidoIds: string[]): Promise<{ dia: string; sugerencias: SugerenciaPlana[] }> {
  const base = await db.pedidoViaje.findMany({ where: { id: { in: pedidoIds } }, select: seleccionCombinable });
  if (!base.length) return { dia: diaISO(), sugerencias: [] };
  const dia = [diaISO(), ...base.map((p) => diaISO(p.paraCuando))].sort().pop()!;
  const hasta = finDelDia(aFecha(sumarDias(dia, 7), "12:00"));
  const [pendientes, propios] = await Promise.all([
    db.pedidoViaje.findMany({ where: conAlcance(u, { estado: "PENDIENTE", id: { notIn: pedidoIds }, paraCuando: { lte: hasta } }), select: seleccionCombinable, take: 60, orderBy: { paraCuando: "asc" } }),
    db.pedidoViaje.findMany({
      where: conAlcance(u, { estado: "TOMADO", tomadoPorId: u.id, id: { notIn: pedidoIds }, paraCuando: { lte: finDelDia(aFecha(dia, "12:00")) }, viaje: { estado: "PROGRAMADO" } }),
      select: seleccionCombinable, take: 20,
    }),
  ]);
  const candidatos = [...pendientes.map((p) => aCombinable(p)), ...propios.filter((p) => !base.some((b) => b.viaje?.id && b.viaje.id === p.viaje?.id)).map((p) => aCombinable(p, true))];
  // Distancias por calle (OSRM table con caché) si son pocos puntos; si no, línea recta × 1,3.
  const bases = base.map((p) => aCombinable(p));
  const puntos = [...bases.flatMap((b) => [b.origen.punto, b.destino.punto]), ...candidatos.map((c) => c.origen.punto)];
  const m = await matrizDistancias(puntos);
  const clave = (p: Punto) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
  const idx = new Map(puntos.map((p, i) => [clave(p), i]));
  const dist = (a: Punto, b: Punto) => {
    const i = idx.get(clave(a));
    const j = idx.get(clave(b));
    return i != null && j != null ? m[i][j] : distancia(a, b) * 1.3;
  };
  const sugerencias = sugerir(bases, candidatos, { dia, dist });
  return {
    dia,
    sugerencias: sugerencias.map((s) => ({
      ...s,
      pedido: { id: s.pedido.id, numero: s.pedido.numero, tipo: s.pedido.tipo, pesoKg: s.pedido.pesoKg, paraCuando: s.pedido.paraCuando.toISOString(), solicitante: s.pedido.solicitante, oc: s.pedido.oc, obra: s.pedido.destino.obra, propio: !!s.pedido.propio },
    })),
  };
}

// ─────────────────────────────── Orden ───────────────────────────────

async function cargarParadas(viajeId: string) {
  return db.viaje.findUnique({
    where: { id: viajeId },
    include: { paradas: { orderBy: { orden: "asc" } }, viajePedidos: { select: { paradaRetiroId: true, paradaEntregaId: true } }, vehiculo: { select: { baseId: true, ultimaLat: true, ultimaLng: true, ultimaFechaGps: true } } },
  });
}
const precedencias = (vps: { paradaRetiroId: string | null; paradaEntregaId: string }[]): Precedencia[] =>
  vps.filter((x) => x.paradaRetiroId).map((x) => [x.paradaRetiroId!, x.paradaEntregaId]);

/** Desde dónde se mide: la posición del vehículo si el viaje está en curso; si no, su base. */
async function partida(v: NonNullable<Awaited<ReturnType<typeof cargarParadas>>>): Promise<Punto | null> {
  const vh = v.vehiculo;
  if (v.estado === "EN_CURSO" && vh.ultimaLat != null && vh.ultimaLng != null) return { lat: vh.ultimaLat, lng: vh.ultimaLng };
  return baseDe(vh);
}

/** Guarda un orden (lo hecho y la actual, adelante) con la distancia de cada tramo y el total del viaje. */
async function guardarOrden(v: NonNullable<Awaited<ReturnType<typeof cargarParadas>>>, orden: string[], m: number[][], tramosDesde: number) {
  const indice = new Map(v.paradas.map((p, i) => [p.id, i + 1]));
  let total = 0;
  await db.$transaction(async (tx) => {
    for (const [k, id] of orden.entries()) {
      const previo = k === 0 ? 0 : indice.get(orden[k - 1])!;
      const tramo = Math.round(m[previo][indice.get(id)!]);
      total += tramo;
      // Los tramos ya recorridos no se recalculan.
      await tx.viajeParada.update({ where: { id }, data: { orden: k + 1, ...(k >= tramosDesde ? { distanciaDesdeAnteriorM: tramo } : {}) } });
    }
    await tx.viaje.update({ where: { id: v.id }, data: { distanciaTotalM: total } });
  });
  return total;
}

/**
 * Orden estratégico (optimizar.ts): vecino más cercano con precedencia + 2-opt, desde el vehículo (o su
 * base). Lo hecho y la parada donde está quedan fijos. Nunca empeora el orden que ya tenía.
 */
export async function planificarOrden(viajeId: string) {
  const v = await cargarParadas(viajeId);
  if (!v || v.estado === "FINALIZADO" || v.estado === "CANCELADO" || !v.paradas.length) return null;
  const desde = (await partida(v)) ?? punto(v.paradas[0]);
  const m = await matrizDistancias([desde, ...v.paradas.map(punto)]);
  const fijas = v.paradas.filter((p) => hecha(p) || p.estado === "LLEGO").map((p) => p.id);
  const r = optimizarOrden(v.paradas.map((p) => p.id), precedencias(v.viajePedidos), m, { fijas, actual: v.paradas.map((p) => p.id) });
  const total = await guardarOrden(v, r.orden, m, v.estado === "EN_CURSO" ? fijas.length : 0);
  return { orden: r.orden, totalM: total };
}

/**
 * Reorden del chofer ("Reordenar"): él conoce la zona. Se valida igual: lo hecho no se mueve y cada
 * entrega va después de su retiro.
 */
export async function reordenar(viajeId: string, orden: string[]): Promise<string | null> {
  const v = await cargarParadas(viajeId);
  if (!v || v.estado === "FINALIZADO" || v.estado === "CANCELADO") return "El viaje ya terminó.";
  const ids = v.paradas.map((p) => p.id);
  if (orden.length !== ids.length || !ids.every((id) => orden.includes(id))) return "El orden no coincide con las paradas del viaje.";
  const fijas = v.paradas.filter((p) => hecha(p) || p.estado === "LLEGO").map((p) => p.id);
  if (fijas.some((id, i) => orden[i] !== id)) return "Las paradas ya hechas (y donde estás ahora) no se pueden mover.";
  if (!ordenValido(orden, precedencias(v.viajePedidos))) return "Cada entrega tiene que ir después de su retiro.";
  const desde = (await partida(v)) ?? punto(v.paradas[0]);
  const m = await matrizDistancias([desde, ...v.paradas.map(punto)]);
  await guardarOrden(v, orden, m, v.estado === "EN_CURSO" ? fijas.length : 0);
  return null;
}
