import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("server-only", () => ({}));
const avisos: { nombre: string; titulo: string; cuerpo: string }[] = [];
vi.mock("@/lib/notificaciones/enviar", () => ({ notificarEvento: vi.fn(async (e: { nombre: string; titulo: string; cuerpo: string }) => { avisos.push(e); return []; }) }));

/**
 * Prueba contra la base (DATABASE_URL): un viaje aceptado programa sus recordatorios una sola vez,
 * el job los manda a su hora sin duplicar, y al iniciar (o reprogramar) se cancelan los pendientes.
 * Usa fechas de 2099 y un chofer de prueba; borra todo lo que crea.
 */
const db = new PrismaClient();
const hayBase = !!process.env.DATABASE_URL;
const ar = (dia: string, hhmm: string) => new Date(`${dia}T${hhmm}:00-03:00`);
let f: { obraId: string; choferId: string; pedidoId: string; viajeId: string } | null = null;

describe.skipIf(!hayBase)("recordatorios del chofer (con base)", () => {
  beforeAll(async () => {
    const { crearViaje } = await import("./paradas");
    const solicitante = await db.usuario.findFirstOrThrow({ where: { rol: { not: "CHOFER" } }, select: { id: true } });
    const vehiculo = await db.vehiculo.findFirstOrThrow({ select: { id: true } });
    const deposito = await db.ubicacion.findFirstOrThrow({ select: { id: true, nombre: true, direccion: true, latitud: true, longitud: true } });
    const chofer = await db.usuario.create({ data: { nombre: "Chofer prueba", email: `chofer-prueba-${Date.now()}@signa.test`, passwordHash: "-", rol: "CHOFER" } });
    const obra = await db.obra.create({ data: { nombre: "Prueba recordatorios", codigo: `TEST-REC-${Date.now()}`, direccion: "Darwin 1299", localidad: "CABA", latitud: -34.59, longitud: -58.44, estado: "FINALIZADA" } });
    const pedido = await db.pedidoViaje.create({
      data: {
        solicitanteId: solicitante.id, obraId: obra.id, tipo: "LLEVAR_A_OBRA", descripcion: "Prueba", paraCuando: ar("2099-03-10", "08:30"), franja: "HORA_EXACTA",
        origenTipo: "DEPOSITO", origenId: deposito.id, origenNombre: deposito.nombre, origenDireccion: deposito.direccion, origenLat: deposito.latitud, origenLng: deposito.longitud,
        destinoNombre: "Obra Prueba recordatorios", destinoDireccion: "Darwin 1299, CABA", destinoLat: -34.59, destinoLng: -58.44,
        estado: "TOMADO", tomadoPorId: chofer.id, tomadoEn: new Date(),
      },
    });
    const viajeId = await db.$transaction((tx) => crearViaje(tx, { pedidoIds: [pedido.id], vehiculoId: vehiculo.id, choferId: chofer.id, salidaEstimada: pedido.paraCuando, ordenRuta: null }));
    f = { obraId: obra.id, choferId: chofer.id, pedidoId: pedido.id, viajeId };
  });

  afterAll(async () => {
    if (f) {
      await db.recordatorio.deleteMany({ where: { usuarioId: f.choferId } });
      await db.itemParada.deleteMany({ where: { parada: { viajeId: f.viajeId } } });
      await db.viajePedido.deleteMany({ where: { viajeId: f.viajeId } });
      await db.viajeParada.deleteMany({ where: { viajeId: f.viajeId } });
      await db.pedidoViaje.update({ where: { id: f.pedidoId }, data: { viajeId: null } });
      await db.viaje.delete({ where: { id: f.viajeId } });
      await db.pedidoViaje.delete({ where: { id: f.pedidoId } });
      await db.obra.delete({ where: { id: f.obraId } });
      await db.usuario.delete({ where: { id: f.choferId } });
    }
    await db.$disconnect();
  });

  it("al aceptar se programan 6 (18:00, 7:00 y 4 'sin iniciar'), y programar de nuevo no duplica", async () => {
    const { programarRecordatorios } = await import("./recordatorios-agenda");
    expect(await db.recordatorio.count({ where: { usuarioId: f!.choferId } })).toBe(6);
    await programarRecordatorios(db, [f!.pedidoId]);
    expect(await db.recordatorio.count({ where: { usuarioId: f!.choferId } })).toBe(6);
  });

  it("el job manda el de las 18:00 una sola vez", async () => {
    const { enviarRecordatorios } = await import("./recordatorios");
    avisos.length = 0;
    const r1 = await enviarRecordatorios({ ahora: ar("2099-03-09", "18:00"), soloUsuarioId: f!.choferId });
    expect(r1.enviados).toBe(1);
    expect(avisos[0].cuerpo).toBe("Mañana tenés un retiro en " + (await db.pedidoViaje.findUniqueOrThrow({ where: { id: f!.pedidoId } })).origenNombre + " a las 8:30 para Obra Prueba recordatorios.");
    const r2 = await enviarRecordatorios({ ahora: ar("2099-03-09", "18:01"), soloUsuarioId: f!.choferId });
    expect(r2.enviados).toBe(0);
  });

  it("a la hora sin iniciar avisa; si se atrasa el cron, manda solo el último", async () => {
    const { enviarRecordatorios } = await import("./recordatorios");
    avisos.length = 0;
    // 7:00 y 8:30 juntos (el cron estuvo parado): uno de hoy y uno de "todavía no iniciaste".
    const r = await enviarRecordatorios({ ahora: ar("2099-03-10", "08:31"), soloUsuarioId: f!.choferId });
    expect(r.enviados).toBe(2);
    expect(avisos.map((a) => a.titulo)).toEqual(["Hoy tenés un viaje", "Todavía no iniciaste el viaje"]);
  });

  it("al iniciar (o reprogramar) se cancelan los pendientes y no sale nada más", async () => {
    const { cancelarRecordatorios } = await import("./recordatorios-agenda");
    const { enviarRecordatorios } = await import("./recordatorios");
    expect(await cancelarRecordatorios(db, [f!.pedidoId])).toBe(3);
    const r = await enviarRecordatorios({ ahora: ar("2099-03-10", "11:31"), soloUsuarioId: f!.choferId });
    expect(r.enviados).toBe(0);
  });
});
