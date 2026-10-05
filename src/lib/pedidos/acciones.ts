"use server";

import { revalidatePath } from "next/cache";
import { reevaluar } from "@/lib/alertas/reevaluar";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso, exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { aFecha, diaISO, hora } from "@/lib/formato";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { auditar, buscarDuplicado, choferesQueLoVen, describirPedido, necesitaCamion, validarChoferYVehiculo, type Duplicado } from "./reglas";
import { resolverPuntos } from "./puntos";
import { esObraDelUsuario } from "@/lib/alcance";
import { conEtapa } from "@/lib/viajes/etapas";
import { FRANJA } from "./presentacion";

/** Refresca pantallas y reevalúa las alertas del módulo (resuelve solas las que ya no aplican). */
const refrescar = () => {
  revalidatePath("/", "layout");
  reevaluar("pedidos");
};
const vacio = (v: unknown) => (v === "" || v === null ? undefined : v);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// ═══════════════════════════════ Pedir ═══════════════════════════════

const esquemaPedido = z
  .object({
    tipo: z.enum(["RETIRO_PROVEEDOR", "TRASLADO_MAQUINARIA", "TRASLADO_HERRAMIENTAS", "LLEVAR_A_OBRA", "RETIRO_ESCOMBROS", "TRASLADO_PERSONAS"], { error: "Elegí qué hay que hacer." }),
    obraId: z.string().min(1, "Elegí la obra."),
    origenTipo: z.enum(["BASE", "PROVEEDOR", "DEPOSITO", "OBRA"], { error: "Elegí desde dónde." }),
    origenId: z.string().min(1, "Elegí desde dónde."),
    ordenCompraLebane: z.preprocess(vacio, z.string().trim().max(40).optional()),
    descripcion: z.string().trim().min(3, "Contá qué hay que llevar.").max(240),
    pesoKg: z.preprocess(vacio, z.coerce.number().int().positive().max(30_000).optional()),
    cantidadPersonas: z.preprocess(vacio, z.coerce.number().int().min(1).max(30).optional()),
    dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí el día."),
    franja: z.enum(["MANANA", "TARDE", "HORA_EXACTA"]),
    hora: z.preprocess(vacio, z.string().regex(HHMM, "Revisá la hora.").optional()),
    prioridad: z.enum(["NORMAL", "URGENTE"]),
    forzar: z.boolean().default(false), // "No, es otro pedido"
    clientId: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().uuid().optional()), // pedido hecho sin señal
  })
  .superRefine((d, ctx) => {
    if (d.tipo === "RETIRO_PROVEEDOR" && d.origenTipo !== "PROVEEDOR") ctx.addIssue({ code: "custom", message: "Elegí el proveedor." });
    if (d.tipo === "TRASLADO_PERSONAS" && !d.cantidadPersonas) ctx.addIssue({ code: "custom", message: "¿Cuántas personas?" });
    if (d.franja === "HORA_EXACTA" && !d.hora) ctx.addIssue({ code: "custom", message: "Poné la hora." });
    if (d.origenTipo === "OBRA" && d.origenId === d.obraId && d.tipo !== "RETIRO_ESCOMBROS") {
      ctx.addIssue({ code: "custom", message: "El origen y el destino son la misma obra." });
    }
  });

export type DatosPedido = z.input<typeof esquemaPedido>;

export type RespuestaPedido =
  | { estado: "creado"; id: string; numero: number; choferes: string[] }
  | { estado: "duplicado"; existente: Duplicado };

