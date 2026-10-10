import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Map() }));
vi.mock("@/lib/auth/sesion", () => ({ obtenerSesion: async () => null }));
const avisos: { nombre: string; titulo: string; cuerpo: string }[] = [];
vi.mock("@/lib/notificaciones/enviar", () => ({
  notificarEvento: vi.fn(async (e: { nombre: string; titulo: string; cuerpo: string }) => { avisos.push(e); return []; }),
  baseViaje: async (_c: unknown, pedidoId: string, chofer?: string) => ({ pedidoId, solicitanteId: "x", obraId: "x", descripcion: pedidoId, destino: "Obra", chofer: chofer ?? "Claudio" }),
}));

/**
 * Prueba contra la base: un viaje con un retiro y dos entregas (A y B). El GPS lo deja quieto en B antes
 * que en A: se reordena, queda la pregunta "¿seguimos así?" y "No, todavía no" vuelve al orden de antes.
 */
const db = new PrismaClient();
const hayBase = !!process.env.DATABASE_URL;
const DEP = { lat: -34.5875, lng: -58.4575 };
const OBRA_A = { lat: -34.5925, lng: -58.4376 };
const OBRA_B = { lat: -34.6080, lng: -58.4710 };
let f: { obras: string[]; pedidos: string[]; viajeId: string; choferId: string; vehiculoId: string; kmVehiculo: number } | null = null;

describe.skipIf(!hayBase)("motor por paradas (con base)", () => {
  beforeAll(async () => {
    const { crearViaje } = await import("./paradas");
    const { arrancarParadas } = await import("./motor");
    const solicitante = await db.usuario.findFirstOrThrow({ where: { rol: { not: "CHOFER" } }, select: { id: true } });
    const vehiculo = await db.vehiculo.findFirstOrThrow({ where: { viajes: { none: { estado: "EN_CURSO" } } }, select: { id: true, kmActual: true } });
    const chofer = await db.usuario.create({ data: { nombre: "Chofer recorrido", email: `chofer-rec-${Date.now()}@signa.test`, passwordHash: "-", rol: "CHOFER" } });
    const obras = await Promise.all([OBRA_A, OBRA_B].map((p, i) => db.obra.create({ data: { nombre: `Prueba ${i ? "B" : "A"}`, codigo: `TEST-REC-${i}-${Date.now()}`, direccion: "-", localidad: "-", latitud: p.lat, longitud: p.lng, estado: "FINALIZADA", radioGeocercaM: 150 } })));
    const pedidos = await Promise.all(obras.map((o) => db.pedidoViaje.create({
      data: {
        solicitanteId: solicitante.id, obraId: o.id, tipo: "LLEVAR_A_OBRA", descripcion: `Para ${o.nombre}`, paraCuando: new Date(),
        origenTipo: "DEPOSITO", origenId: "dep-prueba", origenNombre: "Depósito prueba", origenDireccion: "-", origenLat: DEP.lat, origenLng: DEP.lng,
        destinoNombre: `Obra ${o.nombre}`, destinoDireccion: "-", destinoLat: o.latitud, destinoLng: o.longitud, estado: "EN_VIAJE", tomadoPorId: chofer.id, tomadoEn: new Date(),
      },
    })));
    // A primero y B después (orden de los pedidos).
    const viajeId = await db.$transaction(async (tx) => {
      const id = await crearViaje(tx, { pedidoIds: pedidos.map((p) => p.id), vehiculoId: vehiculo.id, choferId: chofer.id, salidaEstimada: new Date(), ordenRuta: null });
      await tx.viaje.update({ where: { id }, data: { estado: "EN_CURSO", etapa: "HACIA_RETIRO", inicioEn: new Date(), kmSalida: vehiculo.kmActual } });
      await arrancarParadas(tx, id, null, new Date());
      return id;
    });
    f = { obras: obras.map((o) => o.id), pedidos: pedidos.map((p) => p.id), viajeId, choferId: chofer.id, vehiculoId: vehiculo.id, kmVehiculo: vehiculo.kmActual };
  });

  afterAll(async () => {
    if (f) {
      await db.posicionVehiculo.deleteMany({ where: { viajeId: f.viajeId } });
      await db.recordatorio.deleteMany({ where: { usuarioId: f.choferId } });
      await db.itemParada.deleteMany({ where: { parada: { viajeId: f.viajeId } } });
      await db.viajePedido.deleteMany({ where: { viajeId: f.viajeId } });
      await db.viajeParada.deleteMany({ where: { viajeId: f.viajeId } });
      await db.pedidoViaje.updateMany({ where: { id: { in: f.pedidos } }, data: { viajeId: null } });
      await db.viaje.delete({ where: { id: f.viajeId } });
      await db.pedidoViaje.deleteMany({ where: { id: { in: f.pedidos } } });
      await db.obra.deleteMany({ where: { id: { in: f.obras } } });
      // La auditoría no se borra (y lo referencia): el chofer de prueba queda inactivo.
      await db.usuario.update({ where: { id: f.choferId }, data: { activo: false } });
    }
    await db.$disconnect();
  });

  const orden = async () => (await db.viajeParada.findMany({ where: { viajeId: f!.viajeId }, orderBy: { orden: "asc" } })).map((p) => `${p.nombre}:${p.estado}`);
  const lectura = (p: { lat: number; lng: number }, seg: number, velocidadKmh = 0) => ({ ...p, velocidadKmh, fecha: new Date(Date.now() - 120_000 + seg * 1000), fuente: "MOCK" as const });

  it("carga en el depósito: llega, se va y la primera entrega queda en camino", async () => {
    const { evaluarViaje } = await import("./motor");
    await evaluarViaje(f!.viajeId, lectura(DEP, 0));
    await evaluarViaje(f!.viajeId, lectura(DEP, 20));
    expect(await orden()).toEqual(["Depósito prueba:LLEGO", "Obra Prueba A:PENDIENTE", "Obra Prueba B:PENDIENTE"]);
    await evaluarViaje(f!.viajeId, lectura({ lat: DEP.lat + 0.006, lng: DEP.lng }, 60, 30));
    expect(await orden()).toEqual(["Depósito prueba:COMPLETADA", "Obra Prueba A:EN_CAMINO", "Obra Prueba B:PENDIENTE"]);
  });

  it("llega antes a B: se reordena y queda la pregunta '¿seguimos así?' (aviso solo al de B)", async () => {
    const { evaluarViaje } = await import("./motor");
    avisos.length = 0;
    await evaluarViaje(f!.viajeId, lectura(OBRA_B, 600));
    await evaluarViaje(f!.viajeId, lectura(OBRA_B, 620));
    expect(await orden()).toEqual(["Depósito prueba:COMPLETADA", "Obra Prueba B:LLEGO", "Obra Prueba A:PENDIENTE"]);
    const v = await db.viaje.findUniqueOrThrow({ where: { id: f!.viajeId } });
    expect(v.etapa).toBe("EN_DESTINO");
    expect((v.motor as { pendiente?: { adelantadaDe?: string } }).pendiente?.adelantadaDe).toBe("Obra Prueba A");
    expect(avisos.map((a) => a.nombre)).toEqual(["viaje.enDestino"]);
  });

  it("'No, todavía no' vuelve al orden de antes", async () => {
    const { responderLlegada } = await import("./motor");
    expect(await responderLlegada(f!.viajeId, false, f!.choferId, "Chofer")).toBe(true);
    expect(await orden()).toEqual(["Depósito prueba:COMPLETADA", "Obra Prueba A:EN_CAMINO", "Obra Prueba B:PENDIENTE"]);
  });
});
