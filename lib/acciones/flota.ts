"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { autorizar } from "@/lib/auth/usuario-actual";
import { auditar } from "@/lib/auditoria";
import { ejecutar, ErrorNegocio, type Resultado } from "./resultado";
import { despuesDeCambiar } from "./comun";

const vacioAUndef = (v: unknown) => (v === "" || v === null ? undefined : v);
const textoOpcional = (max = 120) => z.preprocess(vacioAUndef, z.string().trim().max(max).optional());
const fechaOpcional = z.preprocess(vacioAUndef, z.coerce.date().optional());
const enteroOpcional = z.preprocess(vacioAUndef, z.coerce.number().int().min(0).optional());

const esquemaVehiculo = z.object({
  id: z.preprocess(vacioAUndef, z.string().optional()),
  nombre: z.string().trim().min(2, "Poné un nombre, por ejemplo “Camión 5 tn”.").max(60),
  tipo: z.enum(["CAMION", "CAMIONETA", "AUTO"], { error: "Elegí el tipo." }),
  patente: z.string().trim().toUpperCase().min(6, "Revisá la patente.").max(12),
  marca: textoOpcional(40),
  modelo: textoOpcional(40),
  anio: z.preprocess(vacioAUndef, z.coerce.number().int().min(1980).max(2100).optional()),
  capacidadKg: z.coerce.number({ error: "Poné la capacidad de carga." }).int().min(0).max(40000),
  costoKm: z.coerce.number({ error: "Poné el costo por km." }).min(0, "El costo no puede ser negativo."),
  kmActual: z.coerce.number({ error: "Poné los km actuales." }).int().min(0),
  seguroCompania: textoOpcional(60),
  seguroPoliza: textoOpcional(40),
  seguroVence: fechaOpcional,
  vtvVence: fechaOpcional,
  idCusat: textoOpcional(40),
  asignadoAId: z.preprocess(vacioAUndef, z.string().optional()),
  lugarId: z.preprocess(vacioAUndef, z.string().optional()),
  disponibleParaPedidos: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()),
  notas: textoOpcional(500),
});

export type DatosVehiculo = z.input<typeof esquemaVehiculo>;

export async function guardarVehiculo(entrada: DatosVehiculo): Promise<Resultado<{ id: string }>> {
  return ejecutar(async () => {
    const yo = await autorizar("flota.editar");
    const { id, ...d } = esquemaVehiculo.parse(entrada);
    const datos = {
      ...d,
      costoKm: new Prisma.Decimal(d.costoKm),
      marca: d.marca ?? null, modelo: d.modelo ?? null, anio: d.anio ?? null,
      seguroCompania: d.seguroCompania ?? null, seguroPoliza: d.seguroPoliza ?? null,
      seguroVence: d.seguroVence ?? null, vtvVence: d.vtvVence ?? null,
      idCusat: d.idCusat ?? null, asignadoAId: d.asignadoAId ?? null, lugarId: d.lugarId ?? null, notas: d.notas ?? null,
    };

    const resultado = await db.$transaction(async (tx) => {
      if (id) {
        const previo = await tx.vehiculo.findUniqueOrThrow({ where: { id }, select: { kmActual: true } });
        if (datos.kmActual < previo.kmActual) {
          throw new ErrorNegocio(`Los km no pueden bajar: tiene registrados ${previo.kmActual.toLocaleString("es-AR")}.`);
        }
        const v = await tx.vehiculo.update({ where: { id }, data: datos, select: { id: true } });
        await auditar(tx, { usuarioId: yo.id, accion: "vehiculo.editar", entidad: "Vehiculo", entidadId: id, detalle: { ...d, costoKm: d.costoKm } as Prisma.InputJsonValue });
        return v;
      }
      const v = await tx.vehiculo.create({ data: datos, select: { id: true } });
      await auditar(tx, { usuarioId: yo.id, accion: "vehiculo.crear", entidad: "Vehiculo", entidadId: v.id });
      return v;
    });
    despuesDeCambiar();
    return resultado;
  });
}

export async function cambiarActivoVehiculo(id: string, activo: boolean): Promise<Resultado<null>> {
  return ejecutar(async () => {
    const yo = await autorizar("flota.editar");
    if (!activo) {
      const enViaje = await db.viaje.count({ where: { vehiculoId: id, estado: "EN_VIAJE" } });
      if (enViaje) throw new ErrorNegocio("Está en un viaje. Esperá a que termine.");
    }
    await db.vehiculo.update({ where: { id }, data: { activo } });
    await auditar(db, { usuarioId: yo.id, accion: activo ? "vehiculo.reactivar" : "vehiculo.desactivar", entidad: "Vehiculo", entidadId: id });
    despuesDeCambiar();
    return null;
  });
}

