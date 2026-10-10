"use server";

import { revalidar } from "@/lib/revalidar";
import { reevaluar } from "@/lib/alertas/reevaluar";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { guardarArchivo } from "@/lib/archivos";
import { aFecha, diaISO, elDiaALas, paraElDia, sumarDias } from "@/lib/formato";
import { choferesQueLoVen } from "@/lib/pedidos/reglas";
import { FRANJA } from "@/lib/pedidos/presentacion";
import { auditar, depositoCon, depositoId, moverUnitaria, restar, siguienteCodigo, stockEn, sumar, viajeQueLaLleva } from "./servicio";
import { auditar as auditarBase } from "@/lib/auditoria";
import { conAlcance, esObraDelUsuario } from "@/lib/alcance";
import { resolverPuntos } from "@/lib/pedidos/puntos";
import { avisarSolicitudNueva } from "@/lib/pedidos/avisos";
import { notificarEvento } from "@/lib/notificaciones/enviar";
import { EVENTO } from "@/lib/notificaciones/eventos";

/** Refresca pantallas y reevalúa las alertas del módulo (resuelve solas las que ya no aplican). */
const refrescar = () => {
  revalidar("herramientas", "pedidos");
  reevaluar("herramientas", "pedidos");
};
const vacio = (v: unknown) => (v === "" || v === null ? undefined : v);
const dia = z.preprocess(vacio, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Revisá la fecha.").optional());
const condicion = z.enum(["BUENA", "REGULAR", "MALA"]);
const cantidad = z.preprocess((v) => (v === "" || v == null ? 1 : v), z.coerce.number().int().min(1, "La cantidad tiene que ser al menos 1.").max(100_000));

async function obraActiva(id: string) {
  const o = await db.obra.findUnique({ where: { id }, select: { id: true, nombre: true, estado: true } });
  if (!o || o.estado !== "ACTIVA") throw new ErrorNegocio("Esa obra no está activa.");
  return o;
}

async function personaActiva(id: string) {
  const p = await db.usuario.findUnique({ where: { id }, select: { activo: true, nombre: true } });
  if (!p?.activo) throw new ErrorNegocio("Elegí quién la recibe.");
  return p;
}

function devolucionValida(d?: string) {
  if (!d) return null;
  if (d < diaISO()) throw new ErrorNegocio("La fecha de devolución ya pasó.");
  return aFecha(d, "12:00");
}

// ═══════════════════════════ Entregar ═══════════════════════════

const esquemaEntrega = z.object({
  herramientaId: z.string().min(1),
  obraId: z.string().min(1, "Elegí la obra."),
  recibidoPorId: z.string().min(1, "Elegí quién la recibe."),
  devolucionPrevista: dia,
  condicion: condicion.optional(),
  cantidad,
  viajeId: z.preprocess(vacio, z.string().optional()),
});
export type DatosEntrega = z.input<typeof esquemaEntrega>;

export async function entregar(entrada: DatosEntrega): Promise<Resultado<{ viaje: string | null }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("herramientas.mover");
    const d = esquemaEntrega.parse(entrada);
    const obra = await obraActiva(d.obraId);
    await personaActiva(d.recibidoPorId);
    const devolucion = devolucionValida(d.devolucionPrevista);

    const r = await db.$transaction(async (tx) => {
      const h = await tx.herramienta.findUniqueOrThrow({ where: { id: d.herramientaId }, select: { tipoControl: true, nombre: true, activo: true } });
      const dep = (await depositoCon(tx, d.herramientaId, d.cantidad)) ?? (await depositoId(tx));
      const viaje = d.viajeId ? { id: d.viajeId, chofer: null } : await viajeQueLaLleva(tx, d.herramientaId, obra.id);
      if (h.tipoControl === "CANTIDAD") {
        if (!h.activo) throw new ErrorNegocio("Está dada de baja.");
        await restar(tx, d.herramientaId, { ubicacionId: dep }, d.cantidad, "el depósito");
        await sumar(tx, d.herramientaId, { obraId: obra.id }, d.cantidad);
        const mov = await tx.movimientoHerramienta.create({
          data: { herramientaId: d.herramientaId, tipo: "ENTREGA", cantidad: d.cantidad, desdeUbicacionId: dep, haciaObraId: obra.id, registradoPorId: yo.id, recibidoPorId: d.recibidoPorId, viajeId: viaje?.id ?? null, condicion: d.condicion ?? null },
        });
        await auditar(tx, yo.id, "herramienta.entrega", d.herramientaId, `${yo.nombre} entregó ${d.cantidad} ${h.nombre.toLowerCase()} en Obra ${obra.nombre}`, undefined, { cantidad: d.cantidad, obra: obra.nombre, movimientoId: mov.id });
      } else {
        await moverUnitaria(tx, {
          usuarioId: yo.id, herramientaId: d.herramientaId, tipo: "ENTREGA", hacia: { obraId: obra.id },
          responsableId: d.recibidoPorId, recibidoPorId: d.recibidoPorId, devolucionPrevista: devolucion, condicion: d.condicion ?? null,
          viajeId: viaje?.id ?? null, estado: "EN_OBRA", desde: ["DISPONIBLE"],
        });
      }
      return { viaje: viaje?.chofer?.nombre ?? null };
    });
    refrescar();
    return r;
  });
}