export async function crearPedido(entrada: DatosPedido): Promise<Resultado<RespuestaPedido>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("pedidos.crear");
    const d = esquemaPedido.parse(entrada);

    // Idempotente: si el teléfono reenvía el pedido que guardó sin señal, no se duplica.
    if (d.clientId) {
      const ya = await db.pedidoViaje.findUnique({ where: { clientId: d.clientId }, select: { id: true, numero: true, necesitaCamion: true } });
      if (ya) return { estado: "creado", id: ya.id, numero: ya.numero, choferes: await choferesQueLoVen(ya.necesitaCamion) } as const;
    }

    const obra = await db.obra.findUnique({ where: { id: d.obraId }, select: { id: true, nombre: true, estado: true } });
    if (!obra || obra.estado !== "ACTIVA") throw new ErrorNegocio("Esa obra no está activa.");
    if (!(await esObraDelUsuario(yo, obra.id))) throw new ErrorNegocio(`No sos responsable de Obra ${obra.nombre}.`);

    // De dónde sale y a dónde va, resuelto una sola vez (el origen tiene que existir y ser del tipo que dice).
    const puntos = await resolverPuntos(db, { origenTipo: d.origenTipo, origenId: d.origenId, obraId: obra.id });

    // Peso: tiene que haber un vehículo de la cola que lo pueda llevar.
    if (d.pesoKg) {
      const max = (await db.vehiculo.aggregate({ where: { activo: true, entraEnCola: true }, _max: { capacidadCargaKg: true } }))._max.capacidadCargaKg ?? 0;
      if (d.pesoKg > max) throw new ErrorNegocio(`Ningún vehículo carga más de ${max.toLocaleString("es-AR")} kg. Partilo en dos pedidos.`);
    }

    // Para cuándo, en hora argentina. Nunca en el pasado.
    const horaElegida = d.franja === "HORA_EXACTA" ? d.hora! : FRANJA[d.franja].hora;
    const paraCuando = aFecha(d.dia, horaElegida);
    if (d.dia < diaISO()) throw new ErrorNegocio("El día ya pasó. Elegí hoy o una fecha futura.");

    const proveedorId = d.origenTipo === "PROVEEDOR" ? d.origenId : null;

    // Lo que más valor tiene: no duplicar pedidos.
    if (!d.forzar) {
      const existente = await buscarDuplicado({ obraId: d.obraId, tipo: d.tipo, proveedorId, descripcion: d.descripcion });
      if (existente) return { estado: "duplicado", existente } as const;
    }

    const camion = necesitaCamion(d.tipo, d.pesoKg);
    const pedido = await db.$transaction(async (tx) => {
      const p = await tx.pedidoViaje.create({
        data: {
          clientId: d.clientId ?? null,
          solicitanteId: yo.id,
          obraId: d.obraId,
          tipo: d.tipo,
          origenTipo: d.origenTipo,
          origenId: d.origenId,
          ...puntos,
          proveedorId,
          ordenCompraLebane: d.ordenCompraLebane ?? null,
          descripcion: d.descripcion,
          pesoKg: d.pesoKg ?? null,
          cantidadPersonas: d.tipo === "TRASLADO_PERSONAS" ? d.cantidadPersonas ?? null : null,
          necesitaCamion: camion,
          paraCuando,
          franja: d.franja,
          prioridad: d.prioridad,
        },
        select: { id: true, numero: true },
      });
      await auditar(tx, {
        usuarioId: yo.id, accion: d.forzar ? "pedido.crear.noEraDuplicado" : "pedido.crear", entidadId: p.id,
        resumen: `${yo.nombre} pidió ${d.descripcion} para Obra ${obra.nombre}${d.prioridad === "URGENTE" ? " (urgente)" : ""}${d.forzar ? ", aunque se parecía a otro pedido" : ""}`,
        despues: { estado: "PENDIENTE", tipo: d.tipo, obra: obra.nombre },
      });
      return p;
    });

    refrescar();
    return { estado: "creado", id: pedido.id, numero: pedido.numero, choferes: await choferesQueLoVen(camion) } as const;
  });
}

/** "Deshacer" justo después de pedir: queda cancelado (nada se borra). */
export async function deshacerPedido(pedidoId: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("pedidos.crear");
    const r = await db.pedidoViaje.updateMany({
      where: { id: pedidoId, solicitanteId: yo.id, estado: "PENDIENTE", creadoEn: { gte: new Date(Date.now() - 2 * 60_000) } },
      data: { estado: "CANCELADO", motivoCancelacion: "Se deshizo al pedirlo", canceladoEn: new Date() },
    });
    if (!r.count) throw new ErrorNegocio("Ya no se puede deshacer.");
    await auditar(db, { usuarioId: yo.id, accion: "pedido.deshacer", entidadId: pedidoId, resumen: `${yo.nombre} deshizo ${await describirPedido(db, pedidoId)}`, antes: { estado: "PENDIENTE" }, despues: { estado: "CANCELADO" } });
    refrescar();
    return null;
  });
}

// ═══════════════════════════════ Tomar ═══════════════════════════════

