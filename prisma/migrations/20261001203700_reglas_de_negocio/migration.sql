-- Reglas de negocio garantizadas por la base, no solo por la aplicación.

-- Un chofer no puede tener dos viajes en curso. Un vehículo tampoco.
CREATE UNIQUE INDEX "Viaje_un_viaje_en_curso_por_chofer"
  ON "Viaje" ("choferId") WHERE "estado" = 'EN_VIAJE';
CREATE UNIQUE INDEX "Viaje_un_viaje_en_curso_por_vehiculo"
  ON "Viaje" ("vehiculoId") WHERE "estado" = 'EN_VIAJE';

-- Kilómetros y costos coherentes.
ALTER TABLE "Viaje"
  ADD CONSTRAINT "Viaje_km_salida_valido" CHECK ("kmSalida" >= 0),
  ADD CONSTRAINT "Viaje_km_llegada_mayor_o_igual" CHECK ("kmLlegada" IS NULL OR "kmLlegada" >= "kmSalida"),
  ADD CONSTRAINT "Viaje_peajes_no_negativos" CHECK ("peajes" >= 0),
  ADD CONSTRAINT "Viaje_costo_no_negativo" CHECK ("costo" IS NULL OR "costo" >= 0),
  ADD CONSTRAINT "Viaje_finalizado_completo" CHECK (
    "estado" = 'EN_VIAJE'
    OR ("kmLlegada" IS NOT NULL AND "llegadaEn" IS NOT NULL AND "costo" IS NOT NULL)
  );

-- Un pedido tomado, en viaje o entregado siempre tiene chofer.
ALTER TABLE "PedidoViaje"
  ADD CONSTRAINT "PedidoViaje_chofer_si_tomado" CHECK (
    "estado" IN ('PENDIENTE', 'CANCELADO') OR "choferId" IS NOT NULL
  ),
  ADD CONSTRAINT "PedidoViaje_peso_positivo" CHECK ("pesoKg" IS NULL OR "pesoKg" > 0);

ALTER TABLE "Vehiculo"
  ADD CONSTRAINT "Vehiculo_capacidad_no_negativa" CHECK ("capacidadKg" >= 0),
  ADD CONSTRAINT "Vehiculo_costo_km_no_negativo" CHECK ("costoKm" >= 0),
  ADD CONSTRAINT "Vehiculo_km_no_negativo" CHECK ("kmActual" >= 0);

ALTER TABLE "CargaCombustible"
  ADD CONSTRAINT "CargaCombustible_litros_positivos" CHECK ("litros" > 0),
  ADD CONSTRAINT "CargaCombustible_monto_no_negativo" CHECK ("monto" >= 0);

ALTER TABLE "Mantenimiento"
  ADD CONSTRAINT "Mantenimiento_costo_no_negativo" CHECK ("costo" >= 0);

-- Herramienta UNITARIA: en el depósito (obraId null) o en una obra, nunca en ambos.
-- Las de CANTIDAD no usan obraId/tenedorId: su ubicación es el stock.
ALTER TABLE "Item"
  ADD CONSTRAINT "Item_ubicacion_solo_unitaria" CHECK (
    "control" = 'UNITARIA' OR ("obraId" IS NULL AND "tenedorId" IS NULL)
  );

-- Stock por cantidad: una fila por (ítem, ubicación); el depósito es obraId null.
CREATE UNIQUE INDEX "StockItem_item_ubicacion_unica"
  ON "StockItem" ("itemId", COALESCE("obraId", ''));
ALTER TABLE "StockItem"
  ADD CONSTRAINT "StockItem_cantidad_no_negativa" CHECK ("cantidad" >= 0);

ALTER TABLE "MovimientoItem"
  ADD CONSTRAINT "MovimientoItem_cantidad_positiva" CHECK ("cantidad" > 0);

ALTER TABLE "SolicitudHerramienta"
  ADD CONSTRAINT "SolicitudHerramienta_cantidad_positiva" CHECK ("cantidad" > 0);

-- Nada se borra: auditoría es solo de inserción.
CREATE OR REPLACE FUNCTION auditoria_inmutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La auditoría no se modifica ni se borra';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Auditoria_inmutable"
  BEFORE UPDATE OR DELETE ON "Auditoria"
  FOR EACH ROW EXECUTE FUNCTION auditoria_inmutable();