// ═══════════════════════════ Devolver ═══════════════════════════

const esquemaDevolucion = z.object({
  herramientaId: z.string().min(1),
  condicion,
  desdeObraId: z.preprocess(vacio, z.string().optional()), // por cantidad
  cantidad,
  observaciones: z.preprocess(vacio, z.string().trim().max(300).optional()),
  aReparacion: z.boolean().default(false),
});
export type DatosDevolucion = z.input<typeof esquemaDevolucion>;

/** Devolución al depósito. En mala condición se ofrece mandarla directo a reparación. */
export async function devolver(entrada: DatosDevolucion): Promise<Resultado<{ ofrecerReparacion: boolean; enReparacion: boolean }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("herramientas.devolver");
    const d = esquemaDevolucion.parse(entrada);
    const h = await db.herramienta.findUniqueOrThrow({ where: { id: d.herramientaId }, select: { tipoControl: true, obraId: true, nombre: true } });
    const obraOrigen = h.tipoControl === "CANTIDAD" ? d.desdeObraId : h.obraId;
    if (!obraOrigen) throw new ErrorNegocio("No está en ninguna obra.");
    if (!(await esObraDelUsuario(yo, obraOrigen))) {
      const o = await db.obra.findUnique({ where: { id: obraOrigen }, select: { nombre: true } });
      throw new ErrorNegocio(`Solo un responsable de Obra ${o?.nombre} puede registrar esta devolución.`);
    }
    const aReparacion = d.aReparacion && d.condicion === "MALA" && h.tipoControl === "UNITARIA";

    await db.$transaction(async (tx) => {
      const dep = await depositoId(tx);
      if (h.tipoControl === "CANTIDAD") {
        const o = await tx.obra.findUniqueOrThrow({ where: { id: obraOrigen }, select: { nombre: true } });
        await restar(tx, d.herramientaId, { obraId: obraOrigen }, d.cantidad, `Obra ${o.nombre}`);
        await sumar(tx, d.herramientaId, { ubicacionId: dep }, d.cantidad);
        await tx.movimientoHerramienta.create({
          data: { herramientaId: d.herramientaId, tipo: "DEVOLUCION", cantidad: d.cantidad, desdeObraId: obraOrigen, haciaUbicacionId: dep, condicion: d.condicion, registradoPorId: yo.id, observaciones: d.observaciones ?? null },
        });
        await auditar(tx, yo.id, "herramienta.devolucion", d.herramientaId, `${yo.nombre} devolvió ${d.cantidad} ${h.nombre.toLowerCase()} de Obra ${o.nombre} al depósito`, undefined, { cantidad: d.cantidad, desde: o.nombre });
        return;
      }
      await moverUnitaria(tx, {
        usuarioId: yo.id, herramientaId: d.herramientaId, tipo: "DEVOLUCION", hacia: { ubicacionId: dep }, condicion: d.condicion,
        observaciones: d.observaciones ?? null, estado: "DISPONIBLE", desde: ["EN_OBRA"],
      });
      if (aReparacion) {
        await moverUnitaria(tx, {
          usuarioId: yo.id, herramientaId: d.herramientaId, tipo: "A_REPARACION", hacia: null, condicion: "MALA",
          observaciones: "Volvió de obra en mala condición.", estado: "EN_REPARACION", desde: ["DISPONIBLE"],
        });
      }
    });
    refrescar();
    return { ofrecerReparacion: d.condicion === "MALA" && !aReparacion && h.tipoControl === "UNITARIA", enReparacion: aReparacion };
  });
}

// ═══════════════════════════ Transferir ═══════════════════════════

const esquemaTransferencia = z.object({
  herramientaId: z.string().min(1),
  haciaObraId: z.string().min(1, "Elegí la obra."),
  recibidoPorId: z.string().min(1, "Elegí quién la recibe."),
  devolucionPrevista: dia,
  desdeObraId: z.preprocess(vacio, z.string().optional()),
  cantidad,
});
export type DatosTransferencia = z.input<typeof esquemaTransferencia>;

