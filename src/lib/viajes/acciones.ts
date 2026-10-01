"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { auditar, validarChoferYVehiculo } from "@/lib/pedidos/reglas";
import { guardarArchivo } from "@/lib/archivos";
import { km as fmtKm } from "@/lib/formato";

const refrescar = () => revalidatePath("/", "layout");
const vacio = (v: unknown) => (v === "" || v === null ? undefined : v);

/** Hora real del evento: la del teléfono si se guardó sin señal (nunca en el futuro). */
function momento(ocurridoEn: Date | undefined, noAntesDe?: Date | null) {
  const ahora = new Date();
  if (!ocurridoEn || ocurridoEn > ahora) return ahora;
  if (noAntesDe && ocurridoEn < noAntesDe) return noAntesDe;
  return ocurridoEn;
}

// ═══════════════════════════ Iniciar ═══════════════════════════

const esquemaInicio = z.object({
  clientId: z.string().uuid(),
  pedidoId: z.string().min(1),
  kmSalida: z.coerce.number({ error: "Poné los km del tablero." }).int("Los km van sin decimales.").min(0),
  ocurridoEn: z.coerce.date().optional(),
});
export type DatosInicio = z.input<typeof esquemaInicio>;

export async function iniciarViaje(entrada: DatosInicio): Promise<Resultado<{ vehiculo: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("viajes.ejecutar");
    const d = esquemaInicio.parse(entrada);

    // Idempotente: si el teléfono lo reenvía, no pasa nada.
    const ya = await db.viaje.findUnique({ where: { clientIdInicio: d.clientId }, select: { vehiculo: { select: { nombre: true } } } });
    if (ya) return { vehiculo: ya.vehiculo.nombre };

    const r = await db.$transaction(async (tx) => {
      const viaje = await tx.viaje.findUnique({ where: { pedidoId: d.pedidoId }, include: { pedido: true } });
      if (!viaje || viaje.pedido.tomadoPorId !== yo.id || viaje.pedido.estado !== "TOMADO" || viaje.estado !== "PROGRAMADO") {
        throw new ErrorNegocio("Este viaje no está listo para salir.");
      }
      const enCurso = await tx.viaje.findFirst({ where: { estado: "EN_CURSO", OR: [{ choferId: yo.id }, { vehiculoId: viaje.vehiculoId }] }, select: { choferId: true } });
      if (enCurso) throw new ErrorNegocio(enCurso.choferId === yo.id ? "Ya tenés un viaje en curso. Terminalo antes de salir de nuevo." : "Ese vehículo está en otro viaje.");

      const { vehiculo } = await validarChoferYVehiculo(tx, yo.id, viaje.vehiculoId, viaje.pedido);
      if (d.kmSalida < vehiculo.kmActual) throw new ErrorNegocio(`${vehiculo.nombre} tiene registrados ${fmtKm(vehiculo.kmActual)}. Los km de salida no pueden ser menos.`);
      if (d.kmSalida > vehiculo.kmActual + 3000) throw new ErrorNegocio(`Son ${fmtKm(d.kmSalida - vehiculo.kmActual)} más que los registrados. Revisá el número.`);

      const salidaReal = momento(d.ocurridoEn);
      await tx.viaje.update({ where: { id: viaje.id }, data: { estado: "EN_CURSO", salidaReal, kmSalida: d.kmSalida, clientIdInicio: d.clientId } });
      await tx.pedidoViaje.update({ where: { id: d.pedidoId }, data: { estado: "EN_VIAJE" } });
      await tx.vehiculo.update({ where: { id: vehiculo.id }, data: { estado: "EN_VIAJE", kmActual: d.kmSalida } });
      await auditar(tx, { usuarioId: yo.id, accion: "viaje.iniciar", entidadId: d.pedidoId, antes: { estado: "TOMADO" }, despues: { estado: "EN_VIAJE", kmSalida: d.kmSalida, vehiculo: vehiculo.nombre } });
      return { vehiculo: vehiculo.nombre };
    });
    refrescar();
    return r;
  });
}

