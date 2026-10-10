import type { LugarParada, OrigenTipo, Prisma, PrismaClient, TipoParada } from "@prisma/client";
import { distancia, type Punto } from "@/lib/geo";
import { PARAMETROS_RUTEO } from "./parametros";
import { cancelarRecordatorios, programarRecordatorios } from "./recordatorios-agenda";

type Cliente = Prisma.TransactionClient | PrismaClient;

/**
 * VIAJES CON PARADAS. Un viaje es una lista ordenada de paradas (RETIRO o ENTREGA), cada una con
 * los pedidos que atiende y su lista de verificación (ItemParada). Un pedido simple = 2 paradas.
 *
 * armarParadas es pura: agrupa en UNA parada de retiro los pedidos que salen del mismo lugar (misma
 * sucursal, depósito u obra, o a menos de radioMismoLugarM) y en UNA de entrega los que van al mismo
 * destino. El orden lo decide después el optimizador (o, sin él, primero los retiros y después las entregas).
 */

/** Lo que hace falta de cada pedido para armar sus paradas. */
export type PedidoParaParadas = {
  id: string;
  origenTipo: OrigenTipo;
  origenId: string;
  origenNombre: string;
  origenDireccion: string;
  origenLat: number;
  origenLng: number;
  obraId: string;
  destinoSedeId: string | null;
  destinoNombre: string;
  destinoDireccion: string;
  destinoLat: number;
  destinoLng: number;
  obraNombre: string;
  descripcion: string;
  /** Renglones habilitados por Compras (material): cada uno es un ítem de la lista de verificación. */
  renglones?: { descripcion: string; cantidad?: number | null; unidad?: string | null; ordenCompraNumero?: string | null }[];
  /** Sin retiro: lo que lleva ya está arriba (sale de la base) → solo entrega. */
  sinRetiro?: boolean;
};

export type ItemArmado = { pedidoViajeId: string; descripcion: string; cantidad: number | null; unidad: string | null; ordenCompraNumero: string | null; obraNombre: string };

export type ParadaArmada = {
  clave: string;
  tipo: TipoParada;
  lugarTipo: LugarParada;
  lugarId: string | null;
  nombre: string;
  direccion: string;
  latitud: number;
  longitud: number;
  items: ItemArmado[];
  pedidos: string[];
};

export type Armado = {
  paradas: ParadaArmada[];
  /** Para cada pedido: su parada de retiro (o null) y la de entrega, por clave. */
  asignaciones: { pedidoViajeId: string; retiro: string | null; entrega: string }[];
};

const LUGAR_ORIGEN: Record<OrigenTipo, LugarParada> = { PROVEEDOR: "PROVEEDOR_SUCURSAL", DEPOSITO: "DEPOSITO", OBRA: "OBRA", BASE: "BASE" };

/** Los ítems de un pedido para la lista de verificación: los renglones de Compras o la descripción. */
export function itemsDe(p: PedidoParaParadas): ItemArmado[] {
  const base = { pedidoViajeId: p.id, obraNombre: p.obraNombre };
  if (p.renglones?.length) {
    return p.renglones.map((r) => ({ ...base, descripcion: r.descripcion, cantidad: r.cantidad ?? null, unidad: r.unidad ?? null, ordenCompraNumero: r.ordenCompraNumero ?? null }));
  }
  return [{ ...base, descripcion: p.descripcion, cantidad: null, unidad: null, ordenCompraNumero: null }];
}

/** ¿Esta parada es el mismo lugar? Mismo tipo y mismo id, o (si no hay id) a menos de radioMismoLugarM. */
function mismoLugar(a: { lugarTipo: LugarParada; lugarId: string | null; latitud: number; longitud: number }, b: typeof a) {
  if (a.lugarId && b.lugarId) return a.lugarTipo === b.lugarTipo && a.lugarId === b.lugarId;
  return distancia({ lat: a.latitud, lng: a.longitud }, { lat: b.latitud, lng: b.longitud }) <= PARAMETROS_RUTEO.radioMismoLugarM;
}