export async function transferir(entrada: DatosTransferencia): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("herramientas.mover");
    const d = esquemaTransferencia.parse(entrada);
    const obra = await obraActiva(d.haciaObraId);
    await personaActiva(d.recibidoPorId);
    const devolucion = devolucionValida(d.devolucionPrevista);
    await db.$transaction(async (tx) => {
      const h = await tx.herramienta.findUniqueOrThrow({ where: { id: d.herramientaId }, select: { tipoControl: true, nombre: true } });
      if (h.tipoControl === "CANTIDAD") {
        if (!d.desdeObraId || d.desdeObraId === obra.id) throw new ErrorNegocio("Elegí dos obras distintas.");
        const o = await tx.obra.findUniqueOrThrow({ where: { id: d.desdeObraId }, select: { nombre: true } });
        await restar(tx, d.herramientaId, { obraId: d.desdeObraId }, d.cantidad, `Obra ${o.nombre}`);
        await sumar(tx, d.herramientaId, { obraId: obra.id }, d.cantidad);
        await tx.movimientoHerramienta.create({
          data: { herramientaId: d.herramientaId, tipo: "TRANSFERENCIA", cantidad: d.cantidad, desdeObraId: d.desdeObraId, haciaObraId: obra.id, registradoPorId: yo.id, recibidoPorId: d.recibidoPorId },
        });
        await auditar(tx, yo.id, "herramienta.transferencia", d.herramientaId, `${yo.nombre} pasó ${d.cantidad} ${h.nombre.toLowerCase()} de Obra ${o.nombre} a Obra ${obra.nombre}`, undefined, { cantidad: d.cantidad, desde: o.nombre, hacia: obra.nombre });
        return;
      }
      const viaje = await viajeQueLaLleva(tx, d.herramientaId, obra.id);
      await moverUnitaria(tx, {
        usuarioId: yo.id, herramientaId: d.herramientaId, tipo: "TRANSFERENCIA", hacia: { obraId: obra.id }, responsableId: d.recibidoPorId,
        recibidoPorId: d.recibidoPorId, devolucionPrevista: devolucion, viajeId: viaje?.id ?? null, estado: "EN_OBRA", desde: ["EN_OBRA"],
      });
    });
    refrescar();
    return null;
  });
}

// ═══════════════════════════ Reparación, extravío y baja ═══════════════════════════

export async function enviarAReparacion(herramientaId: string, observaciones: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("herramientas.mantenimiento");
    await db.$transaction((tx) =>
      moverUnitaria(tx, {
        usuarioId: yo.id, herramientaId, tipo: "A_REPARACION", hacia: null, condicion: "MALA",
        observaciones: observaciones.trim() || null, estado: "EN_REPARACION", desde: ["DISPONIBLE", "EN_OBRA"],
      }),
    );
    refrescar();
    return null;
  });
}

const esquemaVuelta = z.object({
  herramientaId: z.string().min(1),
  condicion,
  descripcion: z.preprocess(vacio, z.string().trim().max(300).optional()),
  taller: z.preprocess(vacio, z.string().trim().max(80).optional()),
  costo: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().min(0)),
});

/** Volvió de reparación: queda disponible en el depósito; si hubo costo, se registra el mantenimiento. */
export async function volvioDeReparacion(entrada: z.input<typeof esquemaVuelta>): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("herramientas.mantenimiento");
    const d = esquemaVuelta.parse(entrada);
    await db.$transaction(async (tx) => {
      const dep = await depositoId(tx);
      const { herramienta } = await moverUnitaria(tx, {
        usuarioId: yo.id, herramientaId: d.herramientaId, tipo: "DE_REPARACION", hacia: { ubicacionId: dep }, condicion: d.condicion,
        observaciones: d.descripcion ?? null, estado: "DISPONIBLE", desde: ["EN_REPARACION"],
      });
      if (d.costo > 0 || d.descripcion) {
        const hoy = aFecha(diaISO(), "12:00");
        await tx.mantenimientoHerramienta.create({
          data: { herramientaId: d.herramientaId, fecha: hoy, descripcion: d.descripcion ?? "Reparación", taller: d.taller ?? null, costo: new Prisma.Decimal(d.costo), registradoPorId: yo.id },
        });
        if (herramienta.mantenimientoCadaDias) {
          await tx.herramienta.update({ where: { id: d.herramientaId }, data: { proximoMantenimiento: aFecha(sumarDias(diaISO(), herramienta.mantenimientoCadaDias), "12:00") } });
        }
      }
    });
    refrescar();
    return null;
  });
}

export async function marcarExtraviada(herramientaId: string, motivo: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("herramientas.mover");
    if (motivo.trim().length < 3) throw new ErrorNegocio("Contá qué pasó.");
    await db.$transaction((tx) =>
      moverUnitaria(tx, { usuarioId: yo.id, herramientaId, tipo: "EXTRAVIO", hacia: null, observaciones: motivo.trim(), estado: "EXTRAVIADA", desde: ["DISPONIBLE", "EN_OBRA"] }),
    );
    refrescar();
    return null;
  });
}

