"use server";

import { revalidatePath } from "next/cache";
import { reevaluar } from "@/lib/alertas/reevaluar";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { guardarArchivo } from "@/lib/archivos";
import { aFecha } from "@/lib/formato";
import { auditar as auditarBase } from "@/lib/auditoria";
import { DOCUMENTO } from "@/lib/etiquetas";

/** Refresca pantallas y reevalúa las alertas del módulo (resuelve solas las que ya no aplican). */
const refrescar = () => {
  revalidatePath("/", "layout");
  reevaluar("flota");
};
const vacio = (v: unknown) => (v === "" || v === null ? undefined : v);
const fechaOpc = z.preprocess(vacio, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Revisá la fecha.").optional());

/** Auditoría de flota. `que` arma el resumen con el nombre del vehículo: (v) => `Ana cargó la VTV de ${v}`. */
async function auditar(
  tx: Prisma.TransactionClient | typeof db, usuarioId: string, accion: string, entidadId: string,
  que: (vehiculo: string) => string, antes?: Prisma.InputJsonValue, despues?: Prisma.InputJsonValue,
) {
  const v = await tx.vehiculo.findUnique({ where: { id: entidadId }, select: { nombre: true } });
  await auditarBase(tx, { usuarioId, accion, entidad: "Vehiculo", entidadId, resumen: que(v?.nombre ?? "un vehículo"), antes, despues });
}

// ═══════════════════════════ Vehículo ═══════════════════════════

const esquemaVehiculo = z.object({
  id: z.preprocess(vacio, z.string().optional()),
  nombre: z.string().trim().min(2, "Poné un nombre, por ejemplo “Camión 5 tn”.").max(60),
  tipo: z.enum(["CAMION", "CAMIONETA", "AUTO", "MAQUINA"], { error: "Elegí el tipo." }),
  patente: z.string().trim().toUpperCase().min(6, "Revisá la patente.").max(12),
  marca: z.string().trim().min(1, "Poné la marca.").max(40),
  modelo: z.string().trim().min(1, "Poné el modelo.").max(40),
  anio: z.coerce.number({ error: "Poné el año." }).int().min(1980).max(2100),
  capacidadCargaKg: z.coerce.number({ error: "Poné la capacidad." }).int().min(0).max(40_000),
  kmActual: z.coerce.number({ error: "Poné los km." }).int().min(0),
  horasMotor: z.preprocess(vacio, z.coerce.number().int().min(0).optional()),
  costoKm: z.coerce.number({ error: "Poné el costo por km." }).min(0).max(100_000),
  entraEnCola: z.boolean(),
  asignadoAId: z.preprocess(vacio, z.string().optional()),
  baseId: z.preprocess(vacio, z.string().optional()),
  idCusat: z.preprocess(vacio, z.string().trim().max(40).optional()),
});
export type DatosVehiculo = z.input<typeof esquemaVehiculo>;

export async function guardarVehiculo(entrada: DatosVehiculo): Promise<Resultado<{ id: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("flota.editar");
    const { id, ...d } = esquemaVehiculo.parse(entrada);
    const datos = { ...d, costoKm: new Prisma.Decimal(d.costoKm), horasMotor: d.horasMotor ?? null, asignadoAId: d.asignadoAId ?? null, baseId: d.baseId ?? null, idCusat: d.idCusat ?? null };

    const r = await db.$transaction(async (tx) => {
      const otro = await tx.vehiculo.findFirst({ where: { patente: d.patente, NOT: id ? { id } : undefined }, select: { nombre: true } });
      if (otro) throw new ErrorNegocio(`La patente ${d.patente} ya es de ${otro.nombre}.`);
      let v: { id: string };
      if (id) {
        const antes = await tx.vehiculo.findUniqueOrThrow({ where: { id } });
        if (d.kmActual < antes.kmActual) throw new ErrorNegocio(`Los km no pueden bajar: tiene registrados ${antes.kmActual.toLocaleString("es-AR")}.`);
        v = await tx.vehiculo.update({ where: { id }, data: datos, select: { id: true } });
        await auditar(tx, yo.id, "vehiculo.editar", id, (v) => `${yo.nombre} editó ${v}`, { nombre: antes.nombre, costoKm: antes.costoKm.toString(), asignadoAId: antes.asignadoAId, entraEnCola: antes.entraEnCola }, { ...d });
      } else {
        v = await tx.vehiculo.create({ data: datos, select: { id: true } });
        await auditar(tx, yo.id, "vehiculo.crear", v.id, (n) => `${yo.nombre} dio de alta ${n}`, undefined, { ...d });
      }
      // La camioneta propia: queda también en la persona (un vehículo por persona).
      await tx.usuario.updateMany({ where: { vehiculoAsignadoId: v.id, NOT: d.asignadoAId ? { id: d.asignadoAId } : undefined }, data: { vehiculoAsignadoId: null } });
      if (d.asignadoAId) {
        await tx.usuario.updateMany({ where: { id: d.asignadoAId }, data: { vehiculoAsignadoId: null } });
        await tx.usuario.update({ where: { id: d.asignadoAId }, data: { vehiculoAsignadoId: v.id } });
      }
      return v;
    });
    refrescar();
    return r;
  });
}