export function armarParadas(pedidos: PedidoParaParadas[]): Armado {
  const retiros: ParadaArmada[] = [];
  const entregas: ParadaArmada[] = [];
  const asignaciones: Armado["asignaciones"] = [];

  const ubicar = (lista: ParadaArmada[], tipo: TipoParada, nueva: Omit<ParadaArmada, "clave" | "tipo" | "items" | "pedidos">, p: PedidoParaParadas) => {
    let x = lista.find((y) => mismoLugar(y, nueva));
    if (!x) {
      x = { ...nueva, clave: `${tipo === "RETIRO" ? "R" : "E"}${lista.length + 1}`, tipo, items: [], pedidos: [] };
      lista.push(x);
    }
    x.items.push(...itemsDe(p));
    x.pedidos.push(p.id);
    return x.clave;
  };

  for (const p of pedidos) {
    const retiro = p.sinRetiro
      ? null
      : ubicar(retiros, "RETIRO", { lugarTipo: LUGAR_ORIGEN[p.origenTipo], lugarId: p.origenId, nombre: p.origenNombre, direccion: p.origenDireccion, latitud: p.origenLat, longitud: p.origenLng }, p);
    const entrega = ubicar(
      entregas,
      "ENTREGA",
      { lugarTipo: p.destinoSedeId ? "OBRA_SEDE" : "OBRA", lugarId: p.destinoSedeId ?? p.obraId, nombre: p.destinoNombre, direccion: p.destinoDireccion, latitud: p.destinoLat, longitud: p.destinoLng },
      p,
    );
    asignaciones.push({ pedidoViajeId: p.id, retiro, entrega });
  }
  return { paradas: [...retiros, ...entregas], asignaciones };
}

/** Lo que trae un pedido de la base para armar sus paradas (con los renglones de lo habilitado por Compras). */
export const selectPedidoParadas = {
  id: true, origenTipo: true, origenId: true, origenNombre: true, origenDireccion: true, origenLat: true, origenLng: true,
  obraId: true, destinoSedeId: true, destinoNombre: true, destinoDireccion: true, destinoLat: true, destinoLng: true, descripcion: true,
  obra: { select: { nombre: true } },
  materialesListos: { select: { renglones: true, descripcion: true, ordenCompraNumero: true } },
} satisfies Prisma.PedidoViajeSelect;

type RenglonJson = { descripcion?: string; cantidad?: number | string | null; unidad?: string | null };

export function aPedidoParaParadas(p: Prisma.PedidoViajeGetPayload<{ select: typeof selectPedidoParadas }>, sinRetiro = false): PedidoParaParadas {
  const renglones = p.materialesListos.flatMap((m) => {
    const lista = Array.isArray(m.renglones) ? (m.renglones as RenglonJson[]) : [];
    if (!lista.length) return [{ descripcion: m.descripcion, cantidad: null, unidad: null, ordenCompraNumero: m.ordenCompraNumero }];
    return lista.map((r) => ({ descripcion: r.descripcion ?? m.descripcion, cantidad: r.cantidad == null ? null : Number(r.cantidad), unidad: r.unidad ?? null, ordenCompraNumero: m.ordenCompraNumero }));
  });
  return { ...p, obraNombre: p.obra.nombre, renglones, sinRetiro: sinRetiro || p.origenTipo === "BASE" };
}

/**
 * Guarda las paradas de un viaje (borrador: se reemplazan enteras) en el orden dado, con sus
 * ítems y un ViajePedido por pedido. Devuelve los ids de parada por clave.
 */
export async function guardarParadas(tx: Prisma.TransactionClient, viajeId: string, armado: Armado, orden?: string[], tramos?: Record<string, { distanciaM: number; duracionS: number | null }>) {
  const claves = orden ?? armado.paradas.map((p) => p.clave);
  await tx.itemParada.deleteMany({ where: { parada: { viajeId } } });
  await tx.viajePedido.deleteMany({ where: { viajeId } });
  await tx.viajeParada.deleteMany({ where: { viajeId } });
  const ids = new Map<string, string>();
  for (const [i, clave] of claves.entries()) {
    const p = armado.paradas.find((x) => x.clave === clave)!;
    const t = tramos?.[clave];
    const creada = await tx.viajeParada.create({
      data: {
        viajeId, orden: i + 1, tipo: p.tipo, lugarTipo: p.lugarTipo, lugarId: p.lugarId, nombre: p.nombre, direccion: p.direccion,
        latitud: p.latitud, longitud: p.longitud, distanciaDesdeAnteriorM: t?.distanciaM ?? null, duracionDesdeAnteriorS: t?.duracionS ?? null,
      },
      select: { id: true },
    });
    ids.set(clave, creada.id);
    if (p.items.length) {
      await tx.itemParada.createMany({
        data: p.items.map((it) => ({ paradaId: creada.id, pedidoViajeId: it.pedidoViajeId, descripcion: it.descripcion, cantidad: it.cantidad, unidad: it.unidad, ordenCompraNumero: it.ordenCompraNumero, obraNombre: it.obraNombre })),
      });
    }
  }
  for (const [k, a] of armado.asignaciones.entries()) {
    await tx.viajePedido.create({
      data: { viajeId, pedidoViajeId: a.pedidoViajeId, paradaRetiroId: a.retiro ? ids.get(a.retiro)! : null, paradaEntregaId: ids.get(a.entrega)!, orden: k + 1 },
    });
  }
  if (tramos) {
    const total = Object.values(tramos).reduce((s, t) => s + (t.distanciaM ?? 0), 0);
    await tx.viaje.update({ where: { id: viajeId }, data: { distanciaTotalM: total } });
  }
  return ids;
}