export async function reaparecio(herramientaId: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("herramientas.mover");
    await db.$transaction(async (tx) => {
      const dep = await depositoId(tx);
      await moverUnitaria(tx, { usuarioId: yo.id, herramientaId, tipo: "DEVOLUCION", hacia: { ubicacionId: dep }, observaciones: "Apareció y volvió al depósito.", estado: "DISPONIBLE", desde: ["EXTRAVIADA"] });
    });
    refrescar();
    return null;
  });
}

export async function darDeBaja(herramientaId: string, motivo: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("herramientas.editar");
    if (motivo.trim().length < 3) throw new ErrorNegocio("Contá por qué se da de baja.");
    await db.$transaction(async (tx) => {
      const h = await tx.herramienta.findUniqueOrThrow({ where: { id: herramientaId }, select: { tipoControl: true, nombre: true } });
      if (h.tipoControl === "UNITARIA") {
        await moverUnitaria(tx, { usuarioId: yo.id, herramientaId, tipo: "BAJA", hacia: null, observaciones: motivo.trim(), estado: "BAJA", desde: ["DISPONIBLE", "EN_REPARACION", "EXTRAVIADA"] });
        return;
      }
      const enObras = await tx.existenciaHerramienta.aggregate({ where: { herramientaId, obraId: { not: null } }, _sum: { cantidad: true } });
      if ((enObras._sum.cantidad ?? 0) > 0) throw new ErrorNegocio(`Todavía hay ${enObras._sum.cantidad} en obras. Que vuelvan antes de darlas de baja.`);
      // En cada depósito donde haya.
      const depositos = await tx.existenciaHerramienta.findMany({ where: { herramientaId, ubicacionId: { not: null }, cantidad: { gt: 0 } }, select: { ubicacionId: true } });
      let total = 0;
      for (const { ubicacionId } of depositos) {
        const dep = ubicacionId!;
        const enDep = await stockEn(tx, herramientaId, { ubicacionId: dep });
        total += enDep;
        await restar(tx, herramientaId, { ubicacionId: dep }, enDep, "el depósito");
        await tx.movimientoHerramienta.create({ data: { herramientaId, tipo: "BAJA", cantidad: enDep, desdeUbicacionId: dep, registradoPorId: yo.id, observaciones: motivo.trim() } });
      }
      await tx.herramienta.update({ where: { id: herramientaId }, data: { estado: "BAJA", activo: false } });
      await auditar(tx, yo.id, "herramienta.baja", herramientaId, `${yo.nombre} dio de baja ${h.nombre}: ${motivo.trim()}`, undefined, { motivo: motivo.trim(), cantidad: total });
    });
    refrescar();
    return null;
  });
}

// ═══════════════════════════ Mantenimiento ═══════════════════════════

const esquemaMant = z.object({
  herramientaId: z.string().min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Poné la fecha."),
  descripcion: z.string().trim().min(3, "Contá qué se hizo.").max(300),
  taller: z.preprocess(vacio, z.string().trim().max(80).optional()),
  costo: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().min(0)),
  cadaDias: z.preprocess(vacio, z.coerce.number().int().min(1).max(3650).optional()),
});
export type DatosMantHerramienta = z.input<typeof esquemaMant>;

/** Registrar mantenimiento: el próximo se calcula solo (fecha + cada cuántos días). */
export async function registrarMantenimiento(entrada: DatosMantHerramienta): Promise<Resultado<{ proximo: string | null }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("herramientas.mantenimiento");
    const d = esquemaMant.parse(entrada);
    if (d.fecha > diaISO()) throw new ErrorNegocio("La fecha no puede ser futura.");
    const r = await db.$transaction(async (tx) => {
      const h = await tx.herramienta.findUniqueOrThrow({ where: { id: d.herramientaId }, select: { mantenimientoCadaDias: true, nombre: true } });
      await tx.mantenimientoHerramienta.create({
        data: { herramientaId: d.herramientaId, fecha: aFecha(d.fecha, "12:00"), descripcion: d.descripcion, taller: d.taller ?? null, costo: new Prisma.Decimal(d.costo), registradoPorId: yo.id },
      });
      const cada = d.cadaDias ?? h.mantenimientoCadaDias;
      const proximo = cada ? sumarDias(d.fecha, cada) : null;
      await tx.herramienta.update({ where: { id: d.herramientaId }, data: { mantenimientoCadaDias: cada ?? null, proximoMantenimiento: proximo ? aFecha(proximo, "12:00") : null } });
      await auditar(tx, yo.id, "herramienta.mantenimiento", d.herramientaId, `${yo.nombre} registró mantenimiento de ${h.nombre}: ${d.descripcion}`, undefined, { costo: d.costo, proximo });
      return { proximo };
    });
    refrescar();
    return r;
  });
}

