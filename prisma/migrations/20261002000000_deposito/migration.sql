-- DropIndex
DROP INDEX "MaterialSobrante_categoria_idx";

-- AlterTable
ALTER TABLE "MaterialSobrante" ADD COLUMN     "bajaEn" TIMESTAMP(3),
ADD COLUMN     "motivoBaja" TEXT;

-- AlterTable
ALTER TABLE "PedidoViaje" ADD COLUMN     "herramientaId" TEXT;

-- CreateTable
CREATE TABLE "MantenimientoHerramienta" (
    "id" TEXT NOT NULL,
    "herramientaId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "descripcion" TEXT NOT NULL,
    "taller" TEXT,
    "costo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "registradoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MantenimientoHerramienta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MantenimientoHerramienta_herramientaId_fecha_idx" ON "MantenimientoHerramienta"("herramientaId", "fecha");

-- CreateIndex
CREATE INDEX "MaterialSobrante_categoria_bajaEn_idx" ON "MaterialSobrante"("categoria", "bajaEn");

-- CreateIndex
CREATE INDEX "PedidoViaje_herramientaId_estado_idx" ON "PedidoViaje"("herramientaId", "estado");

-- AddForeignKey
ALTER TABLE "PedidoViaje" ADD CONSTRAINT "PedidoViaje_herramientaId_fkey" FOREIGN KEY ("herramientaId") REFERENCES "Herramienta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MantenimientoHerramienta" ADD CONSTRAINT "MantenimientoHerramienta_herramientaId_fkey" FOREIGN KEY ("herramientaId") REFERENCES "Herramienta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MantenimientoHerramienta" ADD CONSTRAINT "MantenimientoHerramienta_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Costos de mantenimiento nunca negativos; cantidades de sobrantes tampoco.
ALTER TABLE "MantenimientoHerramienta" ADD CONSTRAINT "MantenimientoHerramienta_costo_no_negativo" CHECK ("costo" >= 0);
ALTER TABLE "MaterialSobrante" ADD CONSTRAINT "MaterialSobrante_cantidad_no_negativa" CHECK ("cantidad" >= 0);