/** Arma y guarda las paradas de un viaje a partir de sus pedidos (en el orden de los pedidos). */
export async function rearmarParadas(tx: Prisma.TransactionClient, viajeId: string, pedidoIds: string[], sinRetiro = false) {
  const pedidos = await tx.pedidoViaje.findMany({ where: { id: { in: pedidoIds } }, select: selectPedidoParadas });
  const ordenados = pedidoIds.map((id) => pedidos.find((p) => p.id === id)!).filter(Boolean);
  const armado = armarParadas(ordenados.map((p) => aPedidoParaParadas(p, sinRetiro)));
  await guardarParadas(tx, viajeId, armado);
  return armado;
}

/** El viaje que lleva ahora a un pedido (por el puntero del pedido). */
export async function viajeDe<I extends Prisma.ViajeInclude>(cliente: Cliente, pedidoId: string, include: I) {
  return cliente.viaje.findFirst({ where: { pedidos: { some: { id: pedidoId } } }, include }) as Promise<Prisma.ViajeGetPayload<{ include: I }> | null>;
}

export const puntoDe = (p: { latitud: number; longitud: number }): Punto => ({ lat: p.latitud, lng: p.longitud });

/** Crea un viaje PROGRAMADO con estos pedidos (el primero es el principal), sus paradas y el puntero de cada pedido. */
export async function crearViaje(tx: Prisma.TransactionClient, d: { pedidoIds: string[]; vehiculoId: string; choferId: string; salidaEstimada: Date | null; ordenRuta: number | null }) {
  const v = await tx.viaje.create({
    data: { pedidoId: d.pedidoIds[0], vehiculoId: d.vehiculoId, choferId: d.choferId, etapa: "PROGRAMADO", estado: "PROGRAMADO", salidaEstimada: d.salidaEstimada, ordenRuta: d.ordenRuta },
    select: { id: true },
  });
  await tx.pedidoViaje.updateMany({ where: { id: { in: d.pedidoIds } }, data: { viajeId: v.id } });
  await rearmarParadas(tx, v.id, d.pedidoIds);
  // Recordatorios del chofer: 18:00 del día anterior, 7:00 del día y "Todavía no iniciaste".
  await programarRecordatorios(tx, d.pedidoIds, { choferId: d.choferId });
  return v.id;
}

/**
 * Saca un pedido de su viaje (lo soltaron o se canceló). Si el viaje lleva otros pedidos, se rearman sus
 * paradas sin él y el principal pasa al siguiente; si era el único, el viaje queda CANCELADO.
 * conservarPuntero: el pedido sigue apuntando al viaje cancelado (para poder deshacer la cancelación).
 */
export async function quitarDelViaje(tx: Prisma.TransactionClient, pedidoId: string, conservarPuntero = false) {
  const p = await tx.pedidoViaje.findUnique({ where: { id: pedidoId }, select: { viajeId: true } });
  await cancelarRecordatorios(tx, [pedidoId]);
  if (!p?.viajeId) return null;
  const v = await tx.viaje.findUniqueOrThrow({ where: { id: p.viajeId }, select: { id: true, estado: true, vehiculoId: true, salidaEstimada: true, pedidos: { select: { id: true } }, viajePedidos: { orderBy: { orden: "asc" }, select: { pedidoViajeId: true } } } });
  const otros = v.viajePedidos.map((x) => x.pedidoViajeId).filter((id) => id !== pedidoId && v.pedidos.some((q) => q.id === id));
  if (otros.length && v.estado === "PROGRAMADO") {
    await tx.pedidoViaje.update({ where: { id: pedidoId }, data: { viajeId: null } });
    await tx.viaje.update({ where: { id: v.id }, data: { pedidoId: otros[0] } });
    await rearmarParadas(tx, v.id, otros);
  } else {
    if (v.estado === "PROGRAMADO") await tx.viaje.update({ where: { id: v.id }, data: { estado: "CANCELADO", ordenRuta: null } });
    if (!conservarPuntero) await tx.pedidoViaje.update({ where: { id: pedidoId }, data: { viajeId: null } });
  }
  return v;
}
