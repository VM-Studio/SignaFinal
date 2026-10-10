import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { anioArgentina, asignarNumeroOC, formatoOC } from "./numerar";

/**
 * Prueba contra la base (DATABASE_URL): 50 órdenes de compra enviadas a aprobación AL MISMO TIEMPO
 * no repiten ningún número. Usa un año de prueba (2099) y borra lo que crea.
 */
const db = new PrismaClient();
const ANIO = 2099;
const hayBase = !!process.env.DATABASE_URL;
let fixture: { obraId: string; usuarioId: string; pedidoId: string } | null = null;

describe.skipIf(!hayBase)("numeración de OC (con base)", () => {
  beforeAll(async () => {
    const usuario = await db.usuario.findFirstOrThrow({ select: { id: true } });
    const obra = await db.obra.create({ data: { nombre: "Prueba numeración", codigo: `TEST-OC-${Date.now()}`, direccion: "-", localidad: "-", latitud: 0, longitud: 0, estado: "FINALIZADA" } });
    const pedido = await db.pedidoMaterial.create({ data: { obraId: obra.id, solicitanteId: usuario.id, descripcion: "prueba", paraCuando: new Date() } });
    fixture = { obraId: obra.id, usuarioId: usuario.id, pedidoId: pedido.id };
    await db.numeradorOC.deleteMany({ where: { anio: ANIO } });
  });

  afterAll(async () => {
    if (fixture) {
      await db.ordenCompra.deleteMany({ where: { pedidoMaterialId: fixture.pedidoId } });
      await db.pedidoMaterial.delete({ where: { id: fixture.pedidoId } });
      await db.obra.delete({ where: { id: fixture.obraId } });
    }
    await db.numeradorOC.deleteMany({ where: { anio: ANIO } });
    await db.$disconnect();
  });

  it("50 OC enviadas en paralelo: 50 números distintos y seguidos", async () => {
    const f = fixture!;
    const ocs = await Promise.all(
      Array.from({ length: 50 }, () => db.ordenCompra.create({ data: { pedidoMaterialId: f.pedidoId, obraId: f.obraId, solicitanteId: f.usuarioId, creadaPorId: f.usuarioId }, select: { id: true } })),
    );
    const numeros = await Promise.all(
      ocs.map((oc) =>
        db.$transaction(async (tx) => {
          const n = await asignarNumeroOC(tx, oc.id, ANIO);
          await tx.ordenCompra.update({ where: { id: oc.id }, data: { estado: "ESPERANDO_APROBACION", enviadaEn: new Date() } });
          return n.numero;
        }, { timeout: 60_000, maxWait: 60_000 }),
      ),
    );
    expect(new Set(numeros).size).toBe(50);
    expect([...numeros].sort()).toEqual(Array.from({ length: 50 }, (_, i) => formatoOC(ANIO, i + 1)));
    expect((await db.numeradorOC.findUniqueOrThrow({ where: { anio: ANIO } })).ultimo).toBe(50);
  }, 120_000);

  it("una OC que ya tiene número lo conserva al reenviarse (no gasta otro)", async () => {
    const f = fixture!;
    const oc = await db.ordenCompra.create({ data: { pedidoMaterialId: f.pedidoId, obraId: f.obraId, solicitanteId: f.usuarioId, creadaPorId: f.usuarioId }, select: { id: true } });
    const a = await db.$transaction((tx) => asignarNumeroOC(tx, oc.id, ANIO));
    const b = await db.$transaction((tx) => asignarNumeroOC(tx, oc.id, ANIO));
    expect(b.numero).toBe(a.numero);
    expect((await db.numeradorOC.findUniqueOrThrow({ where: { anio: ANIO } })).ultimo).toBe(51);
  });
});

describe("formato del número", () => {
  it("OC-AAAA-NNNN con cuatro dígitos (y más si hace falta)", () => {
    expect(formatoOC(2026, 1)).toBe("OC-2026-0001");
    expect(formatoOC(2026, 12)).toBe("OC-2026-0012");
    expect(formatoOC(2026, 12345)).toBe("OC-2026-12345");
  });
  it("el año es el de Buenos Aires (el 31/12 a las 22 h de Argentina sigue siendo ese año)", () => {
    expect(anioArgentina(new Date("2027-01-01T01:00:00Z"))).toBe(2026);
    expect(anioArgentina(new Date("2027-01-01T03:30:00Z"))).toBe(2027);
  });
});