// ═══════════════════════════ Finalizar ═══════════════════════════

const esquemaFin = z.object({
  clientId: z.string().uuid(),
  pedidoId: z.string().min(1),
  kmLlegada: z.coerce.number({ error: "Poné los km del tablero." }).int("Los km van sin decimales.").min(0),
  peajes: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().min(0, "Los peajes no pueden ser negativos.").max(1_000_000)),
  observaciones: z.preprocess(vacio, z.string().trim().max(500).optional()),
  foto: z.preprocess(vacio, z.string().optional()), // data URL del remito
  ocurridoEn: z.coerce.date().optional(),
});
export type DatosFin = z.input<typeof esquemaFin>;

export type ResultadoFin = {
  km: number;
  costo: number;
  obra: string;
  siguiente: { pedidoId: string; descripcion: string; obra: string } | null;
};

export async function finalizarViaje(entrada: DatosFin): Promise<Resultado<ResultadoFin>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("viajes.ejecutar");
    const d = esquemaFin.parse(entrada);

    const r = await db.$transaction(async (tx) => {
      const viaje = await tx.viaje.findUnique({ where: { pedidoId: d.pedidoId }, include: { vehiculo: true, pedido: { include: { obra: true } } } });
      if (!viaje) throw new ErrorNegocio("No existe ese viaje.");
      if (viaje.choferId !== yo.id) throw new ErrorNegocio("Este viaje no es tuyo.");

      // Reenvío del mismo cierre (sin señal): devolver lo ya calculado.
      if (viaje.clientIdFin === d.clientId) {
        return { km: (viaje.kmLlegada ?? 0) - (viaje.kmSalida ?? 0), costo: Number(viaje.costoCalculado ?? 0), obra: viaje.pedido.obra.nombre, siguiente: null };
      }
      if (viaje.estado !== "EN_CURSO") throw new ErrorNegocio(viaje.estado === "FINALIZADO" ? "Este viaje ya terminó." : "Este viaje todavía no salió.");
      const kmSalida = viaje.kmSalida ?? viaje.vehiculo.kmActual;
      if (d.kmLlegada < kmSalida) throw new ErrorNegocio(`Los km de llegada no pueden ser menores que los de salida (${fmtKm(kmSalida)}).`);
      const recorridos = d.kmLlegada - kmSalida;
      if (recorridos > 2000) throw new ErrorNegocio("Son más de 2.000 km en un viaje. Revisá el número.");

      // costo = km recorridos × costoKm del vehículo + peajes
      const peajes = new Prisma.Decimal(d.peajes);
      const costo = viaje.vehiculo.costoKm.mul(recorridos).add(peajes);
      const remitoUrl = d.foto ? await guardarArchivo(tx, d.foto, yo.id, `remito-pedido-${viaje.pedido.numero}`) : null;

      await tx.viaje.update({
        where: { id: viaje.id },
        data: {
          estado: "FINALIZADO", llegadaReal: momento(d.ocurridoEn, viaje.salidaReal), kmLlegada: d.kmLlegada, peajes, costoCalculado: costo,
          remitoUrl, observaciones: d.observaciones ?? null, clientIdFin: d.clientId,
        },
      });
      await tx.pedidoViaje.update({ where: { id: d.pedidoId }, data: { estado: "ENTREGADO" } });
      await tx.vehiculo.update({
        where: { id: viaje.vehiculoId },
        data: { kmActual: Math.max(viaje.vehiculo.kmActual, d.kmLlegada), ...(viaje.vehiculo.estado === "EN_VIAJE" ? { estado: "DISPONIBLE" } : {}) },
      });
      await auditar(tx, {
        usuarioId: yo.id, accion: "viaje.finalizar", entidadId: d.pedidoId,
        antes: { estado: "EN_VIAJE" }, despues: { estado: "ENTREGADO", kmLlegada: d.kmLlegada, km: recorridos, peajes: d.peajes, costo: costo.toString(), obra: viaje.pedido.obra.nombre },
      });

      // Lo que sigue en su ruta.
      const sig = await tx.viaje.findFirst({
        where: { choferId: yo.id, estado: "PROGRAMADO", pedido: { estado: "TOMADO" } },
        orderBy: [{ ordenRuta: { sort: "asc", nulls: "last" } }, { salidaEstimada: "asc" }],
        include: { pedido: { include: { obra: { select: { nombre: true } } } } },
      });
      return {
        km: recorridos,
        costo: costo.toNumber(),
        obra: viaje.pedido.obra.nombre,
        siguiente: sig ? { pedidoId: sig.pedidoId, descripcion: sig.pedido.descripcion, obra: sig.pedido.obra.nombre } : null,
      };
    });
    refrescar();
    return r;
  });
}

