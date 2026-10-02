-- AlterTable
ALTER TABLE "Alerta" ADD COLUMN     "obraId" TEXT,
ADD COLUMN     "usuarioId" TEXT;

-- AlterTable
ALTER TABLE "PedidoViaje" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE INDEX "Alerta_regla_estado_idx" ON "Alerta"("regla", "estado");

-- CreateIndex
CREATE INDEX "Alerta_obraId_idx" ON "Alerta"("obraId");

-- CreateIndex
CREATE INDEX "Alerta_usuarioId_idx" ON "Alerta"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "PedidoViaje_clientId_key" ON "PedidoViaje"("clientId");

