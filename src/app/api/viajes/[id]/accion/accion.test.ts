import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Map() }));
vi.mock("@/lib/auth/sesion", () => ({ obtenerSesion: async () => null }));
vi.mock("@/lib/revalidar", () => ({ revalidar: () => {} }));
vi.mock("@/lib/notificaciones/enviar", () => ({
  notificarEvento: vi.fn(async () => []),
  baseViaje: async (_c: unknown, pedidoId: string, chofer?: string) => ({ pedidoId, solicitanteId: "x", obraId: "x", descripcion: pedidoId, destino: "Obra", chofer: chofer ?? "Claudio" }),
}));

/**
 * Responder desde la notificación (POST /api/viajes/[id]/accion) contra la base: token de un solo uso,
 * atado al pedido y al tipo de respuesta, que vence; "Todavía no" deshace la llegada y "Sigo acá" la salida.
 */
const db = new PrismaClient();
const hayBase = !!process.env.DATABASE_URL;
const DEP = { lat: -34.5875, lng: -58.4575 };
const OBRA_A = { lat: -34.5925, lng: -58.4376 };
const OBRA_B = { lat: -34.6080, lng: -58.4710 };
let f: { obras: string[]; pedidos: string[]; viajeId: string; choferId: string; paradas: string[] } | null = null;

