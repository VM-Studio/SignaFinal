import "server-only";
import type { EstadoVehiculo } from "@prisma/client";
import { db } from "@/lib/db";
import { conConsumo, documentosVigentes } from "./calculos";

export { conConsumo, documentosVigentes };
import { exigirPermiso } from "@/lib/auth/sesion";
import { aFecha, diasHasta, inicioDelDia, sumarDias } from "@/lib/formato";

export const ESTADO_VEHICULO: Record<EstadoVehiculo, { texto: string; tono: "ok" | "activo" | "aviso" | "critico" }> = {
  DISPONIBLE: { texto: "Disponible", tono: "ok" },
  EN_VIAJE: { texto: "En viaje", tono: "activo" },
  EN_TALLER: { texto: "En el taller", tono: "aviso" },
  FUERA_DE_SERVICIO: { texto: "Fuera de servicio", tono: "critico" },
};

function proximoVencimiento(docs: Parameters<typeof documentosVigentes>[0]) {
  const conFecha = documentosVigentes(docs).filter((d) => d.vencimiento);
  return conFecha.sort((a, b) => a.vencimiento!.getTime() - b.vencimiento!.getTime())[0] ?? null;
}

export async function listarFlota() {
  await exigirPermiso("flota.ver");
  const vehiculos = await db.vehiculo.findMany({
    where: { activo: true },
    orderBy: [{ tipo: "asc" }, { capacidadCargaKg: "desc" }, { nombre: "asc" }],
    include: {
      asignadoA: { select: { nombre: true } },
      documentos: { select: { id: true, tipo: true, vencimiento: true, archivoUrl: true, notas: true, creadoEn: true } },
      viajes: { where: { estado: "EN_CURSO" }, take: 1, select: { chofer: { select: { nombre: true } }, pedido: { select: { obra: { select: { nombre: true } } } } } },
    },
  });
  const lista = vehiculos.map((v) => {
    const prox = proximoVencimiento(v.documentos);
    const vencidos = documentosVigentes(v.documentos).filter((d) => d.vencimiento && diasHasta(d.vencimiento) < 0 && (d.tipo === "SEGURO" || d.tipo === "VTV" || d.tipo === "RUTA"));
    return {
      id: v.id, nombre: v.nombre, tipo: v.tipo, patente: v.patente, estado: v.estado, entraEnCola: v.entraEnCola, kmActual: v.kmActual,
      asignadoA: v.asignadoA?.nombre ?? null,
      enViaje: v.viajes[0] ? { chofer: v.viajes[0].chofer.nombre, obra: v.viajes[0].pedido.obra.nombre } : null,
      proximo: prox ? { tipo: prox.tipo, vencimiento: prox.vencimiento! } : null,
      docVencida: vencidos.length > 0,
    };
  });
  return {
    vehiculos: lista,
    resumen: {
      disponibles: lista.filter((v) => v.estado === "DISPONIBLE").length,
      enViaje: lista.filter((v) => v.estado === "EN_VIAJE").length,
      enTaller: lista.filter((v) => v.estado === "EN_TALLER").length,
      docVencida: lista.filter((v) => v.docVencida).length,
    },
  };
}