const esquemaMantenimiento = z.object({
  vehiculoId: z.string().min(1, "Elegí el vehículo."),
  tipo: z.enum(["SERVICE", "CUBIERTAS", "FRENOS", "REPARACION", "OTRO"], { error: "Elegí el tipo." }),
  descripcion: z.string().trim().min(3, "Contá qué se hizo.").max(300),
  fecha: z.coerce.date({ error: "Poné la fecha." }),
  km: enteroOpcional,
  costo: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().min(0)),
  taller: textoOpcional(80),
  proximoKm: enteroOpcional,
  proximaFecha: fechaOpcional,
});

export type DatosMantenimiento = z.input<typeof esquemaMantenimiento>;

export async function registrarMantenimiento(entrada: DatosMantenimiento): Promise<Resultado<null>> {
  return ejecutar(async () => {
    const yo = await autorizar("mantenimiento.registrar");
    const d = esquemaMantenimiento.parse(entrada);
    if (d.proximoKm != null && d.km != null && d.proximoKm <= d.km) throw new ErrorNegocio("El próximo service tiene que ser después de los km actuales.");
    await db.$transaction(async (tx) => {
      const m = await tx.mantenimiento.create({
        data: {
          vehiculoId: d.vehiculoId, tipo: d.tipo, descripcion: d.descripcion, fecha: d.fecha, km: d.km ?? null,
          costo: new Prisma.Decimal(d.costo), taller: d.taller ?? null, proximoKm: d.proximoKm ?? null, proximaFecha: d.proximaFecha ?? null,
          registradoPorId: yo.id,
        },
      });
      if (d.km != null) await tx.vehiculo.updateMany({ where: { id: d.vehiculoId, kmActual: { lt: d.km } }, data: { kmActual: d.km } });
      await auditar(tx, { usuarioId: yo.id, accion: "mantenimiento.registrar", entidad: "Vehiculo", entidadId: d.vehiculoId, detalle: { mantenimientoId: m.id } });
    });
    despuesDeCambiar();
    return null;
  });
}

const esquemaCarga = z.object({
  clientId: z.string().uuid(),
  vehiculoId: z.string().min(1, "Elegí el vehículo."),
  litros: z.coerce.number({ error: "Poné los litros." }).positive("Los litros tienen que ser más de cero.").max(1000),
  monto: z.coerce.number({ error: "Poné cuánto se pagó." }).min(0).max(10_000_000),
  km: enteroOpcional,
  ocurridoEn: z.coerce.date().optional(),
});

export type DatosCarga = z.input<typeof esquemaCarga>;

export async function cargarCombustible(entrada: DatosCarga): Promise<Resultado<null>> {
  return ejecutar(async () => {
    const yo = await autorizar("combustible.cargar");
    const d = esquemaCarga.parse(entrada);
    if (await db.cargaCombustible.findUnique({ where: { clientId: d.clientId }, select: { id: true } })) return null;

    const vehiculo = await db.vehiculo.findUnique({ where: { id: d.vehiculoId }, select: { activo: true, kmActual: true, nombre: true } });
    if (!vehiculo?.activo) throw new ErrorNegocio("Ese vehículo no está activo.");
    if (d.km != null && d.km + 5000 < vehiculo.kmActual) {
      throw new ErrorNegocio(`${vehiculo.nombre} tiene ${vehiculo.kmActual.toLocaleString("es-AR")} km. Revisá el número.`);
    }

    await db.$transaction(async (tx) => {
      const c = await tx.cargaCombustible.create({
        data: {
          clientId: d.clientId, vehiculoId: d.vehiculoId, choferId: yo.id,
          litros: new Prisma.Decimal(d.litros), monto: new Prisma.Decimal(d.monto), km: d.km ?? null,
          fecha: d.ocurridoEn && d.ocurridoEn <= new Date() ? d.ocurridoEn : new Date(),
        },
      });
      if (d.km != null) await tx.vehiculo.updateMany({ where: { id: d.vehiculoId, kmActual: { lt: d.km } }, data: { kmActual: d.km } });
      await auditar(tx, { usuarioId: yo.id, accion: "combustible.cargar", entidad: "CargaCombustible", entidadId: c.id });
    });
    despuesDeCambiar();
    return null;
  });
}