// ═══════════════════════════ Pedir desde la obra ═══════════════════════════

const esquemaPedir = z.object({
  herramientaId: z.string().min(1),
  obraId: z.string().min(1, "Elegí la obra."),
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí el día."),
  franja: z.enum(["MANANA", "TARDE"]).default("MANANA"),
  cantidad,
  prioridad: z.enum(["NORMAL", "URGENTE"]).default("NORMAL"),
  // "Pedir igual" después del aviso de duplicado: con motivo de una línea.
  forzar: z.boolean().default(false),
  motivo: z.preprocess(vacio, z.string().trim().max(200).optional()),
});
export type DatosPedirHerramienta = z.input<typeof esquemaPedir>;

export type DuplicadoHerramienta = { id: string; mensaje: string; visible: boolean };
export type RespuestaPedirHerramienta =
  | { estado: "creado"; pedidoId: string; numero: number; choferes: string[]; avisado: string | null }
  | { estado: "duplicado"; existente: DuplicadoHerramienta };

/**
 * "La necesito en [obra] para [fecha]": crea el pedido de viaje con origen donde esté la
 * herramienta (depósito u otra obra) y destino la obra. Entra en las solicitudes de los choferes.
 * Antes, el duplicado exacto: misma herramienta + misma obra + mismo día, pendiente o aceptado.
 */
