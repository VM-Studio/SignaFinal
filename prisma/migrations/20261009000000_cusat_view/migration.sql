-- AlterTable
ALTER TABLE "Vehiculo" ADD COLUMN     "ultimaDireccionTexto" TEXT,
ADD COLUMN     "ultimaFechaGps" TIMESTAMP(3),
ADD COLUMN     "ultimaLat" DOUBLE PRECISION,
ADD COLUMN     "ultimaLng" DOUBLE PRECISION,
ADD COLUMN     "ultimaVelocidad" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "EstadoSistema" (
    "clave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstadoSistema_pkey" PRIMARY KEY ("clave")
);

