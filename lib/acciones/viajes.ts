"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { autorizar } from "@/lib/auth/usuario-actual";
import { auditar } from "@/lib/auditoria";
import { km as fmtKm, peso } from "@/lib/formato";
import { TIPO_VEHICULO } from "@/lib/etiquetas";
import { ejecutar, ErrorNegocio, type Resultado } from "./resultado";
import { despuesDeCambiar, licenciaVencida, problemasVehiculo } from "./comun";

const esquemaInicio = z.object({
  clientId: z.string().uuid(),
  pedidoId: z.string().min(1),
  vehiculoId: z.string().min(1, "Elegí el vehículo."),
  kmSalida: z.coerce.number({ error: "Poné los km del tablero." }).int("Los km van sin decimales.").min(0),
  ocurridoEn: z.coerce.date().optional(),
});

export type DatosInicioViaje = z.input<typeof esquemaInicio>;

export async function iniciarViaje(entrada: DatosInicioViaje): Promise<Resultado<{ viajeId: string }>> {
  return ejecutar(async () => {
    const yo = await autorizar("viajes.ejecutar");
    const d = esquemaInicio.parse(entrada);

    const repetido = await db.viaje.findUnique({ where: { clientIdInicio: d.clientId }, select: { id: true } });
    if (repetido) return { viajeId: repetido.id };

    const [chofer, pedido, vehiculo, enCurso] = await Promise.all([
      db.usuario.findUniqueOrThrow({ where: { id: yo.id }, select: { licenciaVence: true } }),
      db.pedidoViaje.findUnique({ where: { id: d.pedidoId }, select: { estado: true, choferId: true, obraId: true, pesoKg: true, vehiculoRequerido: true } }),
      db.vehiculo.findUnique({ where: { id: d.vehiculoId } }),
      db.viaje.findFirst({ where: { estado: "EN_VIAJE", OR: [{ choferId: yo.id }, { vehiculoId: d.vehiculoId }] }, select: { choferId: true } }),
    ]);

    if (!pedido) throw new ErrorNegocio("No existe ese pedido.");
    if (pedido.choferId !== yo.id) throw new ErrorNegocio("Este pedido no lo tomaste vos.");
    if (pedido.estado !== "TOMADO") throw new ErrorNegocio(pedido.estado === "EN_VIAJE" ? "Este viaje ya empezó." : "Este pedido ya no está para salir.");
    if (licenciaVencida(chofer.licenciaVence)) throw new ErrorNegocio("Tu licencia está vencida o sin cargar. No podés salir hasta actualizarla.");
    if (!vehiculo) throw new ErrorNegocio("No existe ese vehículo.");
    if (!vehiculo.disponibleParaPedidos || (vehiculo.asignadoAId && vehiculo.asignadoAId !== yo.id)) {
      throw new ErrorNegocio(`${vehiculo.nombre} no se usa para pedidos.`);
    }
    const problemas = problemasVehiculo(vehiculo);
    if (problemas.length) throw new ErrorNegocio(`No se puede usar ${vehiculo.nombre}: ${problemas.join(" y ")}.`);
    if (pedido.pesoKg && pedido.pesoKg > vehiculo.capacidadKg) {
      throw new ErrorNegocio(`${vehiculo.nombre} carga hasta ${peso(vehiculo.capacidadKg)} y el pedido pesa ${peso(pedido.pesoKg)}.`);
    }
    if (pedido.vehiculoRequerido !== "CUALQUIERA" && pedido.vehiculoRequerido !== vehiculo.tipo) {
      throw new ErrorNegocio(`Este pedido necesita ${TIPO_VEHICULO[pedido.vehiculoRequerido].toLowerCase()}.`);
    }
    if (enCurso) {
      throw new ErrorNegocio(enCurso.choferId === yo.id ? "Ya tenés un viaje en curso. Terminalo antes de salir de nuevo." : `${vehiculo.nombre} está en otro viaje.`);
    }
    if (d.kmSalida < vehiculo.kmActual) {
      throw new ErrorNegocio(`${vehiculo.nombre} tiene registrados ${fmtKm(vehiculo.kmActual)}. Los km de salida no pueden ser menos.`);
    }

    const viaje = await db.$transaction(async (tx) => {
      const v = await tx.viaje.create({
        data: {
          pedidoId: d.pedidoId,
          choferId: yo.id,
          vehiculoId: vehiculo.id,
          obraId: pedido.obraId,
          kmSalida: d.kmSalida,
          costoKmAplicado: vehiculo.costoKm,
          salidaEn: d.ocurridoEn && d.ocurridoEn <= new Date() ? d.ocurridoEn : new Date(),
          clientIdInicio: d.clientId,
        },
        select: { id: true },
      });
      const r = await tx.pedidoViaje.updateMany({
        where: { id: d.pedidoId, estado: "TOMADO", choferId: yo.id },
        data: { estado: "EN_VIAJE", vehiculoId: vehiculo.id },
      });
      if (r.count === 0) throw new ErrorNegocio("El pedido cambió mientras salías. Volvé a la cola.");
      await tx.vehiculo.update({ where: { id: vehiculo.id }, data: { kmActual: d.kmSalida } });
      await auditar(tx, { usuarioId: yo.id, accion: "viaje.iniciar", entidad: "Viaje", entidadId: v.id, detalle: { kmSalida: d.kmSalida } });
      return v;
    });

    despuesDeCambiar();
    return { viajeId: viaje.id };
  });
}

