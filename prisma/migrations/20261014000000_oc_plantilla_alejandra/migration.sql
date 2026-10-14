-- CreateEnum
CREATE TYPE "TipoOrden" AS ENUM ('OC', 'PE');

-- CreateEnum
CREATE TYPE "FormaPago" AS ENUM ('TRANSFERENCIA', 'ECHEQ', 'EFECTIVO', 'CUENTA_CORRIENTE');

-- CreateEnum
CREATE TYPE "CondicionPago" AS ENUM ('ACOPIO', 'ANTICIPO', 'SALDO_30_DIAS', 'CONTRA_ENTREGA', 'OTRA');

-- CreateEnum
CREATE TYPE "EstadoTablero" AS ENUM ('PEDIR_AUTORIZACION', 'AUTORIZADA', 'SOLICITUD_PRESUPUESTO', 'ENCARGADO', 'ENTREGADO', 'ANULADA');

-- CreateEnum
CREATE TYPE "SemaforoPE" AS ENUM ('NADA_TODAVIA', 'EN_PROCESO', 'LISTA', 'ANULADA');

-- CreateEnum
CREATE TYPE "FuenteOC" AS ENUM ('SISTEMA', 'IMPORTADA_EXCEL');

-- DropForeignKey
ALTER TABLE "OrdenCompra" DROP CONSTRAINT "OrdenCompra_obraId_fkey";

-- DropForeignKey
ALTER TABLE "OrdenCompra" DROP CONSTRAINT "OrdenCompra_pedidoMaterialId_fkey";

-- DropForeignKey
ALTER TABLE "OrdenCompra" DROP CONSTRAINT "OrdenCompra_solicitanteId_fkey";

-- NumeradorOC: de "por año" a "por tipo" (OC, PE), sin año, como la planilla de Alejandra.
-- El de OC sigue después del mayor número ya usado (las OC-AAAA-NNNN existentes conservan su número).
CREATE TEMP TABLE "_ultimo_oc" AS SELECT COALESCE(MAX("ultimo"), 0) AS "ultimo" FROM "NumeradorOC";
DELETE FROM "NumeradorOC";
ALTER TABLE "NumeradorOC" DROP CONSTRAINT "NumeradorOC_pkey",
DROP COLUMN "anio",
ADD COLUMN     "tipo" "TipoOrden" NOT NULL,
ADD CONSTRAINT "NumeradorOC_pkey" PRIMARY KEY ("tipo");
INSERT INTO "NumeradorOC" ("tipo", "ultimo") SELECT 'OC', "ultimo" FROM "_ultimo_oc";
INSERT INTO "NumeradorOC" ("tipo", "ultimo") VALUES ('PE', 0);
DROP TABLE "_ultimo_oc";

-- AlterTable
ALTER TABLE "Obra" ADD COLUMN     "razonSocialId" TEXT;

-- AlterTable (columnas nuevas primero; método de pago y condiciones se pasan antes de borrarlas)
ALTER TABLE "OrdenCompra" ADD COLUMN     "comentarios" TEXT,
ADD COLUMN     "condicionPago" "CondicionPago",
ADD COLUMN     "condicionPagoTexto" TEXT,
ADD COLUMN     "cotizacionUsd" DECIMAL(12,2),
ADD COLUMN     "detallePedido" TEXT,
ADD COLUMN     "empresaCompraId" TEXT,
ADD COLUMN     "empresaFacturarId" TEXT,
ADD COLUMN     "encargadaEn" TIMESTAMP(3),
ADD COLUMN     "estadoTablero" "EstadoTablero",
ADD COLUMN     "estadoTableroAuto" "EstadoTablero",
ADD COLUMN     "facturaAdjuntoId" TEXT,
ADD COLUMN     "facturaCondicion" "CondicionPago",
ADD COLUMN     "facturaFecha" DATE,
ADD COLUMN     "facturaFormaPago" "FormaPago",
ADD COLUMN     "facturaImporte" DECIMAL(14,2),
ADD COLUMN     "facturaNumero" TEXT,
ADD COLUMN     "fechaEntrega" DATE,
ADD COLUMN     "fechaPago" DATE,
ADD COLUMN     "formaPago" "FormaPago",
ADD COLUMN     "fuente" "FuenteOC" NOT NULL DEFAULT 'SISTEMA',
ADD COLUMN     "importe" DECIMAL(14,2),
ADD COLUMN     "importeAConfirmar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "numeroTexto" TEXT,
ADD COLUMN     "obraTexto" TEXT,
ADD COLUMN     "ordenPagoAutorizadaEn" TIMESTAMP(3),
ADD COLUMN     "ordenPagoAutorizadaPorId" TEXT,
ADD COLUMN     "pagoImporte" DECIMAL(14,2),
ADD COLUMN     "pagoObservaciones" TEXT,
ADD COLUMN     "presupuestoNumero" TEXT,
ADD COLUMN     "proveedorSugerido" TEXT,
ADD COLUMN     "proximosPasos" TEXT,
ADD COLUMN     "semaforoPE" "SemaforoPE",
ADD COLUMN     "solicitadoPorTexto" TEXT,
ADD COLUMN     "solicitanteExternoId" TEXT,
ADD COLUMN     "tipo" "TipoOrden" NOT NULL DEFAULT 'OC',
ADD COLUMN     "versionAprobacion" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "pedidoMaterialId" DROP NOT NULL,
ALTER COLUMN "obraId" DROP NOT NULL,
ALTER COLUMN "solicitanteId" DROP NOT NULL;

