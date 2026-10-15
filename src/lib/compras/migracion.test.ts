import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync, execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * MIGRACIÓN documento_compra_unificado, con datos de demo (con base): arma una base nueva en el estado de
 * ANTES (todas las migraciones menos esta), carga pedidos de material como los que había (uno nuevo con
 * adjunto y favorito, uno en compra con su borrador y una OC rechazada, uno habilitado con su OC aprobada y su
 * retiro, uno cancelado, y una orden importada del Excel), aplica la migración y revisa que cada pedido quedó
 * como documento con su historia, adjuntos, habilitaciones, número interno y estado. Después borra esa base.
 */
const MIGRACION = "20261015000000_documento_compra_unificado";
const URL_BASE = process.env.DATABASE_URL ?? "";
const tieneHerramientas = (() => {
  try {
    execSync("command -v createdb && command -v dropdb", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();
const NOMBRE = `signa_test_mig_${process.pid}`;
const URL = URL_BASE.replace(/\/([^/?]+)(\?|$)/, `/${NOMBRE}$2`);
const env = { ...process.env, DATABASE_URL: URL, DATABASE_URL_UNPOOLED: URL };
let db: PrismaClient;
let carpeta = "";

const q = <T = Record<string, unknown>>(sql: string) => db.$queryRawUnsafe<T[]>(sql);

describe.skipIf(!URL_BASE || !tieneHerramientas).sequential("migración documento_compra_unificado (con base)", () => {
  beforeAll(async () => {
    execFileSync("dropdb", ["--if-exists", NOMBRE], { env, stdio: "ignore" });
    execFileSync("createdb", [NOMBRE], { env, stdio: "ignore" });
    // Las migraciones de antes (sin la unificada) en una carpeta aparte.
    carpeta = mkdtempSync(join(tmpdir(), "signa-mig-"));
    mkdirSync(join(carpeta, "migrations"));
    cpSync("prisma/schema.prisma", join(carpeta, "schema.prisma"));
    cpSync("prisma/migrations/migration_lock.toml", join(carpeta, "migrations/migration_lock.toml"));
    for (const n of readdirSync("prisma/migrations")) {
      const d = join("prisma/migrations", n);
      if (statSync(d).isDirectory() && n !== MIGRACION) cpSync(d, join(carpeta, "migrations", n), { recursive: true });
    }
    execSync(`npx prisma migrate deploy --schema ${join(carpeta, "schema.prisma")}`, { env, stdio: "ignore" });
    db = new PrismaClient({ datasourceUrl: URL });

    // ── Datos de demo con el esquema de antes ──
    const demo = `
      INSERT INTO "Usuario" ("id","nombre","email","passwordHash","rol","actualizadoEn") VALUES
        ('u_dan','Daniela','dan@t','x','RESPONSABLE_OBRA',now()), ('u_com','Alejandra','com@t','x','COMPRAS',now()), ('u_dir','Dueño','dir@t','x','DIRECCION',now());
      INSERT INTO "Obra" ("id","nombre","codigo","direccion","localidad","latitud","longitud","actualizadoEn") VALUES ('o1','Darwin','D1','Darwin 1299','CABA',-34.6,-58.4,now());
      INSERT INTO "Proveedor" ("id","nombre") VALUES ('p1','Corralón San Martín');
      INSERT INTO "SucursalProveedor" ("id","proveedorId","nombre","direccion","localidad","latitud","longitud") VALUES ('s1','p1','Casa central','Av. X 1','CABA',-34.6,-58.45);
      INSERT INTO "OrdenCompra" ("id","creadaPorId","actualizadoEn","estado","obraId","detallePedido") VALUES ('oc2','u_com',now(),'BORRADOR','o1','40 - bolsas de cemento');
      INSERT INTO "OrdenCompra" ("id","creadaPorId","actualizadoEn","estado","obraId","numero","numeroTexto","secuencia","motivoRechazo","estadoTablero","estadoTableroAuto") VALUES ('oc2r','u_com',now(),'RECHAZADA','o1','OC-0009','9',9,'Muy caro','ANULADA','ANULADA');
      INSERT INTO "OrdenCompra" ("id","creadaPorId","actualizadoEn","estado","obraId","numero","numeroTexto","secuencia","proveedorId","sucursalId","importe","aprobadaPorId","aprobadaEn","encargadaEn","estadoTablero","estadoTableroAuto") VALUES ('oc3','u_com',now(),'APROBADA','o1','OC-0010','10',10,'p1','s1',1000,'u_dir',now(),now(),'ENCARGADO','ENCARGADO');
      INSERT INTO "OrdenCompra" ("id","creadaPorId","actualizadoEn","estado","numero","numeroTexto","fuente","obraTexto","estadoTablero","estadoTableroAuto") VALUES ('oc5','u_com',now(),'APROBADA','OC-41 B','41 B','IMPORTADA_EXCEL','PINARES','ENTREGADO','ENTREGADO');
      INSERT INTO "PedidoMaterial" ("id","numero","obraId","solicitanteId","descripcion","paraCuando","estado","observaciones","renglones","actualizadoEn","prioridad") VALUES
        ('pm1',1,'o1','u_dan','40 bolsas cemento','2026-10-20','SOLICITADO','Descargar por el portón','[{"descripcion":"cemento","cantidad":40,"unidad":"bolsas"}]',now(),'URGENTE');
      INSERT INTO "PedidoMaterial" ("id","numero","obraId","solicitanteId","descripcion","paraCuando","estado","tomadoPorId","tomadoEn","ordenCompraId","actualizadoEn") VALUES
        ('pm2',2,'o1','u_dan','Cemento','2026-10-21','EN_COMPRA','u_com',now(),'oc2',now()),
        ('pm3',3,'o1','u_dan','Hierro','2026-10-22','RETIRO_PEDIDO','u_com',now(),'oc3',now());
      INSERT INTO "PedidoMaterial" ("id","numero","obraId","solicitanteId","descripcion","paraCuando","estado","motivoCancelacion","actualizadoEn") VALUES ('pm4',4,'o1','u_dan','Arena','2026-10-23','CANCELADO','Ya no hace falta',now());
      UPDATE "OrdenCompra" SET "pedidoMaterialId" = 'pm2' WHERE "id" IN ('oc2','oc2r');
      UPDATE "OrdenCompra" SET "pedidoMaterialId" = 'pm3' WHERE "id" = 'oc3';
      INSERT INTO "CambioEstadoMaterial" ("id","pedidoMaterialId","de","a","usuarioId","fecha") VALUES
        ('c1','pm1',NULL,'SOLICITADO','u_dan',now()), ('c3a','pm3',NULL,'SOLICITADO','u_dan',now() - interval '2 day'),
        ('c3b','pm3','APROBADO','LISTO_PARA_RETIRAR','u_com',now() - interval '1 day'), ('c3c','pm3','LISTO_PARA_RETIRAR','RETIRO_PEDIDO','u_dan',now());
      INSERT INTO "MaterialListo" ("id","pedidoMaterialId","obraId","proveedorId","sucursalId","proveedorDireccion","proveedorLat","proveedorLng","descripcion","habilitadoPorId","estado") VALUES ('ml3','pm3','o1','p1','s1','Av. X 1',-34.6,-58.45,'Hierro','u_com','RETIRO_PEDIDO');
      INSERT INTO "Adjunto" ("id","entidadTipo","entidadId","nombre","url","tipoMime","tamanoBytes","subidoPorId") VALUES ('a1','PEDIDO_MATERIAL','pm1','lista.pdf','db:x','application/pdf',10,'u_dan');
      INSERT INTO "PedidoFavorito" ("id","usuarioId","tipo","nombre","pedidoId","datos") VALUES ('f1','u_dan','MATERIALES','Cemento de siempre','pm1','{}');
    `;
    for (const sql of demo.split(";\n").map((x) => x.trim()).filter(Boolean)) await db.$executeRawUnsafe(sql.replace(/;$/, ""));

    // ── La migración ──
    execSync(`npx prisma db execute --file prisma/migrations/${MIGRACION}/migration.sql --url "${URL}"`, { env, stdio: "pipe" });
  }, 180_000);

  afterAll(async () => {
    await db?.$disconnect();
    execFileSync("dropdb", ["--if-exists", NOMBRE], { env, stdio: "ignore" });
    if (carpeta && existsSync(carpeta)) rmSync(carpeta, { recursive: true, force: true });
  });

  it("ya no existe el pedido de material", async () => {
    const t = await q<{ n: bigint }>(`SELECT count(*) AS n FROM information_schema.tables WHERE table_name IN ('PedidoMaterial','CambioEstadoMaterial')`);
    expect(Number(t[0].n)).toBe(0);
  });

  it("un pedido sin OC es un documento con el mismo id, su detalle, adjunto, renglones, historia y favorito", async () => {
    const [d] = await q(`SELECT "estado"::text, "detallePedido", "observacionesSolicitante", "numeroInterno", "fuente"::text, "prioridad"::text, "obraId", "solicitanteId" FROM "OrdenCompra" WHERE "id" = 'pm1'`);
    expect(d).toMatchObject({ estado: "ENVIADA_A_COMPRAS", detallePedido: "40 bolsas cemento", observacionesSolicitante: "Descargar por el portón", numeroInterno: 1, fuente: "ARQUITECTA", prioridad: "URGENTE", obraId: "o1", solicitanteId: "u_dan" });
    expect((await q(`SELECT 1 FROM "Adjunto" WHERE "id" = 'a1' AND "entidadTipo"::text = 'ORDEN_COMPRA' AND "entidadId" = 'pm1'`)).length).toBe(1);
    expect((await q(`SELECT 1 FROM "RenglonOC" WHERE "ordenCompraId" = 'pm1'`)).length).toBe(1);
    expect((await q(`SELECT "a"::text FROM "CambioEstadoOC" WHERE "ordenCompraId" = 'pm1'`))[0]).toMatchObject({ a: "ENVIADA_A_COMPRAS" });
    expect((await q(`SELECT 1 FROM "PedidoFavorito" WHERE "pedidoId" = 'pm1'`)).length).toBe(1);
  });

  it("un pedido con OC vigente se funde en ella (número interno del pedido, responsable de Compras)", async () => {
    const [d] = await q(`SELECT "estado"::text, "numeroInterno", "tomadoPorId", "fuente"::text FROM "OrdenCompra" WHERE "id" = 'oc2'`);
    expect(d).toMatchObject({ estado: "EN_COMPRAS", numeroInterno: 2, tomadoPorId: "u_com" });
    const [r] = await q(`SELECT "estado"::text, "estadoTablero"::text FROM "OrdenCompra" WHERE "id" = 'oc2r'`);
    expect(r).toMatchObject({ estado: "RECHAZADA", estadoTablero: "ANULADA" });
  });

  it("el habilitado queda HABILITADA, con su retiro y su historia en el documento", async () => {
    const [d] = await q(`SELECT "estado"::text, "estadoTablero"::text, "numeroInterno", "numero" FROM "OrdenCompra" WHERE "id" = 'oc3'`);
    expect(d).toMatchObject({ estado: "HABILITADA", estadoTablero: "HABILITADA", numeroInterno: 3, numero: "OC-0010" });
    expect((await q(`SELECT "ordenCompraId" FROM "MaterialListo" WHERE "id" = 'ml3'`))[0]).toMatchObject({ ordenCompraId: "oc3" });
    expect((await q(`SELECT 1 FROM "CambioEstadoOC" WHERE "ordenCompraId" = 'oc3'`)).length).toBe(3);
  });

  it("el cancelado queda ANULADA con el motivo; la importada queda ENTREGADA e IMPORTADA", async () => {
    expect((await q(`SELECT "estado"::text, "motivoAnulacion" FROM "OrdenCompra" WHERE "id" = 'pm4'`))[0]).toMatchObject({ estado: "ANULADA", motivoAnulacion: "Ya no hace falta" });
    expect((await q(`SELECT "estado"::text, "fuente"::text, "estadoTablero"::text FROM "OrdenCompra" WHERE "id" = 'oc5'`))[0]).toMatchObject({ estado: "ENTREGADA", fuente: "IMPORTADA", estadoTablero: "ENTREGADO" });
  });

  it("el número interno no se repite y sigue después del mayor", async () => {
    const [n] = await q<{ total: bigint; distintos: bigint; max: number }>(`SELECT count(*) AS total, count(DISTINCT "numeroInterno") AS distintos, max("numeroInterno") AS max FROM "OrdenCompra"`);
    expect(Number(n.total)).toBe(6);
    expect(Number(n.distintos)).toBe(6);
    await db.$executeRawUnsafe(`INSERT INTO "OrdenCompra" ("id","creadaPorId","actualizadoEn") VALUES ('nuevo','u_dan',now())`);
    const [x] = await q<{ numeroInterno: number }>(`SELECT "numeroInterno" FROM "OrdenCompra" WHERE "id" = 'nuevo'`);
    expect(x.numeroInterno).toBeGreaterThan(n.max);
  });
});
