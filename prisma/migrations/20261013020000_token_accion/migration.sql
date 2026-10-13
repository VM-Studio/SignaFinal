-- CreateEnum
CREATE TYPE "TipoTokenAccion" AS ENUM ('LLEGADA', 'SALIDA');

-- CreateTable
CREATE TABLE "TokenAccion" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "viajeId" TEXT NOT NULL,
    "paradaId" TEXT NOT NULL,
    "tipo" "TipoTokenAccion" NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenAccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TokenAccion_hash_key" ON "TokenAccion"("hash");

-- CreateIndex
CREATE INDEX "TokenAccion_viajeId_idx" ON "TokenAccion"("viajeId");

