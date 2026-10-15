/**
 * RENDIMIENTO DEL TABLERO (solo en la base de desarrollo): carga 2.000 órdenes de prueba, mide cuánto
 * tarda el servidor en armar el tablero (por defecto, con filtros, una página del medio, buscando) y la
 * exportación a Excel, y borra los datos de prueba. Objetivo: menos de 1 s.
 *
 *   DATABASE_URL=… npx tsx scripts/rendimiento-tablero.ts [http://localhost:3100]
 */
import { PrismaClient, Prisma, type EstadoTablero } from "@prisma/client";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3100";
const MARCA = "PRUEBA-RENDIMIENTO";
const N = 2000;
const db = new PrismaClient();

async function cargar() {
  const [obras, usuarios, proveedores, creador] = await Promise.all([
    db.obra.findMany({ select: { id: true } }),
    db.usuario.findMany({ where: { rol: { in: ["RESPONSABLE_OBRA", "CAPATAZ"] } }, select: { id: true } }),
    db.proveedor.findMany({ select: { id: true } }),
    db.usuario.findFirstOrThrow({ where: { rol: "COMPRAS" }, select: { id: true } }),
  ]);
  const estados: EstadoTablero[] = ["PEDIR_AUTORIZACION", "AUTORIZADA", "SOLICITUD_PRESUPUESTO", "ENCARGADO", "ENTREGADO", "ENTREGADO", "ENTREGADO", "ANULADA"];
  const materiales = ["bolsas de cemento", "barras del 8", "rollos de malla", "m³ de hormigón H25", "placas de durlock", "caños de PVC 110", "latas de pintura"];
  const datos: Prisma.OrdenCompraCreateManyInput[] = Array.from({ length: N }, (_, i) => {
    const e = estados[i % estados.length];
    const dia = new Date(Date.UTC(2025, 0, 1) + (i % 600) * 86_400_000);
    return {
      tipo: i % 7 === 0 ? "PE" : "OC", numero: `${i % 7 === 0 ? "PE" : "OC"}-R${i + 1}`, numeroTexto: `R${i + 1}`, fuente: "IMPORTADA",
      estado: e === "ANULADA" ? "ANULADA" : e === "PEDIR_AUTORIZACION" ? "ESPERANDO_AUTORIZACION" : e === "SOLICITUD_PRESUPUESTO" ? "EN_COMPRAS" : e === "ENTREGADO" ? "ENTREGADA" : e === "ENCARGADO" ? "ENCARGADA" : "AUTORIZADA",
      estadoTablero: e, estadoTableroAuto: e, fecha: dia, fechaNecesaria: new Date(dia.getTime() + 7 * 86_400_000),
      fechaEntrega: e === "ENTREGADO" ? new Date(dia.getTime() + 10 * 86_400_000) : null,
      obraId: obras[i % obras.length].id, solicitanteId: usuarios[i % usuarios.length]?.id ?? null, proveedorId: proveedores.length ? proveedores[i % proveedores.length].id : null,
      importe: new Prisma.Decimal(10_000 + ((i * 7919) % 5_000_000)), detallePedido: `${(i % 50) + 1} - ${materiales[i % materiales.length]}\n${(i % 9) + 1} - ${materiales[(i + 3) % materiales.length]}`,
      proximosPasos: i % 3 === 0 ? "Esperando que avise el proveedor" : null, comentarios: MARCA, creadaPorId: creador.id,
    };
  });
  for (let i = 0; i < datos.length; i += 500) await db.ordenCompra.createMany({ data: datos.slice(i, i + 500) });
}

async function medir() {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(() => sessionStorage.setItem("signa:splash-visto", "1"));
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`);
  await p.fill("#email", "compras@signa.demo");
  await p.fill("#password", "signa2026");
  await p.click('button[type="submit"]');
  await p.waitForURL("**/inicio", { timeout: 60_000 });
  const obra = (await db.obra.findFirstOrThrow({ select: { id: true } })).id;
  const casos: [string, string][] = [
    ["por defecto (caducidad)", "/compras/tablero"],
    ["filtrado: obra + Entregado", `/compras/tablero?obra=${obra}&estado=ENTREGADO`],
    ["página 20", "/compras/tablero?pagina=20"],
    ["buscando 'cemento'", "/compras/tablero?q=cemento"],
    ["orden por importe", "/compras/tablero?orden=importe-desc"],
  ];
  const resultados: { caso: string; servidorMs: number; totalMs: number }[] = [];
  for (const [caso, ruta] of casos) {
    await p.goto(`${BASE}${ruta}`); // calentar
    const tiempos: { servidor: number; total: number }[] = [];
    for (let k = 0; k < 3; k++) {
      const t0 = Date.now();
      const r = await p.goto(`${BASE}${ruta}`, { waitUntil: "domcontentloaded" });
      const tim = r?.request().timing();
      tiempos.push({ servidor: tim ? tim.responseStart - tim.requestStart : NaN, total: Date.now() - t0 });
    }
    const med = (xs: number[]) => xs.sort((a, b) => a - b)[1];
    resultados.push({ caso, servidorMs: Math.round(med(tiempos.map((t) => t.servidor))), totalMs: med(tiempos.map((t) => t.total)) });
  }
  const t0 = Date.now();
  const r = await ctx.request.get(`${BASE}/api/compras/tablero/exportar`);
  const cuerpo = await r.body();
  const exportarMs = Date.now() - t0;
  await nav.close();
  return { resultados, exportar: { ms: exportarMs, kb: Math.round(cuerpo.length / 1024), ok: r.ok() } };
}

(async () => {
  if (!/signa_v2_dev/.test(process.env.DATABASE_URL ?? "")) throw new Error("Solo contra la base de desarrollo (signa_v2_dev).");
  await db.ordenCompra.deleteMany({ where: { comentarios: MARCA } });
  try {
    await cargar();
    console.log(`Cargadas ${N} órdenes de prueba (total en el tablero: ${await db.ordenCompra.count()}).`);
    const m = await medir();
    for (const x of m.resultados) console.log(`${x.caso.padEnd(28)} servidor ${String(x.servidorMs).padStart(4)} ms · página completa ${x.totalMs} ms ${x.servidorMs < 1000 ? "✓" : "✗ (más de 1 s)"}`);
    console.log(`Exportar a Excel (${N}+ filas): ${m.exportar.ms} ms · ${m.exportar.kb} KB · ${m.exportar.ok ? "ok" : "falló"}`);
  } finally {
    const b = await db.ordenCompra.deleteMany({ where: { comentarios: MARCA } });
    console.log(`Borradas ${b.count} órdenes de prueba.`);
    await db.$disconnect();
  }
})();
