-- Vehículos solo para la documentación (no hacen viajes).
ALTER TABLE "Vehiculo" ADD COLUMN "soloDocumentacion" BOOLEAN NOT NULL DEFAULT false;

-- Las dos Toyota Hilux del dueño: solo para cargar seguro y VTV. Patentes a confirmar (se editan en Flota).
INSERT INTO "Vehiculo" ("id", "nombre", "patente", "tipo", "marca", "modelo", "anio", "capacidadCargaKg", "kmActual", "costoKm", "estado", "entraEnCola", "soloDocumentacion", "activo", "creadoEn", "actualizadoEn")
VALUES
  ('vehiculo_toyota_hilux_1', 'Toyota Hilux 1', 'HILUX-1', 'CAMIONETA', 'Toyota', 'Hilux', 0, 0, 0, 0, 'DISPONIBLE', false, true, true, NOW(), NOW()),
  ('vehiculo_toyota_hilux_2', 'Toyota Hilux 2', 'HILUX-2', 'CAMIONETA', 'Toyota', 'Hilux', 0, 0, 0, 0, 'DISPONIBLE', false, true, true, NOW(), NOW())
ON CONFLICT ("patente") DO NOTHING;
