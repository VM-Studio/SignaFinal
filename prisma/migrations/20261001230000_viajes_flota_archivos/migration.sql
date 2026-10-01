-- AlterTable
ALTER TABLE "CargaCombustible" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "Viaje" ADD COLUMN     "clientIdFin" TEXT,
ADD COLUMN     "clientIdInicio" TEXT,
ADD COLUMN     "remitoUrl" TEXT;

-- CreateTable
CREATE TABLE "Archivo" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT,
    "datos" BYTEA NOT NULL,
    "tamano" INTEGER NOT NULL,
    "subidoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Archivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CargaCombustible_clientId_key" ON "CargaCombustible"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Viaje_clientIdInicio_key" ON "Viaje"("clientIdInicio");

-- CreateIndex
CREATE UNIQUE INDEX "Viaje_clientIdFin_key" ON "Viaje"("clientIdFin");

