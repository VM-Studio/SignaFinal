import { db } from "@/lib/db";
import { aFecha, cuando, diaISO, sumarDias } from "@/lib/formato";
import { parecido, UMBRAL_PARECIDO } from "@/lib/pedidos/similitud";
import type { AlertaCalculada, Regla } from "../tipos";

const HORA = 3_600_000;

/** Pedido urgente sin tomar hace más de 2 horas (crítica). */
async function urgenteSinTomar(): Promise<AlertaCalculada[]> {
  const p = await db.pedidoViaje.findMany({
    where: { estado: "PENDIENTE", prioridad: "URGENTE", creadoEn: { lt: new Date(Date.now() - 2 * HORA) } },
    include: { obra: { select: { nombre: true } }, solicitante: { select: { nombre: true } } },
  });
  return p.map((x) => ({
    claveUnica: `URGENTE_SIN_TOMAR:${x.id}`, regla: "URGENTE_SIN_TOMAR", severidad: "CRITICA",
    titulo: `Urgente sin tomar: ${x.descripcion}`,
    detalle: `Para Obra ${x.obra.nombre}. Lo pidió ${x.solicitante.nombre} ${cuando(x.creadoEn)} y nadie lo tomó.`,
    entidadTipo: "PedidoViaje", entidadId: x.id, enlace: `/pedidos/${x.id}`, obraId: x.obraId,
  }));
}

/** Pedido para hoy que a las 7:30 todavía no tomó nadie (aviso). */
async function pendienteDeHoy(): Promise<AlertaCalculada[]> {
  const hoy = diaISO();
  if (new Date() < aFecha(hoy, "07:30")) return [];
  const p = await db.pedidoViaje.findMany({
    where: { estado: "PENDIENTE", prioridad: "NORMAL", paraCuando: { gte: aFecha(hoy), lt: aFecha(sumarDias(hoy, 1)) } },
    include: { obra: { select: { nombre: true } } },
  });
  return p.map((x) => ({
    claveUnica: `PENDIENTE_HOY:${x.id}`, regla: "PENDIENTE_HOY", severidad: "AVISO",
    titulo: `Para hoy y sin chofer: ${x.descripcion}`, detalle: `Obra ${x.obra.nombre}. Son más de las 7:30 y sigue pendiente.`,
    entidadTipo: "PedidoViaje", entidadId: x.id, enlace: `/pedidos/${x.id}`, obraId: x.obraId,
  }));
}

/** Dos pedidos muy parecidos para la misma obra en 48 h (aviso, con enlace a ambos). */
async function duplicados(): Promise<AlertaCalculada[]> {
  const p = await db.pedidoViaje.findMany({
    where: { estado: { in: ["PENDIENTE", "TOMADO"] }, creadoEn: { gte: new Date(Date.now() - 48 * HORA) } },
    orderBy: { creadoEn: "asc" },
    include: { obra: { select: { nombre: true } }, solicitante: { select: { nombre: true } } },
  });
  const out: AlertaCalculada[] = [];
  for (let i = 0; i < p.length; i++) {
    for (let j = i + 1; j < p.length; j++) {
      const [a, b] = [p[i], p[j]];
      if (a.obraId !== b.obraId || a.tipo !== b.tipo) continue;
      if (Math.abs(a.creadoEn.getTime() - b.creadoEn.getTime()) > 48 * HORA) continue;
      const iguales = (a.proveedorId && a.proveedorId === b.proveedorId) || (a.herramientaId && a.herramientaId === b.herramientaId) || parecido(a.descripcion, b.descripcion) >= UMBRAL_PARECIDO;
      if (!iguales) continue;
      out.push({
        claveUnica: `DUPLICADO:${a.id}:${b.id}`, regla: "DUPLICADO", severidad: "AVISO",
        titulo: `¿Pedido repetido para Obra ${a.obra.nombre}?`,
        detalle: `Pedido ${a.numero} de ${a.solicitante.nombre} y pedido ${b.numero} de ${b.solicitante.nombre} parecen lo mismo: “${a.descripcion}”.`,
        entidadTipo: "PedidoViaje", entidadId: `${a.id},${b.id}`, enlace: `/pedidos/${a.id}`, obraId: a.obraId,
      });
    }
  }
  return out;
}

/** Viaje en curso hace más de 10 horas (aviso). */
async function viajeLargo(): Promise<AlertaCalculada[]> {
  const v = await db.viaje.findMany({
    where: { estado: "EN_CURSO", salidaReal: { lt: new Date(Date.now() - 10 * HORA) } },
    include: { chofer: { select: { id: true, nombre: true } }, vehiculo: { select: { nombre: true } }, pedido: { select: { id: true, obraId: true, obra: { select: { nombre: true } } } } },
  });
  return v.map((x) => ({
    claveUnica: `VIAJE_LARGO:${x.id}`, regla: "VIAJE_LARGO", severidad: "AVISO",
    titulo: `${x.chofer.nombre} lleva más de 10 h en viaje`, detalle: `Salió ${cuando(x.salidaReal)} con ${x.vehiculo.nombre} hacia Obra ${x.pedido.obra.nombre} y no marcó la llegada.`,
    entidadTipo: "Viaje", entidadId: x.id, enlace: `/pedidos/${x.pedido.id}`, obraId: x.pedido.obraId, usuarioId: x.chofer.id,
  }));
}

export const REGLAS_PEDIDOS: Regla[] = [
  { nombre: "URGENTE_SIN_TOMAR", modulo: "pedidos", evaluar: urgenteSinTomar },
  { nombre: "PENDIENTE_HOY", modulo: "pedidos", evaluar: pendienteDeHoy },
  { nombre: "DUPLICADO", modulo: "pedidos", evaluar: duplicados },
  { nombre: "VIAJE_LARGO", modulo: "pedidos", evaluar: viajeLargo },
];
