import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { emitirCambio, eventosDesde, limpiarEventos, ultimoEvento, yaEntregados } from "./tiempo-real";
import { abrirStream } from "./tiempo-real-stream";

/**
 * Stream de tiempo real contra la base: entrega en orden, reconexión con Last-Event-ID sin perder ni
 * repetir, y nunca eventos de otro usuario. Usa dos usuarios de prueba (quedan inactivos al final).
 */
const db = new PrismaClient();
const hayBase = !!process.env.DATABASE_URL;
let a = "";
let b = "";

/** Lee el stream hasta que corta y devuelve los eventos "cambio" con su id. */
async function leer(r: Response) {
  const texto = await r.text();
  return texto
    .split("\n\n")
    .filter((m) => m.includes("event: cambio"))
    .map((m) => ({ id: Number(m.match(/^id: (\d+)/m)![1]), ...JSON.parse(m.match(/^data: (.*)$/m)![1]) }));
}

describe.skipIf(!hayBase)("tiempo real (con base)", () => {
  beforeAll(async () => {
    const t = Date.now();
    a = (await db.usuario.create({ data: { nombre: "TR A", email: `tr-a-${t}@signa.test`, passwordHash: "-", rol: "RESPONSABLE_OBRA" } })).id;
    b = (await db.usuario.create({ data: { nombre: "TR B", email: `tr-b-${t}@signa.test`, passwordHash: "-", rol: "RESPONSABLE_OBRA" } })).id;
  });
  afterAll(async () => {
    await db.eventoCambio.deleteMany({ where: { usuarioId: { in: [a, b] } } });
    await db.usuario.updateMany({ where: { id: { in: [a, b] } }, data: { activo: false } });
    await db.$disconnect();
  });

  it("entrega en orden lo que llega mientras está conectado, y solo lo del usuario", async () => {
    const desde = await ultimoEvento(a);
    const respuesta = abrirStream({ usuarioId: a, desde, cadaMs: 100, duracionMs: 1_500 });
    await emitirCambio([a], "PEDIDO_VIAJE", "p1", "pedido.crear");
    await emitirCambio([b], "PEDIDO_VIAJE", "p-de-b", "pedido.crear"); // de otro usuario: no
    await new Promise((ok) => setTimeout(ok, 300));
    await emitirCambio([a, b], "VIAJE", "p1", "viaje.iniciar");
    await emitirCambio([a], "AVISO", "n1", "VIAJE_INICIADO");
    const eventos = await leer(respuesta);
    expect(eventos.map((e) => `${e.entidad}:${e.entidadId}`)).toEqual(["PEDIDO_VIAJE:p1", "VIAJE:p1", "AVISO:n1"]);
    expect(eventos.map((e) => e.id)).toEqual([...eventos.map((e) => e.id)].sort((x, y) => x - y));
    expect(eventos.some((e) => e.entidadId === "p-de-b")).toBe(false);
  });

  it("reconexión con Last-Event-ID: solo lo nuevo, sin perder lo que llegó mientras estaba desconectado", async () => {
    const ultimo = await ultimoEvento(a); // el último que recibió antes del corte
    await emitirCambio([a], "PEDIDO_VIAJE", "p2", "pedido.tomar"); // llega con el stream cortado
    const eventos = await leer(abrirStream({ usuarioId: a, desde: ultimo, cadaMs: 100, duracionMs: 400 }));
    expect(eventos.map((e) => e.entidadId)).toEqual(["p2"]);
  });

  it("lo ya entregado antes del corte no se repite; lo de otro usuario nunca aparece", async () => {
    const desde = await ultimoEvento(a);
    expect(await eventosDesde(a, desde, await yaEntregados(a, desde))).toEqual([]);
    const deB = await eventosDesde(b, 0, new Set());
    expect(deB.every((e) => e.entidadId !== "p1" || e.entidad === "VIAJE")).toBe(true);
    expect(deB.some((e) => e.entidadId === "n1")).toBe(false);
  });

  it("la limpieza borra solo lo de más de 24 h", async () => {
    await db.eventoCambio.create({ data: { usuarioId: a, entidad: "AVISO", entidadId: "viejo", accion: "x", fecha: new Date(Date.now() - 25 * 3600_000) } });
    await limpiarEventos();
    expect(await db.eventoCambio.count({ where: { usuarioId: a, entidadId: "viejo" } })).toBe(0);
    expect(await db.eventoCambio.count({ where: { usuarioId: a, entidadId: "p1" } })).toBeGreaterThan(0);
  });
});