// ═══════════════════════════ Combustible ═══════════════════════════

const esquemaCarga = z.object({
  clientId: z.string().uuid(),
  vehiculoId: z.string().min(1, "Elegí el vehículo."),
  litros: z.coerce.number({ error: "Poné los litros." }).positive("Los litros tienen que ser más de cero.").max(600, "Revisá los litros."),
  monto: z.coerce.number({ error: "Poné cuánto pagaste." }).positive("Poné cuánto pagaste.").max(5_000_000),
  km: z.preprocess(vacio, z.coerce.number().int().min(0).optional()),
  foto: z.preprocess(vacio, z.string().optional()),
  ocurridoEn: z.coerce.date().optional(),
});
export type DatosCarga = z.input<typeof esquemaCarga>;

export async function registrarCarga(entrada: DatosCarga): Promise<Resultado<{ obra: string | null }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("combustible.cargar");
    const d = esquemaCarga.parse(entrada);
    const ya = await db.cargaCombustible.findUnique({ where: { clientId: d.clientId }, select: { obra: { select: { nombre: true } } } });
    if (ya) return { obra: ya.obra?.nombre ?? null };

    const r = await db.$transaction(async (tx) => {
      const v = await tx.vehiculo.findUnique({ where: { id: d.vehiculoId } });
      if (!v || !v.activo) throw new ErrorNegocio("Ese vehículo no está activo.");
      if (d.km != null && d.km < v.kmActual - 2000) throw new ErrorNegocio(`${v.nombre} tiene ${fmtKm(v.kmActual)}. Revisá el número.`);
      if (d.km != null && d.km > v.kmActual + 3000) throw new ErrorNegocio(`Son ${fmtKm(d.km - v.kmActual)} más que los registrados. Revisá el número.`);

      // Si el vehículo está en un viaje, la carga se imputa a esa obra.
      const enViaje = await tx.viaje.findFirst({ where: { vehiculoId: v.id, estado: "EN_CURSO" }, select: { pedido: { select: { obraId: true, obra: { select: { nombre: true } } } } } });
      const comprobanteUrl = d.foto ? await guardarArchivo(tx, d.foto, yo.id, `ticket-${v.patente}`) : null;
      const c = await tx.cargaCombustible.create({
        data: {
          clientId: d.clientId, vehiculoId: v.id, usuarioId: yo.id, fecha: momento(d.ocurridoEn),
          litros: new Prisma.Decimal(d.litros), monto: new Prisma.Decimal(d.monto), km: d.km ?? v.kmActual,
          comprobanteUrl, obraId: enViaje?.pedido.obraId ?? null,
        },
      });
      if (d.km != null && d.km > v.kmActual) await tx.vehiculo.update({ where: { id: v.id }, data: { kmActual: d.km } });
      await auditar(tx, { usuarioId: yo.id, accion: "combustible.cargar", entidad: "CargaCombustible", entidadId: c.id, despues: { vehiculo: v.nombre, litros: d.litros, monto: d.monto, obra: enViaje?.pedido.obra.nombre ?? null } });
      return { obra: enViaje?.pedido.obra.nombre ?? null };
    });
    refrescar();
    return r;
  });
}
