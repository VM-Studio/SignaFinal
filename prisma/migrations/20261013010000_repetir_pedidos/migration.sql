-- CreateEnum
CREATE TYPE "TipoFavorito" AS ENUM ('MATERIALES', 'VIAJE');

-- AlterTable
ALTER TABLE "Adjunto" ADD COLUMN     "referenciaDe" TEXT;

-- CreateTable
CREATE TABLE "PedidoFavorito" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoFavorito" NOT NULL,
    "nombre" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PedidoFavorito_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PedidoFavorito_usuarioId_tipo_activo_idx" ON "PedidoFavorito"("usuarioId", "tipo", "activo");

-- AddForeignKey
ALTER TABLE "PedidoFavorito" ADD CONSTRAINT "PedidoFavorito_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