const hash = (t: string) => createHash("sha256").update(t).digest("hex");
async function token(tipo: "LLEGADA" | "SALIDA", paradaId: string, o: { venceEnMs?: number } = {}) {
  const t = `tok-${tipo}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  await db.tokenAccion.create({ data: { hash: hash(t), usuarioId: f!.choferId, pedidoId: f!.pedidos[0], viajeId: f!.viajeId, paradaId, tipo, expiraEn: new Date(Date.now() + (o.venceEnMs ?? 30 * 60_000)) } });
  return t;
}
async function responder(accion: string, t: string) {
  const { POST } = await import("./route");
  const r = await POST(new Request("http://x/api", { method: "POST", body: JSON.stringify({ accion, token: t }) }), { params: Promise.resolve({ id: f!.pedidos[0] }) });
  return { status: r.status, ...(await r.json()) } as { status: number; ok: boolean; mensaje: string };
}
const estados = async () => (await db.viajeParada.findMany({ where: { viajeId: f!.viajeId }, orderBy: { orden: "asc" } })).map((p) => p.estado);

describe.skipIf(!hayBase)("responder desde la notificación (con base)", () => {
  beforeAll(async () => {
    const { crearViaje } = await import("@/lib/viajes/paradas");
    const { arrancarParadas } = await import("@/lib/viajes/motor");
    const solicitante = await db.usuario.findFirstOrThrow({ where: { rol: "RESPONSABLE_OBRA", activo: true }, select: { id: true } });
    // Otro vehículo que el de recorrido.test (corren en paralelo y un vehículo no puede tener dos viajes en curso).
    const vehiculo = await db.vehiculo.findFirstOrThrow({ where: { viajes: { none: { estado: "EN_CURSO" } } }, orderBy: { nombre: "desc" }, select: { id: true, kmActual: true } });
    const chofer = await db.usuario.create({ data: { nombre: "Chofer acción", email: `chofer-acc-${Date.now()}@signa.test`, passwordHash: "-", rol: "CHOFER" } });
    const obras = await Promise.all([OBRA_A, OBRA_B].map((p, i) => db.obra.create({ data: { nombre: `Acción ${i}`, codigo: `TEST-ACC-${i}-${Date.now()}`, direccion: "-", localidad: "-", latitud: p.lat, longitud: p.lng, estado: "FINALIZADA", radioGeocercaM: 150 } })));
    const pedidos = await Promise.all(obras.map((o) => db.pedidoViaje.create({
      data: {
        solicitanteId: solicitante.id, obraId: o.id, tipo: "LLEVAR_A_OBRA", descripcion: `Para ${o.nombre}`, paraCuando: new Date(),
        origenTipo: "DEPOSITO", origenId: "dep-prueba", origenNombre: "Depósito prueba", origenDireccion: "-", origenLat: DEP.lat, origenLng: DEP.lng,
        destinoNombre: `Obra ${o.nombre}`, destinoDireccion: "-", destinoLat: o.latitud, destinoLng: o.longitud, estado: "EN_VIAJE", tomadoPorId: chofer.id, tomadoEn: new Date(),
      },
    })));
    const viajeId = await db.$transaction(async (tx) => {
      const id = await crearViaje(tx, { pedidoIds: pedidos.map((p) => p.id), vehiculoId: vehiculo.id, choferId: chofer.id, salidaEstimada: new Date(), ordenRuta: null });
      await tx.viaje.update({ where: { id }, data: { estado: "EN_CURSO", etapa: "HACIA_RETIRO", inicioEn: new Date(), kmSalida: vehiculo.kmActual } });
      await arrancarParadas(tx, id, null, new Date());
      return id;
    });
    const paradas = (await db.viajeParada.findMany({ where: { viajeId }, orderBy: { orden: "asc" } })).map((p) => p.id);
    f = { obras: obras.map((o) => o.id), pedidos: pedidos.map((p) => p.id), viajeId, choferId: chofer.id, paradas };
  });

  afterAll(async () => {
    if (f) {
      await db.tokenAccion.deleteMany({ where: { viajeId: f.viajeId } });
      await db.posicionVehiculo.deleteMany({ where: { viajeId: f.viajeId } });
      await db.recordatorio.deleteMany({ where: { usuarioId: f.choferId } });
      await db.itemParada.deleteMany({ where: { parada: { viajeId: f.viajeId } } });
      await db.viajePedido.deleteMany({ where: { viajeId: f.viajeId } });
      await db.viajeParada.deleteMany({ where: { viajeId: f.viajeId } });
      await db.pedidoViaje.updateMany({ where: { id: { in: f.pedidos } }, data: { viajeId: null } });
      await db.viaje.delete({ where: { id: f.viajeId } });
      await db.pedidoViaje.deleteMany({ where: { id: { in: f.pedidos } } });
      await db.obra.deleteMany({ where: { id: { in: f.obras } } });
      await db.usuario.update({ where: { id: f.choferId }, data: { activo: false } });
    }
    await db.$disconnect();
  });

  it("'Todavía no' deshace la llegada que marcó el GPS; el mismo token no sirve dos veces", async () => {
    const { llegarAParada } = await import("@/lib/viajes/motor");
    await llegarAParada(f!.viajeId, f!.paradas[0], new Date(), { porGps: true, distanciaM: 20, velocidadKmh: 0, fuente: "MOCK" });
    expect((await estados())[0]).toBe("LLEGO");
    const t = await token("LLEGADA", f!.paradas[0]);
    const r = await responder("todavia_no", t);
    expect(r).toMatchObject({ ok: true, status: 200 });
    expect((await estados())[0]).toBe("EN_CAMINO");
    expect((await responder("todavia_no", t)).status).toBe(410);
    const audit = await db.auditoria.findFirst({ where: { entidadId: { in: f!.pedidos }, accion: { startsWith: "viaje.llegada.rechazada" } }, orderBy: { fecha: "desc" } });
    expect(audit?.accion).toBe("viaje.llegada.rechazada.notificacion");
  });

  it("'Sí, llegué' confirma (queda en la auditoría con origen NOTIFICACION)", async () => {
    const { llegarAParada } = await import("@/lib/viajes/motor");
    await db.viaje.update({ where: { id: f!.viajeId }, data: { motor: {} } }); // sin el rechazo anterior
    await llegarAParada(f!.viajeId, f!.paradas[0], new Date(), { porGps: true, distanciaM: 20, velocidadKmh: 0, fuente: "MOCK" });
    const r = await responder("si_llegue", await token("LLEGADA", f!.paradas[0]));
    expect(r.ok).toBe(true);
    expect(r.mensaje).toMatch(/^Listo, avisamos a /);
    expect(await db.auditoria.count({ where: { entidadId: { in: f!.pedidos }, accion: "viaje.llegada.confirmada.notificacion" } })).toBe(1);
  });

  it("'Sigo acá' deshace la salida que marcó el GPS; un token de llegada no sirve para la salida; uno vencido tampoco", async () => {
    const { salirDeParada } = await import("@/lib/viajes/motor");
    await salirDeParada(f!.viajeId, f!.paradas[0], new Date(), { porGps: true, distanciaM: 400, velocidadKmh: 25, fuente: "MOCK" });
    expect((await estados()).slice(0, 2)).toEqual(["COMPLETADA", "EN_CAMINO"]);
    expect((await responder("sigo_aca", await token("LLEGADA", f!.paradas[0]))).status).toBe(403);
    expect((await responder("sigo_aca", await token("SALIDA", f!.paradas[0], { venceEnMs: -1000 }))).status).toBe(410);
    const r = await responder("sigo_aca", await token("SALIDA", f!.paradas[0]));
    expect(r.ok).toBe(true);
    expect((await estados()).slice(0, 2)).toEqual(["LLEGO", "PENDIENTE"]);
  });
});
