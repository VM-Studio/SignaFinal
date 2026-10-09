-- Circuito de Compras (pedidos de material, historial y habilitaciones), rol COMPRAS y datos para emparejar la flota real con Cusat.
-- CreateEnum
CREATE TYPE "EstadoMaterial" AS ENUM ('SOLICITADO', 'EN_COMPRA', 'ESPERANDO_APROBACION', 'APROBADO', 'LISTO_PARA_RETIRAR', 'RETIRO_PEDIDO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "FuenteMaterial" AS ENUM ('MANUAL', 'LEBANE');

-- CreateEnum
CREATE TYPE "EstadoMaterialListo" AS ENUM ('LISTO', 'RETIRO_PEDIDO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ModoEntrega" AS ENUM ('RETIRA_CHOFER', 'ENTREGA_PROVEEDOR');

-- AlterEnum
ALTER TYPE "Rol" ADD VALUE 'COMPRAS';

-- AlterTable
ALTER TABLE "PedidoViaje" ADD COLUMN     "esRetiroMaterial" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Vehiculo" ADD COLUMN     "cusatNombre" TEXT;

-- CreateTable
CREATE TABLE "PedidoMaterial" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "obraId" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(12,2),
    "unidad" TEXT,
    "paraCuando" DATE NOT NULL,
    "prioridad" "Prioridad" NOT NULL DEFAULT 'NORMAL',
    "estado" "EstadoMaterial" NOT NULL DEFAULT 'SOLICITADO',
    "fuente" "FuenteMaterial" NOT NULL DEFAULT 'MANUAL',
    "ordenCompraNumero" TEXT,
    "ordenCompraLebaneId" TEXT,
    "montoAprobado" DECIMAL(14,2),
    "aprobadoPorId" TEXT,
    "aprobadoEn" TIMESTAMP(3),
    "tomadoPorId" TEXT,
    "tomadoEn" TIMESTAMP(3),
    "completo" BOOLEAN NOT NULL DEFAULT false,
    "motivoCancelacion" TEXT,
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PedidoMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CambioEstadoMaterial" (
    "id" TEXT NOT NULL,
    "pedidoMaterialId" TEXT NOT NULL,
    "de" "EstadoMaterial",
    "a" "EstadoMaterial" NOT NULL,
    "usuarioId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota" TEXT,

    CONSTRAINT "CambioEstadoMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialListo" (
    "id" TEXT NOT NULL,
    "pedidoMaterialId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "proveedorDireccion" TEXT NOT NULL,
    "proveedorLat" DOUBLE PRECISION NOT NULL,
    "proveedorLng" DOUBLE PRECISION NOT NULL,
    "horarioRetiro" TEXT,
    "contactoRetiro" TEXT,
    "ordenCompraNumero" TEXT,
    "descripcion" TEXT NOT NULL,
    "pesoKg" INTEGER,
    "necesitaCamion" BOOLEAN NOT NULL DEFAULT false,
    "modoEntrega" "ModoEntrega" NOT NULL DEFAULT 'RETIRA_CHOFER',
    "fechaEntregaEstimada" DATE,
    "estado" "EstadoMaterialListo" NOT NULL DEFAULT 'LISTO',
    "habilitadoPorId" TEXT NOT NULL,
    "habilitadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pedidoViajeId" TEXT,
    "entregadoEn" TIMESTAMP(3),

    CONSTRAINT "MaterialListo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PedidoMaterial_numero_key" ON "PedidoMaterial"("numero");

-- CreateIndex
CREATE INDEX "PedidoMaterial_obraId_estado_idx" ON "PedidoMaterial"("obraId", "estado");

-- CreateIndex
CREATE INDEX "PedidoMaterial_estado_paraCuando_idx" ON "PedidoMaterial"("estado", "paraCuando");

-- CreateIndex
CREATE INDEX "PedidoMaterial_solicitanteId_idx" ON "PedidoMaterial"("solicitanteId");

-- CreateIndex
CREATE INDEX "CambioEstadoMaterial_pedidoMaterialId_fecha_idx" ON "CambioEstadoMaterial"("pedidoMaterialId", "fecha");

-- CreateIndex
CREATE INDEX "MaterialListo_obraId_estado_idx" ON "MaterialListo"("obraId", "estado");

-- CreateIndex
CREATE INDEX "MaterialListo_pedidoMaterialId_idx" ON "MaterialListo"("pedidoMaterialId");

-- CreateIndex
CREATE INDEX "MaterialListo_pedidoViajeId_idx" ON "MaterialListo"("pedidoViajeId");

-- AddForeignKey
ALTER TABLE "PedidoMaterial" ADD CONSTRAINT "PedidoMaterial_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoMaterial" ADD CONSTRAINT "PedidoMaterial_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoMaterial" ADD CONSTRAINT "PedidoMaterial_tomadoPorId_fkey" FOREIGN KEY ("tomadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoMaterial" ADD CONSTRAINT "PedidoMaterial_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CambioEstadoMaterial" ADD CONSTRAINT "CambioEstadoMaterial_pedidoMaterialId_fkey" FOREIGN KEY ("pedidoMaterialId") REFERENCES "PedidoMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CambioEstadoMaterial" ADD CONSTRAINT "CambioEstadoMaterial_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialListo" ADD CONSTRAINT "MaterialListo_pedidoMaterialId_fkey" FOREIGN KEY ("pedidoMaterialId") REFERENCES "PedidoMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialListo" ADD CONSTRAINT "MaterialListo_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialListo" ADD CONSTRAINT "MaterialListo_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialListo" ADD CONSTRAINT "MaterialListo_habilitadoPorId_fkey" FOREIGN KEY ("habilitadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialListo" ADD CONSTRAINT "MaterialListo_pedidoViajeId_fkey" FOREIGN KEY ("pedidoViajeId") REFERENCES "PedidoViaje"("id") ON DELETE SET NULL ON UPDATE CASCADE;