export async function pedirHerramienta(entrada: DatosPedirHerramienta): Promise<Resultado<RespuestaPedirHerramienta>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("herramientas.solicitar");
    const d = esquemaPedir.parse(entrada);
    const obra = await obraActiva(d.obraId);
    // Alcance en el servidor: aunque manden el id a mano, solo para sus obras.
    if (!(await esObraDelUsuario(yo, obra.id))) throw new ErrorNegocio(`No sos responsable de Obra ${obra.nombre}.`);
    if (d.dia < diaISO()) throw new ErrorNegocio("El día ya pasó.");
    const fechaNecesaria = aFecha(d.dia, "12:00");

    const h = await db.herramienta.findUnique({ where: { id: d.herramientaId }, include: { obra: { select: { id: true, nombre: true } } } });
    if (!h || !h.activo) throw new ErrorNegocio("Esa herramienta no existe o está dada de baja.");

    // Duplicado exacto: se avisa con nombre y fecha; nunca se bloquea.
    const igual = await db.pedidoViaje.findFirst({
      where: { herramientaId: h.id, obraId: obra.id, fechaNecesaria, estado: { in: ["PENDIENTE", "TOMADO"] } },
      orderBy: { creadoEn: "asc" },
      include: { solicitante: { select: { id: true, nombre: true } }, tomadoPor: { select: { nombre: true } } },
    });
    if (igual && !d.forzar) {
      const yoMismo = igual.solicitanteId === yo.id;
      const quien = yoMismo ? "Vos ya pediste" : `${igual.solicitante.nombre} ya pidió`;
      const estado = igual.estado === "TOMADO" ? `y ya lo aceptó ${igual.tomadoPor?.nombre ?? "un chofer"}` : "y todavía está pendiente";
      return {
        estado: "duplicado",
        existente: {
          id: igual.id,
          mensaje: `${quien} ${h.nombre} para Obra ${obra.nombre} ${paraElDia(fechaNecesaria)}. Lo ${yoMismo ? "pediste" : "pidió"} ${elDiaALas(igual.creadoEn)} ${estado}.`,
          visible: (await db.pedidoViaje.count({ where: conAlcance(yo, { id: igual.id }) })) > 0,
        },
      } as const;
    }
    if (igual && (d.motivo ?? "").length < 3) throw new ErrorNegocio("Contá en una línea por qué hace falta otro.");

    if (h.tipoControl === "UNITARIA") {
      if (h.obraId === obra.id) throw new ErrorNegocio(`${h.nombre} ya está en Obra ${obra.nombre}.`);
      if (h.estado === "EN_REPARACION") throw new ErrorNegocio(`${h.nombre} está en reparación.`);
      if (h.estado !== "DISPONIBLE" && h.estado !== "EN_OBRA") throw new ErrorNegocio(`${h.nombre} no está disponible.`);
      if (!igual) {
        const ya = await db.pedidoViaje.findFirst({ where: { herramientaId: h.id, estado: { in: ["PENDIENTE", "TOMADO", "EN_VIAJE"] } }, include: { solicitante: { select: { nombre: true } }, obra: { select: { nombre: true } } } });
        if (ya) throw new ErrorNegocio(`Ya la pidió ${ya.solicitante.nombre} para Obra ${ya.obra.nombre} ${paraElDia(ya.fechaNecesaria ?? ya.paraCuando)} (pedido ${ya.numero}).`);
      }
    }

    const desdeObra = h.tipoControl === "UNITARIA" && h.estado === "EN_OBRA" ? h.obra : null;
    // Sale del depósito donde está (la unitaria) o del que tenga stock suficiente (la de cantidad).
    const dep = desdeObra ? null : await db.$transaction((tx) => depositoCon(tx, h.id, d.cantidad));
    if (!desdeObra && !dep) {
      if (h.tipoControl === "CANTIDAD") {
        const hay = await db.existenciaHerramienta.aggregate({ where: { herramientaId: h.id, ubicacionId: { not: null } }, _sum: { cantidad: true } });
        throw new ErrorNegocio(`En los depósitos hay ${hay._sum.cantidad ?? 0}.`);
      }
      throw new ErrorNegocio("No sabemos en qué depósito está. Avisale al depósito.");
    }

    const origen = { origenTipo: desdeObra ? ("OBRA" as const) : ("DEPOSITO" as const), origenId: desdeObra ? desdeObra.id : dep! };
    const puntos = await resolverPuntos(db, { ...origen, obraId: obra.id });
    const nombreH = h.tipoControl === "CANTIDAD" ? `${d.cantidad} ${h.nombre.toLowerCase()}` : h.nombre;
    const responsablesOrigen = desdeObra
      ? await db.responsableObra.findMany({ where: { obraId: desdeObra.id, activo: true, usuarioId: { not: yo.id } }, select: { usuario: { select: { id: true, nombre: true } } } })
      : [];

    const pedido = await db.$transaction(async (tx) => {
      const p = await tx.pedidoViaje.create({
        data: {
          solicitanteId: yo.id,
          obraId: obra.id,
          tipo: h.esMaquina ? "TRASLADO_MAQUINARIA" : "TRASLADO_HERRAMIENTAS",
          ...origen,
          ...puntos,
          herramientaId: h.id,
          fechaNecesaria,
          descripcion: `${nombreH} (${h.codigo})`,
          necesitaCamion: h.esMaquina,
          paraCuando: aFecha(d.dia, FRANJA[d.franja].hora),
          franja: d.franja,
          prioridad: d.prioridad,
        },
        select: { id: true, numero: true },
      });
      // Al que lo pidió primero: que sepa que otro también lo necesitaba.
      if (igual && igual.solicitanteId !== yo.id) {
        await notificarEvento(EVENTO.herramientaDuplicada({
          primeroId: igual.solicitante.id, pedidoPrimeroId: igual.id, pedidoId: p.id, obraId: obra.id, quien: yo.nombre, herramienta: h.nombre, obra: obra.nombre, cuando: fechaNecesaria, motivo: d.motivo ?? null,
        }), { tx, actor: yo.id });
      }
      // Si sale de otra obra, le avisa a quienes la tienen ahí.
      if (responsablesOrigen.length) {
        await notificarEvento(EVENTO.herramientaPedidaEnTuObra({
          usuarioIds: responsablesOrigen.map((r) => r.usuario.id), herramientaId: h.id, pedidoId: p.id, quien: yo.nombre, herramienta: h.nombre, desdeObra: desdeObra!.nombre, obra: obra.nombre, cuando: fechaNecesaria,
        }), { tx, actor: yo.id });
      }
      await auditarBase(tx, {
        usuarioId: yo.id, accion: igual ? "pedido.crear.noEraDuplicado" : "pedido.crear", entidad: "PedidoViaje", entidadId: p.id,
        resumen: `${yo.nombre} pidió ${nombreH} (${h.codigo}) para Obra ${obra.nombre} ${paraElDia(fechaNecesaria)}${desdeObra ? `, desde Obra ${desdeObra.nombre}` : ""}${igual ? (igual.solicitanteId === yo.id ? ` otra vez (${d.motivo})` : ` aunque ya la había pedido ${igual.solicitante.nombre} (${d.motivo})`) : ""}`,
        despues: { estado: "PENDIENTE", herramienta: h.codigo, obra: obra.nombre, motivo: d.motivo ?? null },
      });
      return p;
    });
    refrescar();
    await avisarSolicitudNueva(pedido.id, yo.id);
    return {
      estado: "creado", pedidoId: pedido.id, numero: pedido.numero, choferes: await choferesQueLoVen(h.esMaquina),
      avisado: responsablesOrigen.length ? responsablesOrigen.map((r) => r.usuario.nombre).join(" y ") : null,
    } as const;
  });
}

// ═══════════════════════════ Alta, edición e importación ═══════════════════════════

