-- DropIndex
DROP INDEX "Vehiculo_activo_tipo_idx";

-- AlterTable
ALTER TABLE "Vehiculo" ADD COLUMN     "disponibleParaPedidos" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Vehiculo_activo_disponibleParaPedidos_tipo_idx" ON "Vehiculo"("activo", "disponibleParaPedidos", "tipo");