-- Datos existentes: método de pago → Forma de Pago / Condición de Pago (acopio es una condición).
UPDATE "OrdenCompra" SET "formaPago" = "metodoPago"::text::"FormaPago" WHERE "metodoPago" IS NOT NULL AND "metodoPago"::text <> 'ACOPIO';
UPDATE "OrdenCompra" SET "condicionPago" = 'ACOPIO' WHERE "metodoPago"::text = 'ACOPIO';
UPDATE "OrdenCompra" SET "condicionPagoTexto" = "condiciones", "condicionPago" = COALESCE("condicionPago", 'OTRA') WHERE "condiciones" IS NOT NULL AND "condiciones" <> '';
UPDATE "OrdenCompra" SET "importe" = "total", "numeroTexto" = "secuencia"::text WHERE "numero" IS NOT NULL;
-- Estado del tablero de las que ya existen (src/lib/compras/estadoTablero.ts lo mantiene de acá en más).
UPDATE "OrdenCompra" o SET "estadoTableroAuto" = (CASE
    WHEN o."estado" IN ('RECHAZADA', 'ANULADA') THEN 'ANULADA'
    WHEN o."estado" = 'ESPERANDO_APROBACION' THEN 'PEDIR_AUTORIZACION'
    WHEN o."estado" = 'APROBADA' AND p."estado" = 'ENTREGADO' THEN 'ENTREGADO'
    WHEN o."estado" = 'APROBADA' AND p."estado" IN ('LISTO_PARA_RETIRAR', 'RETIRO_PEDIDO', 'EN_CAMINO') THEN 'ENCARGADO'
    WHEN o."estado" = 'APROBADA' THEN 'AUTORIZADA'
    ELSE NULL END)::"EstadoTablero"
  FROM "PedidoMaterial" p WHERE p."id" = o."pedidoMaterialId";
UPDATE "OrdenCompra" SET "estadoTablero" = "estadoTableroAuto";
ALTER TABLE "OrdenCompra" DROP COLUMN "condiciones", DROP COLUMN "metodoPago";

-- AlterTable
ALTER TABLE "PedidoMaterial" ADD COLUMN     "presupuestoSolicitado" BOOLEAN NOT NULL DEFAULT false;

-- DropEnum
DROP TYPE "MetodoPago";

-- CreateTable
CREATE TABLE "RazonSocial" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RazonSocial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitanteExterno" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SolicitanteExterno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RazonSocial_cuit_key" ON "RazonSocial"("cuit");

-- CreateIndex
CREATE INDEX "RazonSocial_activa_orden_idx" ON "RazonSocial"("activa", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "SolicitanteExterno_nombre_key" ON "SolicitanteExterno"("nombre");

-- CreateIndex
CREATE INDEX "OrdenCompra_estadoTablero_fechaNecesaria_idx" ON "OrdenCompra"("estadoTablero", "fechaNecesaria");

-- CreateIndex
CREATE INDEX "OrdenCompra_tipo_secuencia_idx" ON "OrdenCompra"("tipo", "secuencia");

-- CreateIndex
CREATE INDEX "OrdenCompra_fecha_idx" ON "OrdenCompra"("fecha");

-- CreateIndex
CREATE INDEX "OrdenCompra_solicitanteId_idx" ON "OrdenCompra"("solicitanteId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCompra_tipo_numeroTexto_key" ON "OrdenCompra"("tipo", "numeroTexto");

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_razonSocialId_fkey" FOREIGN KEY ("razonSocialId") REFERENCES "RazonSocial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_pedidoMaterialId_fkey" FOREIGN KEY ("pedidoMaterialId") REFERENCES "PedidoMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_solicitanteExternoId_fkey" FOREIGN KEY ("solicitanteExternoId") REFERENCES "SolicitanteExterno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_empresaCompraId_fkey" FOREIGN KEY ("empresaCompraId") REFERENCES "RazonSocial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_empresaFacturarId_fkey" FOREIGN KEY ("empresaFacturarId") REFERENCES "RazonSocial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_ordenPagoAutorizadaPorId_fkey" FOREIGN KEY ("ordenPagoAutorizadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Datos estructurales (también en producción): las cuatro razones sociales de la planilla (hoja
-- NOTOCAR y bloques; nombres tal como figuran, // confirmar razón social completa) y los "Solicitado
-- por" de la hoja SolicitadoPor que no son usuarios.
INSERT INTO "RazonSocial" ("id", "nombre", "cuit", "activa", "orden") VALUES
  ('rs_signa', 'SIGNA DESARROLLOS S.A', '30-71704281-2', true, 1),
  ('rs_darwin', 'DARWIN 1299 S.A', '30-71672062-0', true, 2),
  ('rs_alvarez_thomas', 'ALVAREZ THOMAS', '30-71730635-6', true, 3),
  ('rs_remedios', 'REMEDIOS DE ESCALADA 2329', '30-71706913-3', true, 4)
ON CONFLICT ("cuit") DO NOTHING;
INSERT INTO "SolicitanteExterno" ("id", "nombre", "activo") VALUES
  ('se_romina', 'Romina', true),
  ('se_hernan', 'Hernán', true)
ON CONFLICT ("nombre") DO NOTHING;
-- Las OC que ya existían compran con Signa Desarrollos.
UPDATE "OrdenCompra" SET "empresaCompraId" = 'rs_signa' WHERE "empresaCompraId" IS NULL;

-- Formato del número: OC-NNNN / PE-NNNN (y "OC-41 B" de las importadas); las OC-AAAA-NNNN de antes siguen valiendo.
ALTER TABLE "OrdenCompra" DROP CONSTRAINT IF EXISTS "OrdenCompra_numero_formato";
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_numero_formato" CHECK ("numero" IS NULL OR "numero" ~ '^(OC|PE)-[0-9A-Za-z][0-9A-Za-z ./-]*$');
