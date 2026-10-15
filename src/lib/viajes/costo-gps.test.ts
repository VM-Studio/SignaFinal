import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

const sesion = { id: "", nombre: "Chofer costo GPS", rol: "CHOFER" as const };
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Map() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/auth/sesion", () => ({ obtenerSesion: async () => sesion, exigirSesion: async () => sesion, exigirPermiso: async () => sesion }));
vi.mock("@/lib/revalidar", () => ({ revalidar: () => {} }));
vi.mock("@/lib/alertas/reevaluar", () => ({ reevaluar: () => {} }));
vi.mock("@/lib/notificaciones/enviar", () => ({
  notificarEvento: vi.fn(async () => []),
  baseViaje: async (_c: unknown, pedidoId: string, chofer?: string) => ({ pedidoId, solicitanteId: "x", obraId: "x", descripcion: pedidoId, destino: "Obra", chofer: chofer ?? "Claudio" }),
}));

/**
 * COSTO POR GPS, SIN KM MANUAL (con base): el chofer termina el viaje sin escribir ningún número. Los km salen
 * de las posiciones GPS del viaje (saltando la lectura imposible), el costo = km × costoKm + peajes, el km del
 * vehículo se actualiza solo y la última parada se marca como llegada al terminar.
 */
const db = new PrismaClient();
const hayBase = !!process.env.DATABASE_URL;
const MARTINEZ = { lat: -34.4925, lng: -58.508 };
const OBRA = { lat: -34.5925, lng: -58.4376 };
let f: { obraId: string; pedidoId: string; viajeId: string; vehiculoId: string; kmAntes: number; costoKm: number } | null = null;

describe.skipIf(!hayBase)("terminar un viaje sin km: costo por GPS (con base)", () => {
  beforeAll(async () => {
    const { crearViaje } = await import("./paradas");
    const { arrancarParadas } = await import("./motor");
    const solicitante = await db.usuario.findFirstOrThrow({ where: { rol: "RESPONSABLE_OBRA" }, select: { id: true } });
    const chofer = await db.usuario.create({ data: { nombre: sesion.nombre, email: `chofer-gps-${Date.now()}@signa.test`, passwordHash: "-", rol: "CHOFER" } });
    sesion.id = chofer.id;
    // El último por patente (los otros tests con base toman el primero: no chocan con un vehículo en curso).
    const vehiculo = await db.vehiculo.findFirstOrThrow({ where: { activo: true, viajes: { none: { estado: "EN_CURSO" } } }, orderBy: { patente: "desc" }, select: { id: true, kmActual: true, costoKm: true } });
    const obra = await db.obra.create({ data: { nombre: "Prueba GPS", codigo: `TEST-GPS-${Date.now()}`, direccion: "-", localidad: "-", latitud: OBRA.lat, longitud: OBRA.lng, estado: "FINALIZADA", radioGeocercaM: 150 } });
    const inicio = new Date(Date.now() - 40 * 60_000);
    const pedido = await db.pedidoViaje.create({
      data: {
        solicitanteId: solicitante.id, obraId: obra.id, tipo: "LLEVAR_A_OBRA", descripcion: "Prueba GPS", paraCuando: inicio,
        origenTipo: "BASE", origenId: "base", origenNombre: "Base", origenDireccion: "-", origenLat: MARTINEZ.lat, origenLng: MARTINEZ.lng,
        destinoNombre: "Obra Prueba GPS", destinoDireccion: "-", destinoLat: OBRA.lat, destinoLng: OBRA.lng, estado: "EN_VIAJE", tomadoPorId: chofer.id, tomadoEn: inicio,
      },
    });
    const viajeId = await db.$transaction(async (tx) => {
      const id = await crearViaje(tx, { pedidoIds: [pedido.id], vehiculoId: vehiculo.id, choferId: chofer.id, salidaEstimada: inicio, ordenRuta: null });
      await tx.viaje.update({ where: { id }, data: { estado: "EN_CURSO", etapa: "HACIA_DESTINO", inicioEn: inicio, salidaReal: inicio, kmSalida: vehiculo.kmActual } });
      await arrancarParadas(tx, id, null, inicio);
      return id;
    });
    // Recorrido: 11 lecturas cada 2 minutos de Martínez hacia la obra (~0,01° de latitud cada una ≈ 1,1 km),
    // y una lectura imposible (100 km en 10 s) que se tiene que descartar.
    const pos = Array.from({ length: 11 }, (_, i) => ({ lat: MARTINEZ.lat - i * 0.01, lng: MARTINEZ.lng, fecha: new Date(inicio.getTime() + i * 120_000) }));
    pos.splice(5, 0, { lat: -35.4, lng: -58.5, fecha: new Date(pos[4].fecha.getTime() + 10_000) });
    await db.posicionVehiculo.createMany({ data: pos.map((p) => ({ vehiculoId: vehiculo.id, viajeId, latitud: p.lat, longitud: p.lng, fecha: p.fecha, fuente: "TELEFONO" as const })) });
    f = { obraId: obra.id, pedidoId: pedido.id, viajeId, vehiculoId: vehiculo.id, kmAntes: vehiculo.kmActual, costoKm: vehiculo.costoKm.toNumber() };
  });

  afterAll(async () => {
    if (f) {
      await db.posicionVehiculo.deleteMany({ where: { viajeId: f.viajeId } });
      await db.recordatorio.deleteMany({ where: { usuarioId: sesion.id } });
      await db.itemParada.deleteMany({ where: { parada: { viajeId: f.viajeId } } });
      await db.viajePedido.deleteMany({ where: { viajeId: f.viajeId } });
      await db.viajeParada.deleteMany({ where: { viajeId: f.viajeId } });
      await db.pedidoViaje.updateMany({ where: { id: f.pedidoId }, data: { viajeId: null } });
      await db.viaje.delete({ where: { id: f.viajeId } });
      await db.pedidoViaje.deleteMany({ where: { id: f.pedidoId } });
      await db.obra.deleteMany({ where: { id: f.obraId } });
      await db.vehiculo.update({ where: { id: f.vehiculoId }, data: { kmActual: f.kmAntes, estado: "DISPONIBLE" } });
      await db.usuario.update({ where: { id: sesion.id }, data: { activo: false } });
    }
    await db.$disconnect();
  });

  it("termina con peajes y nada más: km por GPS, costo y km del vehículo", async () => {
    const { finalizarViaje } = await import("./acciones");
    const r = await finalizarViaje({ clientId: crypto.randomUUID(), pedidoId: f!.pedidoId, peajes: 1500, canal: "DESLIZADOR" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const v = await db.viaje.findUniqueOrThrow({ where: { id: f!.viajeId }, select: { kmSalida: true, kmLlegada: true, costoCalculado: true, estado: true } });
    const km = (v.kmLlegada ?? 0) - (v.kmSalida ?? 0);
    expect(km).toBe(11); // 10 tramos de ~1,11 km; la lectura imposible no suma
    expect(v.estado).toBe("FINALIZADO");
    expect(v.costoCalculado?.toNumber()).toBe(km * f!.costoKm + 1500);
    const vh = await db.vehiculo.findUniqueOrThrow({ where: { id: f!.vehiculoId }, select: { kmActual: true } });
    expect(vh.kmActual).toBe(f!.kmAntes + km);
    const p = await db.pedidoViaje.findUniqueOrThrow({ where: { id: f!.pedidoId }, select: { estado: true } });
    expect(p.estado).toBe("ENTREGADO");
  });
});