const esquemaTomar = z.object({
  pedidoId: z.string().min(1),
  vehiculoId: z.string().min(1, "Elegí el vehículo."),
  salida: z.string().regex(HHMM, "Poné la hora de salida."),
});

export type DatosTomar = z.input<typeof esquemaTomar>;

/** Día en que sale: el del pedido, o hoy si el pedido era para antes. */
function salidaPara(paraCuando: Date, hhmm: string) {
  const diaPedido = diaISO(paraCuando);
  const hoy = diaISO();
  return aFecha(diaPedido < hoy ? hoy : diaPedido, hhmm);
}

async function siguienteEnRuta(tx: Prisma.TransactionClient, choferId: string) {
  const max = await tx.viaje.aggregate({ where: { choferId, estado: "PROGRAMADO" }, _max: { ordenRuta: true } });
  return (max._max.ordenRuta ?? 0) + 1;
}

export async function tomarPedido(entrada: DatosTomar): Promise<Resultado<{ numero: number; vehiculo: string; salida: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("pedidos.tomar");
    const d = esquemaTomar.parse(entrada);

    const r = await db.$transaction(async (tx) => {
      const pedido = await tx.pedidoViaje.findUnique({ where: { id: d.pedidoId } });
      if (!pedido) throw new ErrorNegocio("No existe ese pedido.");
      const { vehiculo } = await validarChoferYVehiculo(tx, yo.id, d.vehiculoId, pedido);

      // Cerrojo: solo uno lo toma. El segundo ve quién se le adelantó.
      const tomado = await tx.pedidoViaje.updateMany({
        where: { id: d.pedidoId, estado: "PENDIENTE" },
        data: { estado: "TOMADO", tomadoPorId: yo.id, tomadoEn: new Date() },
      });
      if (!tomado.count) {
        const actual = await tx.pedidoViaje.findUniqueOrThrow({ where: { id: d.pedidoId }, select: { estado: true, tomadoPorId: true, tomadoPor: { select: { nombre: true } } } });
        if (actual.tomadoPorId === yo.id) throw new ErrorNegocio("Ya lo aceptaste vos.");
        if (actual.estado === "CANCELADO") throw new ErrorNegocio("Este pedido fue cancelado.");
        throw new ErrorNegocio(`Ya lo aceptó ${actual.tomadoPor?.nombre ?? "otro chofer"}.`);
      }

      const salidaEstimada = salidaPara(pedido.paraCuando, d.salida);
      const viaje = { vehiculoId: vehiculo.id, choferId: yo.id, ...conEtapa("PROGRAMADO"), salidaEstimada, ordenRuta: await siguienteEnRuta(tx, yo.id) };
      await tx.viaje.upsert({ where: { pedidoId: pedido.id }, create: { pedidoId: pedido.id, ...viaje }, update: viaje });
      await auditar(tx, {
        usuarioId: yo.id, accion: "pedido.tomar", entidadId: pedido.id,
        resumen: `${yo.nombre} aceptó ${await describirPedido(tx, pedido.id)} con ${vehiculo.nombre}`,
        antes: { estado: "PENDIENTE" }, despues: { estado: "TOMADO", chofer: yo.nombre, vehiculo: vehiculo.nombre, salida: salidaEstimada.toISOString() },
      });
      return { numero: pedido.numero, vehiculo: vehiculo.nombre, salida: hora(salidaEstimada) };
    });

    refrescar();
    return r;
  });
}

/** Soltar: vuelve a la cola. El viaje programado queda registrado como cancelado. */
export async function soltarPedido(pedidoId: string): Promise<Resultado<{ vehiculoId: string; salida: string } | null>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("pedidos.tomar");
    const r = await db.$transaction(async (tx) => {
      const soltado = await tx.pedidoViaje.updateMany({
        where: { id: pedidoId, estado: "TOMADO", tomadoPorId: yo.id },
        data: { estado: "PENDIENTE", tomadoPorId: null, tomadoEn: null },
      });
      if (!soltado.count) throw new ErrorNegocio("Ya no se puede soltar: el viaje empezó o el pedido cambió.");
      const viaje = await tx.viaje.findUnique({ where: { pedidoId } });
      if (viaje) await tx.viaje.update({ where: { pedidoId }, data: { estado: "CANCELADO", ordenRuta: null } });
      await auditar(tx, { usuarioId: yo.id, accion: "pedido.soltar", entidadId: pedidoId, resumen: `${yo.nombre} soltó ${await describirPedido(tx, pedidoId)}: vuelve a las solicitudes`, antes: { estado: "TOMADO", chofer: yo.nombre }, despues: { estado: "PENDIENTE" } });
      // Para poder deshacer: con qué vehículo y a qué hora iba a salir.
      return viaje ? { vehiculoId: viaje.vehiculoId, salida: viaje.salidaEstimada ? hora(viaje.salidaEstimada) : "08:00" } : null;
    });
    refrescar();
    return r;
  });
}