const esquemaFin = z.object({
  clientId: z.string().uuid(),
  pedidoId: z.string().min(1),
  kmLlegada: z.coerce.number({ error: "Poné los km del tablero." }).int("Los km van sin decimales.").min(0),
  peajes: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().min(0, "Los peajes no pueden ser negativos.")),
  observaciones: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(500).optional()),
  ocurridoEn: z.coerce.date().optional(),
});

export type DatosFinViaje = z.input<typeof esquemaFin>;

export async function finalizarViaje(entrada: DatosFinViaje): Promise<Resultado<{ costo: number; kmRecorridos: number }>> {
  return ejecutar(async () => {
    const yo = await autorizar("viajes.ejecutar");
    const d = esquemaFin.parse(entrada);

    const repetido = await db.viaje.findUnique({ where: { clientIdFin: d.clientId }, select: { costo: true, kmRecorridos: true } });
    if (repetido) return { costo: Number(repetido.costo ?? 0), kmRecorridos: repetido.kmRecorridos ?? 0 };

    // Se busca por pedido: así funciona aunque la salida se haya guardado sin señal.
    const viaje = await db.viaje.findUnique({ where: { pedidoId: d.pedidoId } });
    if (!viaje) throw new ErrorNegocio("Todavía no se registró la salida de este viaje.");
    if (viaje.choferId !== yo.id) throw new ErrorNegocio("Este viaje no es tuyo.");
    if (viaje.estado !== "EN_VIAJE") throw new ErrorNegocio("Este viaje ya terminó.");
    if (d.kmLlegada < viaje.kmSalida) {
      throw new ErrorNegocio(`Los km de llegada no pueden ser menores que los de salida (${fmtKm(viaje.kmSalida)}).`);
    }
    if (d.kmLlegada - viaje.kmSalida > 2000) throw new ErrorNegocio("Son más de 2.000 km en un viaje. Revisá el número.");

    const kmRecorridos = d.kmLlegada - viaje.kmSalida;
    const peajes = new Prisma.Decimal(d.peajes);
    const costo = viaje.costoKmAplicado.mul(kmRecorridos).add(peajes);
    const llegadaEn = d.ocurridoEn && d.ocurridoEn <= new Date() && d.ocurridoEn >= viaje.salidaEn ? d.ocurridoEn : new Date();

    await db.$transaction(async (tx) => {
      await tx.viaje.update({
        where: { id: viaje.id },
        data: { estado: "FINALIZADO", kmLlegada: d.kmLlegada, kmRecorridos, peajes, costo, llegadaEn, observaciones: d.observaciones ?? null, clientIdFin: d.clientId },
      });
      await tx.pedidoViaje.update({ where: { id: viaje.pedidoId }, data: { estado: "ENTREGADO" } });
      // kmActual nunca baja.
      await tx.vehiculo.updateMany({ where: { id: viaje.vehiculoId, kmActual: { lt: d.kmLlegada } }, data: { kmActual: d.kmLlegada } });
      await auditar(tx, {
        usuarioId: yo.id, accion: "viaje.finalizar", entidad: "Viaje", entidadId: viaje.id,
        detalle: { kmLlegada: d.kmLlegada, kmRecorridos, peajes: d.peajes, costo: costo.toString() },
      });
    });

    despuesDeCambiar();
    return { costo: costo.toNumber(), kmRecorridos };
  });
}