const esquemaHerramienta = z.object({
  id: z.preprocess(vacio, z.string().optional()),
  nombre: z.string().trim().min(2, "Poné el nombre.").max(80),
  categoria: z.string().trim().min(2, "Elegí o escribí la categoría.").max(40),
  esMaquina: z.boolean(),
  tipoControl: z.enum(["UNITARIA", "CANTIDAD"]),
  marca: z.preprocess(vacio, z.string().trim().max(40).optional()),
  modelo: z.preprocess(vacio, z.string().trim().max(40).optional()),
  nroSerie: z.preprocess(vacio, z.string().trim().max(60).optional()),
  valorCompra: z.preprocess(vacio, z.coerce.number().min(0).optional()),
  mantenimientoCadaDias: z.preprocess(vacio, z.coerce.number().int().min(1).max(3650).optional()),
  cantidadInicial: z.preprocess(vacio, z.coerce.number().int().min(0).max(100_000).optional()),
  // En qué depósito queda al darla de alta (si no, el principal).
  depositoId: z.preprocess(vacio, z.string().optional()),
  foto: z.preprocess(vacio, z.string().optional()),
});
export type DatosHerramienta = z.input<typeof esquemaHerramienta>;

export async function guardarHerramienta(entrada: DatosHerramienta): Promise<Resultado<{ id: string; codigo: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("herramientas.editar");
    const d = esquemaHerramienta.parse(entrada);
    const r = await db.$transaction(async (tx) => {
      const cat = await tx.categoriaHerramienta.upsert({ where: { nombre: d.categoria }, create: { nombre: d.categoria }, update: {} });
      const fotoUrl = d.foto?.startsWith("data:") ? await guardarArchivo(tx, d.foto, yo.id, d.nombre) : undefined;
      const datos = {
        nombre: d.nombre, categoriaId: cat.id, esMaquina: d.esMaquina, marca: d.marca ?? null, modelo: d.modelo ?? null, nroSerie: d.nroSerie ?? null,
        valorCompra: d.valorCompra != null ? new Prisma.Decimal(d.valorCompra) : null, mantenimientoCadaDias: d.mantenimientoCadaDias ?? null,
        ...(fotoUrl ? { fotoUrl } : {}),
      };
      if (d.id) {
        const h = await tx.herramienta.update({ where: { id: d.id }, data: datos, select: { id: true, codigo: true } });
        await auditar(tx, yo.id, "herramienta.editar", h.id, `${yo.nombre} editó ${d.nombre} (${h.codigo})`, undefined, { ...d, foto: undefined });
        return h;
      }
      const codigo = (await siguienteCodigo(tx))();
      const elegido = d.depositoId ? await tx.ubicacion.findFirst({ where: { id: d.depositoId, tipo: "DEPOSITO", activa: true }, select: { id: true } }) : null;
      if (d.depositoId && !elegido) throw new ErrorNegocio("Ese depósito no existe.");
      const dep = elegido?.id ?? (await depositoId(tx));
      const h = await tx.herramienta.create({
        data: { ...datos, codigo, tipoControl: d.tipoControl, estado: "DISPONIBLE", ubicacionId: d.tipoControl === "UNITARIA" ? dep : null },
        select: { id: true, codigo: true },
      });
      if (d.tipoControl === "CANTIDAD" && d.cantidadInicial) await sumar(tx, h.id, { ubicacionId: dep }, d.cantidadInicial);
      await auditar(tx, yo.id, "herramienta.alta", h.id, `${yo.nombre} dio de alta ${d.nombre} (${codigo})`, undefined, { codigo, nombre: d.nombre });
      return h;
    });
    refrescar();
    return r;
  });
}

export type FilaImportacion = {
  nombre: string; categoria: string; esMaquina: boolean; tipoControl: "UNITARIA" | "CANTIDAD"; marca?: string; modelo?: string;
  nroSerie?: string; valorCompra?: number; cantidad?: number; mantenimientoCadaDias?: number;
};