// ═══════════════════════════ Cancelar ═══════════════════════════

export async function cancelarPedido(pedidoId: string, motivo: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    const m = motivo.trim();
    if (m.length < 3) throw new ErrorNegocio("Contá por qué se cancela.");
    const pedido = await db.pedidoViaje.findUnique({ where: { id: pedidoId }, select: { estado: true, solicitanteId: true, tomadoPor: { select: { nombre: true } } } });
    if (!pedido) throw new ErrorNegocio("No existe ese pedido.");

    const cualquiera = puede(yo.rol, "pedidos.cancelarCualquiera");
    const propio = pedido.solicitanteId === yo.id && puede(yo.rol, "pedidos.cancelarPropios");
    if (!cualquiera && !propio) throw new ErrorNegocio("Solo quien lo pidió puede cancelarlo.");
    const estados = cualquiera ? (["PENDIENTE", "TOMADO"] as const) : (["PENDIENTE"] as const);
    if (!(estados as readonly string[]).includes(pedido.estado)) {
      throw new ErrorNegocio(pedido.estado === "TOMADO" ? `Ya lo tomó ${pedido.tomadoPor?.nombre}. Hablá con él para cancelarlo.` : "Este pedido ya no se puede cancelar.");
    }

    await db.$transaction(async (tx) => {
      const r = await tx.pedidoViaje.updateMany({
        where: { id: pedidoId, estado: { in: [...estados] } },
        data: { estado: "CANCELADO", motivoCancelacion: m, canceladoEn: new Date() },
      });
      if (!r.count) throw new ErrorNegocio("El pedido cambió mientras lo cancelabas.");
      await tx.viaje.updateMany({ where: { pedidoId, estado: "PROGRAMADO" }, data: { estado: "CANCELADO", ordenRuta: null } });
      await auditar(tx, { usuarioId: yo.id, accion: "pedido.cancelar", entidadId: pedidoId, resumen: `${yo.nombre} canceló ${await describirPedido(tx, pedidoId)}: ${m}`, antes: { estado: pedido.estado }, despues: { estado: "CANCELADO", motivo: m } });
    });
    refrescar();
    return null;
  });
}

/** Deshacer una cancelación (10 segundos en pantalla; 2 minutos de margen en el servidor). */
export async function deshacerCancelacion(pedidoId: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    const ultima = await db.auditoria.findFirst({ where: { entidad: "PedidoViaje", entidadId: pedidoId, accion: "pedido.cancelar" }, orderBy: { fecha: "desc" } });
    const p = await db.pedidoViaje.findUnique({ where: { id: pedidoId }, select: { estado: true, canceladoEn: true, tomadoPorId: true } });
    if (!p || p.estado !== "CANCELADO" || !ultima || ultima.usuarioId !== yo.id || !p.canceladoEn || Date.now() - p.canceladoEn.getTime() > 120_000) {
      throw new ErrorNegocio("Ya no se puede deshacer.");
    }
    const vuelveA = (ultima.antes as { estado?: string } | null)?.estado === "TOMADO" && p.tomadoPorId ? "TOMADO" : "PENDIENTE";
    await db.$transaction(async (tx) => {
      await tx.pedidoViaje.update({
        where: { id: pedidoId },
        data: { estado: vuelveA, motivoCancelacion: null, canceladoEn: null, ...(vuelveA === "PENDIENTE" ? { tomadoPorId: null, tomadoEn: null } : {}) },
      });
      if (vuelveA === "TOMADO") await tx.viaje.updateMany({ where: { pedidoId, estado: "CANCELADO" }, data: conEtapa("PROGRAMADO") });
      await auditar(tx, { usuarioId: yo.id, accion: "pedido.deshacerCancelacion", entidadId: pedidoId, resumen: `${yo.nombre} deshizo la cancelación de ${await describirPedido(tx, pedidoId)}`, antes: { estado: "CANCELADO" }, despues: { estado: vuelveA } });
    });
    refrescar();
    return null;
  });
}

