import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { asignarNumeroOC, formatoOC, numeroCorto, siguienteNumero, subirNumerador } from "./numerar";

/**
 * Prueba contra la base (DATABASE_URL): 50 órdenes enviadas a aprobación AL MISMO TIEMPO no repiten
 * ningún número, y OC y PE llevan numeraciones separadas. Guarda y repone los numeradores reales.
 */
const db = new PrismaClient();
const hayBase = !!process.env.DATABASE_URL;
let fixture: { obraId: string; usuarioId: string; numeradores: { tipo: "OC" | "PE"; ultimo: number }[] } | null = null;

describe.skipIf(!hayBase).sequential("numeración por tipo (con base)", () => {
  beforeAll(async () => {
    const usuario = await db.usuario.findFirstOrThrow({ select: { id: true } });
    const obra = await db.obra.create({ data: { nombre: "Prueba numeración", codigo: `TEST-OC-${Date.now()}`, direccion: "-", localidad: "-", latitud: 0, longitud: 0, estado: "FINALIZADA" } });
    const numeradores = await db.numeradorOC.findMany();
    fixture = { obraId: obra.id, usuarioId: usuario.id, numeradores };
    // Números de prueba altos: no chocan con los reales.
    await db.numeradorOC.upsert({ where: { tipo: "OC" }, create: { tipo: "OC", ultimo: 900000 }, update: { ultimo: 900000 } });
    await db.numeradorOC.upsert({ where: { tipo: "PE" }, create: { tipo: "PE", ultimo: 800000 }, update: { ultimo: 800000 } });
  });

  afterAll(async () => {
    if (fixture) {
      await db.ordenCompra.deleteMany({ where: { obraId: fixture.obraId } });
      await db.obra.delete({ where: { id: fixture.obraId } });
      await db.numeradorOC.deleteMany();
      if (fixture.numeradores.length) await db.numeradorOC.createMany({ data: fixture.numeradores });
    }
    await db.$disconnect();
  });

  const nueva = (tipo: "OC" | "PE" = "OC") => {
    const f = fixture!;
    return db.ordenCompra.create({ data: { tipo, estado: "EN_COMPRAS", obraId: f.obraId, solicitanteId: f.usuarioId, creadaPorId: f.usuarioId }, select: { id: true } });
  };

  it("50 OC enviadas en paralelo: 50 números distintos y seguidos", async () => {
    const ocs = await Promise.all(Array.from({ length: 50 }, () => nueva()));
    const numeros = await Promise.all(
      ocs.map((oc) => db.$transaction((tx) => asignarNumeroOC(tx, oc.id).then((n) => n.numero), { timeout: 60_000, maxWait: 60_000 })),
    );
    expect(new Set(numeros).size).toBe(50);
    expect([...numeros].sort()).toEqual(Array.from({ length: 50 }, (_, i) => formatoOC("OC", 900001 + i)));
    expect((await db.numeradorOC.findUniqueOrThrow({ where: { tipo: "OC" } })).ultimo).toBe(900050);
  }, 120_000);

  it("los PE tienen su propia numeración (no tocan la de OC)", async () => {
    const pe = await nueva("PE");
    const n = await db.$transaction((tx) => asignarNumeroOC(tx, pe.id));
    expect(n.numero).toBe("PE-800001");
    expect((await db.numeradorOC.findUniqueOrThrow({ where: { tipo: "OC" } })).ultimo).toBe(900050);
  });

  it("una orden que ya tiene número lo conserva al reenviarse (no gasta otro)", async () => {
    const oc = await nueva();
    const a = await db.$transaction((tx) => asignarNumeroOC(tx, oc.id));
    const b = await db.$transaction((tx) => asignarNumeroOC(tx, oc.id));
    expect(b.numero).toBe(a.numero);
    expect((await db.numeradorOC.findUniqueOrThrow({ where: { tipo: "OC" } })).ultimo).toBe(900051);
  });

  it("el numerador solo sube: bajarlo no hace nada", async () => {
    expect(await db.$transaction((tx) => subirNumerador(tx, "OC", 10))).toBe(900051);
    expect(await db.$transaction((tx) => subirNumerador(tx, "OC", 900100))).toBe(900100);
    expect((await db.$transaction((tx) => siguienteNumero(tx, "OC"))).secuencia).toBe(900101);
  });
});

describe("formato del número", () => {
  it("OC-NNNN y PE-NNNN, cuatro dígitos (y más si hace falta), sin año", () => {
    expect(formatoOC("OC", 1)).toBe("OC-0001");
    expect(formatoOC("PE", 151)).toBe("PE-0151");
    expect(formatoOC("OC", 12345)).toBe("OC-12345");
    expect(formatoOC("OC", "41 B")).toBe("OC-41 B");
  });
  it("en el tablero, el número como lo escribe Compras", () => {
    expect(numeroCorto({ numeroTexto: "20 A", secuencia: null, numero: "OC-20 A" })).toBe("20 A");
    expect(numeroCorto({ numeroTexto: null, secuencia: 417, numero: "OC-0417" })).toBe("417");
  });
});