export async function cambiarEstadoVehiculo(id: string, estado: "DISPONIBLE" | "EN_TALLER" | "FUERA_DE_SERVICIO"): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("flota.editar");
    const enViaje = await db.viaje.count({ where: { vehiculoId: id, estado: "EN_CURSO" } });
    if (enViaje) throw new ErrorNegocio("Está en un viaje. Esperá a que termine.");
    const antes = await db.vehiculo.findUniqueOrThrow({ where: { id }, select: { estado: true } });
    await db.vehiculo.update({ where: { id }, data: { estado } });
    await auditar(db, yo.id, "vehiculo.estado", id, (v) => `${yo.nombre} pasó ${v} a ${estado === "EN_TALLER" ? "en taller" : estado === "FUERA_DE_SERVICIO" ? "fuera de servicio" : "disponible"}`, { estado: antes.estado }, { estado });
    refrescar();
    return null;
  });
}

export async function cambiarActivoVehiculo(id: string, activo: boolean): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("flota.editar");
    if (!activo) {
      const pend = await db.viaje.count({ where: { vehiculoId: id, estado: { in: ["EN_CURSO", "PROGRAMADO"] } } });
      if (pend) throw new ErrorNegocio("Tiene viajes en curso o programados. Reasignalos antes de darlo de baja.");
    }
    await db.vehiculo.update({ where: { id }, data: { activo } });
    await auditar(db, yo.id, activo ? "vehiculo.reactivar" : "vehiculo.baja", id, (v) => `${yo.nombre} ${activo ? "reactivó" : "dio de baja"} ${v}`);
    refrescar();
    return null;
  });
}

// ═══════════════════════════ Documentación ═══════════════════════════

const esquemaDoc = z.object({
  vehiculoId: z.string().min(1),
  tipo: z.enum(["SEGURO", "VTV", "PATENTE", "CEDULA", "RUTA", "OTRO"], { error: "Elegí el documento." }),
  vencimiento: fechaOpc,
  notas: z.preprocess(vacio, z.string().trim().max(200).optional()),
  archivo: z.preprocess(vacio, z.string().optional()),
});
export type DatosDocumento = z.input<typeof esquemaDoc>;

/** Cada renovación queda como un documento nuevo: se conserva la historia. */
export async function guardarDocumento(entrada: DatosDocumento): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("flota.documentacion");
    const d = esquemaDoc.parse(entrada);
    if ((d.tipo === "SEGURO" || d.tipo === "VTV" || d.tipo === "RUTA") && !d.vencimiento) throw new ErrorNegocio("Poné la fecha de vencimiento.");
    await db.$transaction(async (tx) => {
      const archivoUrl = d.archivo ? await guardarArchivo(tx, d.archivo, yo.id, `${d.tipo.toLowerCase()}-${d.vehiculoId}`) : null;
      const doc = await tx.documentoVehiculo.create({
        data: { vehiculoId: d.vehiculoId, tipo: d.tipo, vencimiento: d.vencimiento ? aFecha(d.vencimiento, "12:00") : null, archivoUrl, notas: d.notas ?? null },
      });
      await auditar(tx, yo.id, "vehiculo.documento", d.vehiculoId, (v) => `${yo.nombre} cargó ${DOCUMENTO[d.tipo]} de ${v}${d.vencimiento ? ` (vence ${d.vencimiento.split("-").reverse().join("/")})` : ""}`, undefined, { documentoId: doc.id, tipo: d.tipo, vencimiento: d.vencimiento ?? null });
    });
    refrescar();
    return null;
  });
}

