-- CreateEnum
CREATE TYPE "EntidadCambio" AS ENUM ('PEDIDO_VIAJE', 'VIAJE', 'PEDIDO_MATERIAL', 'ORDEN_COMPRA', 'MATERIAL_LISTO', 'HERRAMIENTA', 'ALERTA', 'AVISO');

-- CreateTable
CREATE TABLE "EventoCambio" (
    "id" SERIAL NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "entidad" "EntidadCambio" NOT NULL,
    "entidadId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoCambio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventoCambio_usuarioId_id_idx" ON "EventoCambio"("usuarioId", "id");

-- CreateIndex
CREATE INDEX "EventoCambio_fecha_idx" ON "EventoCambio"("fecha");

