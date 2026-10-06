-- Nada se borra: las asignaciones de obra se desactivan en vez de borrarse.
ALTER TABLE "ResponsableObra" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "hastaEn" TIMESTAMP(3);
CREATE INDEX "ResponsableObra_usuarioId_activo_idx" ON "ResponsableObra"("usuarioId", "activo");