// ═══════════════════════════ Mantenimiento ═══════════════════════════

const esquemaMant = z.object({
  vehiculoId: z.string().min(1),
  tipo: z.enum(["SERVICE", "REPARACION", "NEUMATICOS", "OTRO"], { error: "Elegí el tipo." }),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Poné la fecha."),
  km: z.coerce.number({ error: "Poné los km." }).int().min(0),
  descripcion: z.string().trim().min(3, "Contá qué se hizo.").max(300),
  taller: z.preprocess(vacio, z.string().trim().max(80).optional()),
  costo: z.coerce.number({ error: "Poné el costo." }).min(0),
  proximoKm: z.preprocess(vacio, z.coerce.number().int().min(0).optional()),
  proximaFecha: fechaOpc,
});
export type DatosMantenimiento = z.input<typeof esquemaMant>;

export async function registrarMantenimiento(entrada: DatosMantenimiento): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("mantenimiento.registrar");
    const d = esquemaMant.parse(entrada);
    if (d.proximoKm != null && d.proximoKm <= d.km) throw new ErrorNegocio("El próximo service tiene que ser después de los km actuales.");
    await db.$transaction(async (tx) => {
      const m = await tx.mantenimientoVehiculo.create({
        data: {
          vehiculoId: d.vehiculoId, tipo: d.tipo, fecha: aFecha(d.fecha, "12:00"), km: d.km, descripcion: d.descripcion, taller: d.taller ?? null,
          costo: new Prisma.Decimal(d.costo), proximoKm: d.proximoKm ?? null, proximaFecha: d.proximaFecha ? aFecha(d.proximaFecha, "12:00") : null,
        },
      });
      await tx.vehiculo.updateMany({ where: { id: d.vehiculoId, kmActual: { lt: d.km } }, data: { kmActual: d.km } });
      await auditar(tx, yo.id, "vehiculo.mantenimiento", d.vehiculoId, (v) => `${yo.nombre} registró ${d.tipo === "SERVICE" ? "un service" : "mantenimiento"} de ${v}: ${d.descripcion}`, undefined, { mantenimientoId: m.id, tipo: d.tipo, costo: d.costo });
    });
    refrescar();
    return null;
  });
}

// ═══════════════════════════ Incidentes ═══════════════════════════

const esquemaInc = z.object({
  vehiculoId: z.string().min(1),
  tipo: z.enum(["MULTA", "SINIESTRO", "ROTURA", "ROBO"], { error: "Elegí qué pasó." }),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Poné la fecha."),
  descripcion: z.string().trim().min(3, "Contá qué pasó.").max(400),
  monto: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().min(0)),
});
export type DatosIncidente = z.input<typeof esquemaInc>;

export async function registrarIncidente(entrada: DatosIncidente): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("incidentes.registrar");
    const d = esquemaInc.parse(entrada);
    const i = await db.incidenteVehiculo.create({
      data: { vehiculoId: d.vehiculoId, usuarioId: yo.id, tipo: d.tipo, fecha: aFecha(d.fecha, "12:00"), descripcion: d.descripcion, monto: new Prisma.Decimal(d.monto) },
    });
    await auditar(db, yo.id, "vehiculo.incidente", d.vehiculoId, (v) => `${yo.nombre} registró ${d.tipo === "MULTA" ? "una multa" : d.tipo === "SINIESTRO" ? "un siniestro" : d.tipo === "ROBO" ? "un robo" : "una rotura"} de ${v}`, undefined, { incidenteId: i.id, tipo: d.tipo, monto: d.monto });
    refrescar();
    return null;
  });
}

export async function resolverIncidente(id: string, resuelto: boolean): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("flota.editar");
    const i = await db.incidenteVehiculo.update({ where: { id }, data: { resuelto } });
    await auditar(db, yo.id, resuelto ? "vehiculo.incidente.resuelto" : "vehiculo.incidente.reabierto", i.vehiculoId, (v) => `${yo.nombre} ${resuelto ? "dio por resuelto" : "reabrió"} un incidente de ${v}`, undefined, { incidenteId: id });
    refrescar();
    return null;
  });
}
