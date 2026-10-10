-- AlterTable
ALTER TABLE "PedidoMaterial" ADD COLUMN     "obraSedeId" TEXT,
ADD COLUMN     "renglones" JSONB;

-- AddForeignKey
ALTER TABLE "PedidoMaterial" ADD CONSTRAINT "PedidoMaterial_obraSedeId_fkey" FOREIGN KEY ("obraSedeId") REFERENCES "ObraSede"("id") ON DELETE SET NULL ON UPDATE CASCADE;

