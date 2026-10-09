-- AlterTable
ALTER TABLE "SuscripcionPush" ADD COLUMN     "ultimaRecepcionEn" TIMESTAMP(3),
ADD COLUMN     "ultimoEnvioEn" TIMESTAMP(3),
ADD COLUMN     "ultimoEnvioEstado" TEXT;