// ═══════════════════════════ Reasignar (dirección) ═══════════════════════════

const esquemaReasignar = esquemaTomar.extend({ choferId: z.string().min(1, "Elegí el chofer.") });
export type DatosReasignar = z.input<typeof esquemaReasignar>;

export async function reasignarPedido(entrada: DatosReasignar): Promise<Resultado<{ chofer: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("pedidos.reasignar");
    const d = esquemaReasignar.parse(entrada);
    const r = await db.$transaction(async (tx) => {
      const pedido = await tx.pedidoViaje.findUnique({ where: { id: d.pedidoId }, include: { tomadoPor: { select: { nombre: true } } } });
      if (!pedido || !["PENDIENTE", "TOMADO"].includes(pedido.estado)) throw new ErrorNegocio("Solo se reasignan pedidos pendientes o tomados.");
      const { chofer, vehiculo } = await validarChoferYVehiculo(tx, d.choferId, d.vehiculoId, pedido);

      const cambio = await tx.pedidoViaje.updateMany({
        where: { id: pedido.id, estado: pedido.estado, tomadoPorId: pedido.tomadoPorId },
        data: { estado: "TOMADO", tomadoPorId: d.choferId, tomadoEn: new Date() },
      });
      if (!cambio.count) throw new ErrorNegocio("El pedido cambió mientras lo reasignabas. Probá de nuevo.");
      const salidaEstimada = salidaPara(pedido.paraCuando, d.salida);
      const viaje = { vehiculoId: vehiculo.id, choferId: d.choferId, ...conEtapa("PROGRAMADO"), salidaEstimada, ordenRuta: await siguienteEnRuta(tx, d.choferId) };
      await tx.viaje.upsert({ where: { pedidoId: pedido.id }, create: { pedidoId: pedido.id, ...viaje }, update: viaje });
      await auditar(tx, {
        usuarioId: yo.id, accion: "pedido.reasignar", entidadId: pedido.id,
        resumen: `${yo.nombre} le pasó ${await describirPedido(tx, pedido.id)} a ${chofer.nombre}${pedido.tomadoPor ? ` (lo tenía ${pedido.tomadoPor.nombre})` : ""}`,
        antes: { estado: pedido.estado, chofer: pedido.tomadoPor?.nombre ?? null }, despues: { estado: "TOMADO", chofer: chofer.nombre, vehiculo: vehiculo.nombre },
      });
      return { chofer: chofer.nombre };
    });
    refrescar();
    return r;
  });
}

// ═══════════════════════════ Ruta del día ═══════════════════════════

/** Sube o baja un viaje programado en la ruta del chofer. */
export async function moverEnRuta(viajeId: string, sentido: "arriba" | "abajo"): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("pedidos.tomar");
    await db.$transaction(async (tx) => {
      const ruta = await tx.viaje.findMany({
        where: { choferId: yo.id, estado: "PROGRAMADO" },
        orderBy: [{ ordenRuta: { sort: "asc", nulls: "last" } }, { salidaEstimada: "asc" }],
        select: { id: true },
      });
      const i = ruta.findIndex((v) => v.id === viajeId);
      if (i < 0) throw new ErrorNegocio("Ese viaje no está en tu ruta.");
      const j = sentido === "arriba" ? i - 1 : i + 1;
      if (j < 0 || j >= ruta.length) return;
      [ruta[i], ruta[j]] = [ruta[j], ruta[i]];
      for (const [k, v] of ruta.entries()) await tx.viaje.update({ where: { id: v.id }, data: { ordenRuta: k + 1 } });
      const movido = await tx.viaje.findUniqueOrThrow({ where: { id: viajeId }, select: { pedidoId: true } });
      await auditar(tx, {
        usuarioId: yo.id, accion: "ruta.mover", entidadId: movido.pedidoId,
        resumen: `${yo.nombre} ${sentido === "arriba" ? "adelantó" : "atrasó"} en su ruta ${await describirPedido(tx, movido.pedidoId)}`,
      });
    });
    refrescar();
    return null;
  });
}