export async function fichaVehiculo(id: string) {
  await exigirPermiso("flota.ver");
  const v = await db.vehiculo.findUnique({
    where: { id },
    include: {
      asignadoA: { select: { id: true, nombre: true } },
      base: { select: { id: true, nombre: true } },
      documentos: { orderBy: [{ tipo: "asc" }, { vencimiento: "desc" }] },
      viajes: {
        where: { estado: { in: ["PROGRAMADO", "EN_CURSO", "FINALIZADO"] } },
        orderBy: [{ salidaReal: { sort: "desc", nulls: "first" } }],
        take: 30,
        include: { chofer: { select: { nombre: true } }, pedido: { select: { id: true, numero: true, descripcion: true, obra: { select: { nombre: true } } } } },
      },
      cargas: { orderBy: { fecha: "desc" }, take: 40, include: { usuario: { select: { nombre: true } }, obra: { select: { nombre: true } } } },
      mantenimientos: { orderBy: { fecha: "desc" } },
      incidentes: { orderBy: { fecha: "desc" }, include: { usuario: { select: { nombre: true } } } },
    },
  });
  if (!v) return null;
  const cargas = conConsumo(v.cargas.map((c) => ({ ...c, litros: Number(c.litros), monto: Number(c.monto) })));
  const consumos = cargas.map((c) => c.consumo).filter((x): x is number => x != null);
  const ultimoConProximo = v.mantenimientos.find((m) => m.proximoKm || m.proximaFecha);
  return {
    ...v,
    costoKm: Number(v.costoKm),
    vigentes: documentosVigentes(v.documentos),
    viajes: v.viajes.map((x) => ({ ...x, peajes: Number(x.peajes), costoCalculado: x.costoCalculado == null ? null : Number(x.costoCalculado) })),
    cargas,
    consumoPromedio: consumos.length ? consumos.reduce((a, b) => a + b, 0) / consumos.length : null,
    mantenimientos: v.mantenimientos.map((m) => ({ ...m, costo: Number(m.costo) })),
    proximoMantenimiento: ultimoConProximo ? { km: ultimoConProximo.proximoKm, fecha: ultimoConProximo.proximaFecha, faltanKm: ultimoConProximo.proximoKm ? ultimoConProximo.proximoKm - v.kmActual : null } : null,
    incidentes: v.incidentes.map((i) => ({ ...i, monto: Number(i.monto) })),
  };
}

export type Ficha = NonNullable<Awaited<ReturnType<typeof fichaVehiculo>>>;

export async function opcionesVehiculo() {
  await exigirPermiso("flota.editar");
  const [personas, bases] = await Promise.all([
    db.usuario.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    db.ubicacion.findMany({ where: { tipo: "BASE_VEHICULOS" }, select: { id: true, nombre: true } }),
  ]);
  return { personas, bases };
}

/** Agenda del día: vehículos de la cola en filas y sus viajes como bloques por hora. */
export async function agenda(dia: string) {
  await exigirPermiso("flota.agenda");
  const desde = aFecha(dia);
  const hasta = aFecha(sumarDias(dia, 1));
  const [vehiculos, viajes] = await Promise.all([
    db.vehiculo.findMany({ where: { activo: true, entraEnCola: true }, orderBy: [{ tipo: "asc" }, { capacidadCargaKg: "desc" }], select: { id: true, nombre: true, patente: true, estado: true } }),
    db.viaje.findMany({
      where: {
        estado: { not: "CANCELADO" },
        vehiculo: { entraEnCola: true },
        OR: [{ salidaReal: { gte: desde, lt: hasta } }, { salidaReal: null, salidaEstimada: { gte: desde, lt: hasta } }],
      },
      include: { chofer: { select: { nombre: true } }, pedido: { select: { id: true, numero: true, descripcion: true, prioridad: true, obra: { select: { nombre: true } } } } },
    }),
  ]);
  const ahora = new Date();
  return vehiculos.map((v) => ({
    ...v,
    viajes: viajes
      .filter((x) => x.vehiculoId === v.id)
      .map((x) => {
        const inicio = x.salidaReal ?? x.salidaEstimada!;
        // Duración: real si terminó; en curso, hasta ahora (mínimo 1 h); programado, 2 h estimadas.
        const fin = x.llegadaReal ?? (x.estado === "EN_CURSO" ? new Date(Math.max(ahora.getTime(), inicio.getTime() + 3_600_000)) : new Date(inicio.getTime() + 2 * 3_600_000));
        return {
          id: x.id, pedidoId: x.pedido.id, numero: x.pedido.numero, descripcion: x.pedido.descripcion, obra: x.pedido.obra.nombre,
          chofer: x.chofer.nombre, estado: x.estado, urgente: x.pedido.prioridad === "URGENTE",
          inicio: inicio.toISOString(), fin: fin.toISOString(),
        };
      })
      .sort((a, b) => a.inicio.localeCompare(b.inicio)),
  }));
}

export const hoyISO = () => inicioDelDia().toISOString();
