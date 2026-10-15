-- "¿Lo llevás?": token para responder desde la push y los pedidos que el chofer contestó "No".
ALTER TYPE "TipoTokenAccion" ADD VALUE 'SUMAR';
ALTER TABLE "Viaje" ADD COLUMN "descartados" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Documentación real de la flota: habilitación de tránsito pesado, emisor y número.
ALTER TYPE "TipoDocumentoVehiculo" ADD VALUE 'HABILITACION_PESADO';
ALTER TABLE "DocumentoVehiculo" ADD COLUMN "emisor" TEXT, ADD COLUMN "numero" TEXT;

-- Tipo de vehículo a confirmar (la Zanella AG149BJ figura como "Auto").
ALTER TABLE "Vehiculo" ADD COLUMN "tipoAConfirmar" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Vehiculo" SET "tipoAConfirmar" = true WHERE "patente" = 'AG149BJ';

-- Se borra la documentación inventada (seguro y VTV "PROVISORIO" de un año que cargaba la base): sin
-- documentación real, los vehículos quedan "Sin documentación" hasta cargar los papeles.
DELETE FROM "DocumentoVehiculo" WHERE "notas" = 'PROVISORIO: reemplazar por el real';
