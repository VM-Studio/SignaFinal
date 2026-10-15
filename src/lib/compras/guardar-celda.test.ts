import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Map() }));
vi.mock("@/lib/notificaciones/enviar", () => ({ notificarEvento: async () => undefined }));

/**
 * EDICIÓN COMPARTIDA (con base): el guardado por celda con número de versión. Dos personas guardan la misma
 * celda con la misma versión: la primera gana y la segunda recibe el valor de la primera ("Alejandra cambió
 * esto…") sin pisarlo. También: quien no puede editar una celda no la cambia, y cada guardado deja su historia.
 */
const db = new PrismaClient();
const hayBase = !!process.env.DATABASE_URL;
let f: { obraId: string; ocId: string; daniela: { id: string; nombre: string; rol: "RESPONSABLE_OBRA" }; compras: { id: string; nombre: string; rol: "COMPRAS" } } | null = null;

describe.skipIf(!hayBase).sequential("guardar una celda del documento (con base)", () => {
  beforeAll(async () => {
    const [d, c] = await Promise.all([
      db.usuario.findFirstOrThrow({ where: { rol: "RESPONSABLE_OBRA", activo: true }, select: { id: true, nombre: true } }),
      db.usuario.findFirstOrThrow({ where: { rol: "COMPRAS", activo: true }, select: { id: true, nombre: true } }),
    ]);
    const obra = await db.obra.create({ data: { nombre: "Prueba celdas", codigo: `TEST-CELDA-${Date.now()}`, direccion: "-", localidad: "-", latitud: 0, longitud: 0, estado: "ACTIVA" } });
    await db.responsableObra.create({ data: { obraId: obra.id, usuarioId: d.id } });
    const oc = await db.ordenCompra.create({ data: { tipo: "OC", estado: "EN_COMPRAS", obraId: obra.id, solicitanteId: d.id, creadaPorId: d.id, detallePedido: "40 - bolsas de cemento" } });
    f = { obraId: obra.id, ocId: oc.id, daniela: { ...d, rol: "RESPONSABLE_OBRA" }, compras: { ...c, rol: "COMPRAS" } };
  });

  afterAll(async () => {
    if (f) {
      await db.ordenCompra.deleteMany({ where: { id: f.ocId } });
      await db.responsableObra.deleteMany({ where: { obraId: f.obraId } });
      await db.obra.delete({ where: { id: f.obraId } });
    }
    await db.$disconnect();
  });

  it("guarda la celda, sube su versión y deja la historia (quién, cuándo, valor anterior)", async () => {
    const { guardarCeldaComo } = await import("./guardar-celda");
    const { resultado } = await guardarCeldaComo(f!.daniela, f!.ocId, "proveedorSugerido", "Corralón San Martín", 0);
    expect(resultado.conflicto).toBe(false);
    expect(resultado.version).toBe(1);
    const c = await db.cambioCelda.findFirstOrThrow({ where: { ordenCompraId: f!.ocId, celda: "proveedorSugerido" } });
    expect(c).toMatchObject({ version: 1, anterior: null, nuevo: "Corralón San Martín", usuarioId: f!.daniela.id });
  });

  it("conflicto: dos guardan la misma versión al mismo tiempo; uno gana y el otro ve lo del primero sin pisarlo", async () => {
    const { guardarCeldaComo } = await import("./guardar-celda");
    const [a, b] = await Promise.all([
      guardarCeldaComo(f!.compras, f!.ocId, "detalleDelPedido", "40 - bolsas de cemento Loma Negra", 0),
      guardarCeldaComo(f!.daniela, f!.ocId, "detalleDelPedido", "40 - bolsas de cemento\n20 - barras del 8", 0),
    ]);
    const resultados = [a.resultado, b.resultado];
    const ganador = resultados.find((r) => !r.conflicto)!;
    const perdedor = resultados.find((r) => r.conflicto)!;
    expect(ganador).toBeTruthy();
    expect(perdedor).toBeTruthy();
    expect(perdedor.version).toBe(1);
    // El que perdió recibe el valor guardado por el otro, con quién fue.
    expect(perdedor.valor).toBe(ganador.valor);
    if (perdedor.conflicto) expect(perdedor.por.length).toBeGreaterThan(0);
    const oc = await db.ordenCompra.findUniqueOrThrow({ where: { id: f!.ocId }, select: { detallePedido: true, versionesCeldas: true } });
    expect(oc.detallePedido).toBe(ganador.valor);
    expect((oc.versionesCeldas as Record<string, number>).detalleDelPedido).toBe(1);
  });

  it("con la versión al día, el que perdió puede volver a guardar (versión 2)", async () => {
    const { guardarCeldaComo } = await import("./guardar-celda");
    const { resultado } = await guardarCeldaComo(f!.daniela, f!.ocId, "detalleDelPedido", "40 - bolsas de cemento\n20 - barras del 8", 1);
    expect(resultado.conflicto).toBe(false);
    expect(resultado.version).toBe(2);
  });

  it("quien no puede editar una celda no la cambia (la arquitecta y el Proveedor Final)", async () => {
    const { guardarCeldaComo } = await import("./guardar-celda");
    await expect(guardarCeldaComo(f!.daniela, f!.ocId, "proveedorFinal", "", 0)).rejects.toThrow(/Compras/);
    await expect(guardarCeldaComo(f!.daniela, f!.ocId, "nDeOrden", "OC-1", 0)).rejects.toThrow(/sistema/);
  });
});
