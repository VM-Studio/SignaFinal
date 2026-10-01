-- CreateEnum
CREATE TYPE "Franja" AS ENUM ('MANANA', 'TARDE', 'HORA_EXACTA');

-- AlterEnum
ALTER TYPE "EstadoViaje" ADD VALUE 'CANCELADO';

-- AlterTable
ALTER TABLE "PedidoViaje" ADD COLUMN     "canceladoEn" TIMESTAMP(3),
ADD COLUMN     "franja" "Franja" NOT NULL DEFAULT 'MANANA';

-- AlterTable
ALTER TABLE "Viaje" ADD COLUMN     "ordenRuta" INTEGER,
ADD COLUMN     "salidaEstimada" TIMESTAMP(3);
