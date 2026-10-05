-- Nueva lógica de viajes: obras con varios responsables, viaje con etapas, origen y destino
-- resueltos, pedidos de herramienta por día, posiciones por fuente, avisos a personas,
-- alertas con destinatarios y auditoría completa. Migra los datos existentes sin perder nada.

-- ───────────────────────────── Enums ─────────────────────────────
CREATE TYPE "EtapaViaje" AS ENUM ('PROGRAMADO', 'HACIA_RETIRO', 'EN_RETIRO', 'HACIA_DESTINO', 'FINALIZADO');
CREATE TYPE "FuentePosicion" AS ENUM ('TELEFONO', 'CUSAT', 'MOCK');
CREATE TYPE "TipoNotificacion" AS ENUM ('PEDIDO_ACEPTADO', 'VIAJE_INICIADO', 'LLEGO_RETIRO', 'LLEGO_DESTINO', 'PEDIDO_SOLTADO', 'PEDIDO_CANCELADO', 'NUEVA_SOLICITUD', 'SOLICITUD_URGENTE', 'HERRAMIENTA_VENCIDA', 'DUPLICADO', 'GENERAL');
ALTER TYPE "TipoUbicacion" ADD VALUE 'DESCARGA';
ALTER TYPE "TipoUbicacion" ADD VALUE 'VARIOS';

-- ─────────────── 1. Obras con varios responsables ───────────────
CREATE TABLE "ResponsableObra" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResponsableObra_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ResponsableObra_usuarioId_idx" ON "ResponsableObra"("usuarioId");
CREATE UNIQUE INDEX "ResponsableObra_obraId_usuarioId_key" ON "ResponsableObra"("obraId", "usuarioId");
ALTER TABLE "ResponsableObra" ADD CONSTRAINT "ResponsableObra_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResponsableObra" ADD CONSTRAINT "ResponsableObra_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- El responsable que tenía cada obra pasa a ser su responsable principal.
INSERT INTO "ResponsableObra" ("id", "obraId", "usuarioId", "principal", "creadoEn")
SELECT 'ro_' || md5("id" || "responsableId"), "id", "responsableId", true, "creadoEn" FROM "Obra";

ALTER TABLE "Obra" DROP CONSTRAINT "Obra_responsableId_fkey";
DROP INDEX "Obra_responsableId_idx";
ALTER TABLE "Obra" DROP COLUMN "responsableId";

-- ─────────────────────── 2. Viaje con etapas ───────────────────────
ALTER TABLE "Viaje"
  ADD COLUMN "etapa" "EtapaViaje" NOT NULL DEFAULT 'PROGRAMADO',
  ADD COLUMN "inicioEn" TIMESTAMP(3),
  ADD COLUMN "llegadaRetiroEn" TIMESTAMP(3),
  ADD COLUMN "salidaRetiroEn" TIMESTAMP(3),
  ADD COLUMN "llegadaDestinoEn" TIMESTAMP(3),
  ADD COLUMN "distanciaRetiroM" INTEGER,
  ADD COLUMN "duracionRetiroS" INTEGER,
  ADD COLUMN "distanciaDestinoM" INTEGER,
  ADD COLUMN "duracionDestinoS" INTEGER,
  ADD COLUMN "etaRetiro" TIMESTAMP(3),
  ADD COLUMN "etaDestino" TIMESTAMP(3);

-- Hasta ahora "iniciar" era salir cargado hacia la obra: los que están en curso van hacia el destino.
UPDATE "Viaje" SET
  "etapa" = CASE "estado"
    WHEN 'EN_CURSO' THEN 'HACIA_DESTINO'::"EtapaViaje"
    WHEN 'FINALIZADO' THEN 'FINALIZADO'::"EtapaViaje"
    ELSE 'PROGRAMADO'::"EtapaViaje" END,
  "inicioEn" = "salidaReal",
  "salidaRetiroEn" = CASE WHEN "estado" IN ('EN_CURSO', 'FINALIZADO') THEN "salidaReal" END,
  "llegadaDestinoEn" = "llegadaReal";
CREATE INDEX "Viaje_choferId_etapa_idx" ON "Viaje"("choferId", "etapa");

