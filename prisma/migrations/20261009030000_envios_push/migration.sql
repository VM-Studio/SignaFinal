-- CreateTable
CREATE TABLE "EnvioPush" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "suscripcionId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "codigoRespuesta" INTEGER,
    "error" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvioPush_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnvioPush_usuarioId_fecha_idx" ON "EnvioPush"("usuarioId", "fecha");

-- CreateIndex
CREATE INDEX "EnvioPush_suscripcionId_fecha_idx" ON "EnvioPush"("suscripcionId", "fecha");

-- AddForeignKey
ALTER TABLE "EnvioPush" ADD CONSTRAINT "EnvioPush_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvioPush" ADD CONSTRAINT "EnvioPush_suscripcionId_fkey" FOREIGN KEY ("suscripcionId") REFERENCES "SuscripcionPush"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