/** Alta masiva desde CSV (ya validado y previsualizado en pantalla). Todo o nada. */
export async function importarHerramientas(filas: FilaImportacion[]): Promise<Resultado<{ creadas: number; desde: string; hasta: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("herramientas.editar");
    if (!filas.length) throw new ErrorNegocio("No hay filas para importar.");
    if (filas.length > 500) throw new ErrorNegocio("Importá de a 500 como máximo.");
    const validas = filas.map((f, i) => {
      const r = esquemaHerramienta.safeParse({ ...f, cantidadInicial: f.cantidad });
      if (!r.success) throw new ErrorNegocio(`Fila ${i + 2}: ${r.error.issues[0].message}`);
      return r.data;
    });
    const r = await db.$transaction(async (tx) => {
      const codigo = await siguienteCodigo(tx);
      const dep = await depositoId(tx);
      const cats = new Map<string, string>();
      const codigos: string[] = [];
      for (const [i, d] of validas.entries()) {
        if (!cats.has(d.categoria)) cats.set(d.categoria, (await tx.categoriaHerramienta.upsert({ where: { nombre: d.categoria }, create: { nombre: d.categoria }, update: {} })).id);
        const c = codigo(i + 1);
        codigos.push(c);
        const h = await tx.herramienta.create({
          data: {
            codigo: c, nombre: d.nombre, categoriaId: cats.get(d.categoria)!, esMaquina: d.esMaquina, tipoControl: d.tipoControl, marca: d.marca ?? null,
            modelo: d.modelo ?? null, nroSerie: d.nroSerie ?? null, valorCompra: d.valorCompra != null ? new Prisma.Decimal(d.valorCompra) : null,
            mantenimientoCadaDias: d.mantenimientoCadaDias ?? null, estado: "DISPONIBLE", ubicacionId: d.tipoControl === "UNITARIA" ? dep : null,
          },
          select: { id: true },
        });
        if (d.tipoControl === "CANTIDAD" && d.cantidadInicial) await sumar(tx, h.id, { ubicacionId: dep }, d.cantidadInicial);
      }
      await auditarBase(tx, {
        usuarioId: yo.id, accion: "herramienta.importar", entidad: "Herramienta", entidadId: "csv",
        resumen: `${yo.nombre} importó ${codigos.length} herramientas (${codigos[0]} a ${codigos.at(-1)})`,
        despues: { cantidad: codigos.length, desde: codigos[0], hasta: codigos.at(-1)! },
      });
      return { creadas: codigos.length, desde: codigos[0], hasta: codigos.at(-1)! };
    }, { timeout: 60_000 });
    refrescar();
    return r;
  });
}

// ═══════════════════════════ Sobrantes ═══════════════════════════

const esquemaSobrante = z.object({
  descripcion: z.string().trim().min(2, "Contá qué es.").max(120),
  categoria: z.enum(["CONSTRUCCION", "ELECTRICO", "SANITARIO", "OTRO"], { error: "Elegí el tipo." }),
  cantidad: z.coerce.number({ error: "Poné la cantidad." }).positive("Poné la cantidad.").max(1_000_000),
  unidad: z.string().trim().min(1, "Poné la unidad.").max(20),
  obraOrigenId: z.preprocess(vacio, z.string().optional()),
});
export type DatosSobrante = z.input<typeof esquemaSobrante>;

export async function agregarSobrante(entrada: DatosSobrante): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("sobrantes.editar");
    const d = esquemaSobrante.parse(entrada);
    const s = await db.materialSobrante.create({ data: { ...d, cantidad: new Prisma.Decimal(d.cantidad), obraOrigenId: d.obraOrigenId ?? null } });
    await auditarBase(db, { usuarioId: yo.id, accion: "sobrante.alta", entidad: "MaterialSobrante", entidadId: s.id, resumen: `${yo.nombre} cargó un sobrante: ${d.cantidad} ${d.unidad} de ${d.descripcion}`, despues: { ...d } });
    refrescar();
    return null;
  });
}

/** Baja rápida: se usó todo o una parte (lo que queda sigue en la lista). Nada se borra. */
export async function usarSobrante(id: string, usado: number | null, motivo: string): Promise<Resultado<{ queda: number }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("sobrantes.editar");
    const s = await db.materialSobrante.findUnique({ where: { id } });
    if (!s || s.bajaEn) throw new ErrorNegocio("Ese sobrante ya no está.");
    const total = Number(s.cantidad);
    const n = usado == null ? total : usado;
    if (!(n > 0) || n > total) throw new ErrorNegocio(`Hay ${total} ${s.unidad}.`);
    const queda = Math.round((total - n) * 100) / 100;
    await db.materialSobrante.update({
      where: { id },
      data: queda > 0 ? { cantidad: new Prisma.Decimal(queda) } : { bajaEn: new Date(), motivoBaja: motivo.trim() || "Se usó todo" },
    });
    await auditarBase(db, {
      usuarioId: yo.id, accion: "sobrante.uso", entidad: "MaterialSobrante", entidadId: id,
      resumen: `${yo.nombre} usó ${n} ${s.unidad} de ${s.descripcion}${queda > 0 ? ` (quedan ${queda})` : ""}`,
      antes: { cantidad: total }, despues: { cantidad: queda, motivo: motivo.trim() },
    });
    refrescar();
    return { queda };
  });
}

export async function deshacerUsoSobrante(id: string, cantidadAnterior: number): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("sobrantes.editar");
    const s = await db.materialSobrante.update({ where: { id }, data: { cantidad: new Prisma.Decimal(cantidadAnterior), bajaEn: null, motivoBaja: null } });
    await auditarBase(db, {
      usuarioId: yo.id, accion: "sobrante.deshacerUso", entidad: "MaterialSobrante", entidadId: id,
      resumen: `${yo.nombre} deshizo el uso de ${s.descripcion} (vuelve a ${cantidadAnterior} ${s.unidad})`, despues: { cantidad: cantidadAnterior },
    });
    refrescar();
    return null;
  });
}