-- ──────────── 3 y 4. Pedido: origen y destino resueltos, herramienta por día ────────────
ALTER TABLE "PedidoViaje"
  ADD COLUMN "origenNombre" TEXT,
  ADD COLUMN "origenDireccion" TEXT,
  ADD COLUMN "origenLat" DOUBLE PRECISION,
  ADD COLUMN "origenLng" DOUBLE PRECISION,
  ADD COLUMN "destinoNombre" TEXT,
  ADD COLUMN "destinoDireccion" TEXT,
  ADD COLUMN "destinoLat" DOUBLE PRECISION,
  ADD COLUMN "destinoLng" DOUBLE PRECISION,
  ADD COLUMN "fechaNecesaria" DATE;

UPDATE "PedidoViaje" p SET "origenNombre" = x."nombre", "origenDireccion" = x."direccion" || ', ' || x."localidad", "origenLat" = x."latitud", "origenLng" = x."longitud"
FROM "Proveedor" x WHERE p."origenTipo" = 'PROVEEDOR' AND x."id" = p."origenId";
UPDATE "PedidoViaje" p SET "origenNombre" = 'Obra ' || x."nombre", "origenDireccion" = x."direccion" || ', ' || x."localidad", "origenLat" = x."latitud", "origenLng" = x."longitud"
FROM "Obra" x WHERE p."origenTipo" = 'OBRA' AND x."id" = p."origenId";
UPDATE "PedidoViaje" p SET "origenNombre" = x."nombre", "origenDireccion" = x."direccion", "origenLat" = x."latitud", "origenLng" = x."longitud"
FROM "Ubicacion" x WHERE p."origenTipo" IN ('BASE', 'DEPOSITO') AND x."id" = p."origenId";
UPDATE "PedidoViaje" p SET "destinoNombre" = 'Obra ' || x."nombre", "destinoDireccion" = x."direccion" || ', ' || x."localidad", "destinoLat" = x."latitud", "destinoLng" = x."longitud"
FROM "Obra" x WHERE x."id" = p."obraId";
-- Pedidos de herramienta: el día que se necesita es el día (argentino) de paraCuando.
UPDATE "PedidoViaje" SET "fechaNecesaria" = ("paraCuando" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
WHERE "herramientaId" IS NOT NULL;

ALTER TABLE "PedidoViaje"
  ALTER COLUMN "origenNombre" SET NOT NULL,
  ALTER COLUMN "origenDireccion" SET NOT NULL,
  ALTER COLUMN "origenLat" SET NOT NULL,
  ALTER COLUMN "origenLng" SET NOT NULL,
  ALTER COLUMN "destinoNombre" SET NOT NULL,
  ALTER COLUMN "destinoDireccion" SET NOT NULL,
  ALTER COLUMN "destinoLat" SET NOT NULL,
  ALTER COLUMN "destinoLng" SET NOT NULL;
CREATE INDEX "PedidoViaje_herramientaId_obraId_fechaNecesaria_idx" ON "PedidoViaje"("herramientaId", "obraId", "fechaNecesaria");

-- ─────────────────────────── 5. Posiciones ───────────────────────────
ALTER TABLE "PosicionVehiculo"
  ADD COLUMN "fuente" "FuentePosicion" NOT NULL DEFAULT 'MOCK',
  ADD COLUMN "viajeId" TEXT,
  ADD COLUMN "usuarioId" TEXT,
  ADD COLUMN "precisionM" DOUBLE PRECISION;
CREATE INDEX "PosicionVehiculo_viajeId_fecha_idx" ON "PosicionVehiculo"("viajeId", "fecha");
ALTER TABLE "PosicionVehiculo" ADD CONSTRAINT "PosicionVehiculo_viajeId_fkey" FOREIGN KEY ("viajeId") REFERENCES "Viaje"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PosicionVehiculo" ADD CONSTRAINT "PosicionVehiculo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────── 6. Avisos a personas ───────────────────────
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "enlace" TEXT,
    "datos" JSONB,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leidaEn" TIMESTAMP(3),
    "enviadaPushEn" TIMESTAMP(3),
    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notificacion_usuarioId_leidaEn_idx" ON "Notificacion"("usuarioId", "leidaEn");
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SuscripcionPush" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "SuscripcionPush_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SuscripcionPush_endpoint_key" ON "SuscripcionPush"("endpoint");
CREATE INDEX "SuscripcionPush_usuarioId_activa_idx" ON "SuscripcionPush"("usuarioId", "activa");
ALTER TABLE "SuscripcionPush" ADD CONSTRAINT "SuscripcionPush_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────── 7. Alertas con destinatarios ───────────────────
-- Misma matriz que src/lib/alertas/destinatarios.ts.
ALTER TABLE "Alerta" ADD COLUMN "rolesDestino" "Rol"[] DEFAULT ARRAY[]::"Rol"[];
UPDATE "Alerta" SET "rolesDestino" = CASE "regla"
  WHEN 'PENDIENTE_HOY' THEN ARRAY['DIRECCION', 'CHOFER']::"Rol"[]
  WHEN 'URGENTE_SIN_TOMAR' THEN ARRAY['DIRECCION', 'CHOFER', 'RESPONSABLE_OBRA', 'CAPATAZ']::"Rol"[]
  WHEN 'DUPLICADO' THEN ARRAY['DIRECCION', 'RESPONSABLE_OBRA', 'CAPATAZ']::"Rol"[]
  WHEN 'VIAJE_LARGO' THEN ARRAY['DIRECCION']::"Rol"[]
  WHEN 'PARADO_EN_VIAJE' THEN ARRAY['DIRECCION']::"Rol"[]
  WHEN 'FUERA_HORARIO' THEN ARRAY['DIRECCION', 'ADMINISTRACION']::"Rol"[]
  WHEN 'DOCUMENTO' THEN ARRAY['DIRECCION', 'ADMINISTRACION']::"Rol"[]
  WHEN 'SERVICE' THEN ARRAY['DIRECCION', 'ADMINISTRACION']::"Rol"[]
  WHEN 'CONSUMO' THEN ARRAY['DIRECCION', 'ADMINISTRACION']::"Rol"[]
  WHEN 'LICENCIA' THEN ARRAY['DIRECCION', 'ADMINISTRACION']::"Rol"[]
  WHEN 'DEVOLUCION_VENCIDA' THEN ARRAY['DIRECCION', 'DEPOSITO', 'RESPONSABLE_OBRA', 'CAPATAZ']::"Rol"[]
  WHEN 'MAQUINA_OBRA_PARADA' THEN ARRAY['DIRECCION', 'DEPOSITO', 'RESPONSABLE_OBRA', 'CAPATAZ']::"Rol"[]
  WHEN 'MANT_MAQUINA' THEN ARRAY['DIRECCION', 'DEPOSITO']::"Rol"[]
  ELSE ARRAY['DIRECCION']::"Rol"[] END;

-- ─────────────────────── 8. Auditoría completa ───────────────────────
ALTER TABLE "Auditoria"
  ADD COLUMN "rol" "Rol",
  ADD COLUMN "resumen" TEXT,
  ADD COLUMN "ip" TEXT,
  ADD COLUMN "userAgent" TEXT;
-- La auditoría es inmutable (trigger): se apaga solo para completar las filas viejas.
ALTER TABLE "Auditoria" DISABLE TRIGGER "Auditoria_inmutable";
UPDATE "Auditoria" a SET
  "rol" = u."rol",
  "resumen" = COALESCE(u."nombre", 'Sistema') || ': ' || a."accion" || ' (' || a."entidad" || ')'
FROM "Usuario" u WHERE u."id" = a."usuarioId";
UPDATE "Auditoria" SET "resumen" = 'Sistema: ' || "accion" || ' (' || "entidad" || ')' WHERE "resumen" IS NULL;
ALTER TABLE "Auditoria" ENABLE TRIGGER "Auditoria_inmutable";
ALTER TABLE "Auditoria" ALTER COLUMN "resumen" SET NOT NULL;
CREATE INDEX "Auditoria_usuarioId_fecha_idx" ON "Auditoria"("usuarioId", "fecha");
