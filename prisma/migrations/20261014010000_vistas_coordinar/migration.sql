-- AlterTable
ALTER TABLE "PedidoViaje" ADD COLUMN     "coordinadoPorId" TEXT;

-- CreateTable
CREATE TABLE "VistaGuardada" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "pantalla" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "parametros" JSONB NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VistaGuardada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VistaGuardada_usuarioId_pantalla_nombre_key" ON "VistaGuardada"("usuarioId", "pantalla", "nombre");

-- CreateIndex
CREATE INDEX "PedidoViaje_coordinadoPorId_idx" ON "PedidoViaje"("coordinadoPorId");

-- AddForeignKey
ALTER TABLE "PedidoViaje" ADD CONSTRAINT "PedidoViaje_coordinadoPorId_fkey" FOREIGN KEY ("coordinadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VistaGuardada" ADD CONSTRAINT "VistaGuardada_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

