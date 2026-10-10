-- CreateEnum
CREATE TYPE "TipoParada" AS ENUM ('RETIRO', 'ENTREGA');

-- CreateEnum
CREATE TYPE "LugarParada" AS ENUM ('PROVEEDOR_SUCURSAL', 'DEPOSITO', 'OBRA', 'OBRA_SEDE', 'BASE', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoParada" AS ENUM ('PENDIENTE', 'EN_CAMINO', 'LLEGO', 'COMPLETADA', 'SALTEADA');

-- CreateEnum
CREATE TYPE "EntidadAdjunto" AS ENUM ('PEDIDO_MATERIAL', 'ORDEN_COMPRA', 'VIAJE', 'HERRAMIENTA', 'VEHICULO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('ACOPIO', 'CUENTA_CORRIENTE', 'TRANSFERENCIA', 'EFECTIVO', 'ECHEQ');

-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('ARS', 'USD');

-- CreateEnum
CREATE TYPE "EstadoOC" AS ENUM ('BORRADOR', 'ESPERANDO_APROBACION', 'APROBADA', 'RECHAZADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "TipoRecordatorio" AS ENUM ('VIAJE_MANANA', 'VIAJE_HOY', 'VIAJE_SIN_INICIAR', 'RESUMEN_DIRECCION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacion" ADD VALUE 'ORDEN_COMPRA';
ALTER TYPE "TipoNotificacion" ADD VALUE 'RECORDATORIO';

-- DropIndex
DROP INDEX "Viaje_pedidoId_key";

-- AlterTable
ALTER TABLE "MaterialListo" ADD COLUMN     "renglones" JSONB,
ADD COLUMN     "sucursalId" TEXT;

-- AlterTable
ALTER TABLE "PedidoMaterial" ADD COLUMN     "notasCompras" TEXT,
ADD COLUMN     "ordenCompraId" TEXT;

-- AlterTable
ALTER TABLE "PedidoViaje" ADD COLUMN     "destinoSedeId" TEXT,
ADD COLUMN     "sucursalId" TEXT,
ADD COLUMN     "viajeId" TEXT;

-- AlterTable
ALTER TABLE "Proveedor" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cuit" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "notas" TEXT,
ADD COLUMN     "rubro" TEXT;

-- AlterTable
ALTER TABLE "Ubicacion" ADD COLUMN     "activa" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "etiqueta" TEXT,
ADD COLUMN     "localidad" TEXT;

-- AlterTable
ALTER TABLE "Viaje" ADD COLUMN     "distanciaTotalM" INTEGER;

-- CreateTable
CREATE TABLE "ObraSede" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "localidad" TEXT NOT NULL,
    "latitud" DOUBLE PRECISION NOT NULL,
    "longitud" DOUBLE PRECISION NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObraSede_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SucursalProveedor" (
    "id" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "localidad" TEXT NOT NULL,
    "latitud" DOUBLE PRECISION NOT NULL,
    "longitud" DOUBLE PRECISION NOT NULL,
    "horarioRetiro" TEXT,
    "contacto" TEXT,
    "telefono" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SucursalProveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViajeParada" (
    "id" TEXT NOT NULL,
    "viajeId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "tipo" "TipoParada" NOT NULL,
    "lugarTipo" "LugarParada" NOT NULL,
    "lugarId" TEXT,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "latitud" DOUBLE PRECISION NOT NULL,
    "longitud" DOUBLE PRECISION NOT NULL,
    "estado" "EstadoParada" NOT NULL DEFAULT 'PENDIENTE',
    "llegadaEn" TIMESTAMP(3),
    "salidaEn" TIMESTAMP(3),
    "distanciaDesdeAnteriorM" INTEGER,
    "duracionDesdeAnteriorS" INTEGER,
    "remitoUrl" TEXT,
    "notas" TEXT,

    CONSTRAINT "ViajeParada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViajePedido" (
    "id" TEXT NOT NULL,
    "viajeId" TEXT NOT NULL,
    "pedidoViajeId" TEXT NOT NULL,
    "paradaRetiroId" TEXT,
    "paradaEntregaId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "costoImputado" DECIMAL(12,2),

    CONSTRAINT "ViajePedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemParada" (
    "id" TEXT NOT NULL,
    "paradaId" TEXT NOT NULL,
    "pedidoViajeId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(12,2),
    "unidad" TEXT,
    "cantidadReal" DECIMAL(12,2),
    "faltante" BOOLEAN NOT NULL DEFAULT false,
    "nota" TEXT,
    "ordenCompraNumero" TEXT,
    "obraNombre" TEXT NOT NULL,
    "marcado" BOOLEAN NOT NULL DEFAULT false,
    "marcadoEn" TIMESTAMP(3),

    CONSTRAINT "ItemParada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adjunto" (
    "id" TEXT NOT NULL,
    "entidadTipo" "EntidadAdjunto" NOT NULL,
    "entidadId" TEXT,
    "nombre" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipoMime" TEXT NOT NULL,
    "tamanoBytes" INTEGER NOT NULL,
    "interno" BOOLEAN NOT NULL DEFAULT false,
    "subidoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Adjunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeocodeCache" (
    "texto" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "direccionFormateada" TEXT NOT NULL,
    "candidatos" JSONB NOT NULL DEFAULT '[]',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeocodeCache_pkey" PRIMARY KEY ("texto")
);

-- CreateTable
CREATE TABLE "OrdenCompra" (
    "id" TEXT NOT NULL,
    "numero" TEXT,
    "anio" INTEGER,
    "secuencia" INTEGER,
    "pedidoMaterialId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "proveedorId" TEXT,
    "sucursalId" TEXT,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaNecesaria" DATE,
    "metodoPago" "MetodoPago",
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "condiciones" TEXT,
    "observaciones" TEXT,
    "notasInternas" TEXT,
    "subtotal" DECIMAL(14,2),
    "iva" DECIMAL(14,2),
    "total" DECIMAL(14,2),
    "estado" "EstadoOC" NOT NULL DEFAULT 'BORRADOR',
    "creadaPorId" TEXT NOT NULL,
    "enviadaEn" TIMESTAMP(3),
    "aprobadaPorId" TEXT,
    "aprobadaEn" TIMESTAMP(3),
    "motivoRechazo" TEXT,
    "pdfUrl" TEXT,
    "pdfAprobadaUrl" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "ordenCompraLebaneId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdenCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenglonOC" (
    "id" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "unidad" TEXT NOT NULL,
    "precioUnitario" DECIMAL(14,2),
    "subtotal" DECIMAL(14,2),

    CONSTRAINT "RenglonOC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumeradorOC" (
    "anio" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NumeradorOC_pkey" PRIMARY KEY ("anio")
);

-- CreateTable
CREATE TABLE "Recordatorio" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoRecordatorio" NOT NULL,
    "entidadId" TEXT NOT NULL,
    "programadoPara" TIMESTAMP(3) NOT NULL,
    "enviadoEn" TIMESTAMP(3),
    "canceladoEn" TIMESTAMP(3),
    "claveUnica" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recordatorio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ObraSede_obraId_activa_idx" ON "ObraSede"("obraId", "activa");

-- CreateIndex
CREATE INDEX "SucursalProveedor_proveedorId_activa_idx" ON "SucursalProveedor"("proveedorId", "activa");

-- CreateIndex
CREATE INDEX "ViajeParada_viajeId_orden_idx" ON "ViajeParada"("viajeId", "orden");

-- CreateIndex
CREATE INDEX "ViajePedido_pedidoViajeId_idx" ON "ViajePedido"("pedidoViajeId");

-- CreateIndex
CREATE UNIQUE INDEX "ViajePedido_viajeId_pedidoViajeId_key" ON "ViajePedido"("viajeId", "pedidoViajeId");

-- CreateIndex
CREATE INDEX "ItemParada_paradaId_idx" ON "ItemParada"("paradaId");

-- CreateIndex
CREATE INDEX "ItemParada_pedidoViajeId_idx" ON "ItemParada"("pedidoViajeId");

-- CreateIndex
CREATE INDEX "Adjunto_entidadTipo_entidadId_idx" ON "Adjunto"("entidadTipo", "entidadId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCompra_numero_key" ON "OrdenCompra"("numero");

-- CreateIndex
CREATE INDEX "OrdenCompra_estado_enviadaEn_idx" ON "OrdenCompra"("estado", "enviadaEn");

-- CreateIndex
CREATE INDEX "OrdenCompra_pedidoMaterialId_idx" ON "OrdenCompra"("pedidoMaterialId");

-- CreateIndex
CREATE INDEX "OrdenCompra_proveedorId_idx" ON "OrdenCompra"("proveedorId");

-- CreateIndex
CREATE INDEX "OrdenCompra_obraId_idx" ON "OrdenCompra"("obraId");

-- CreateIndex
CREATE INDEX "RenglonOC_ordenCompraId_orden_idx" ON "RenglonOC"("ordenCompraId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "Recordatorio_claveUnica_key" ON "Recordatorio"("claveUnica");

-- CreateIndex
CREATE INDEX "Recordatorio_programadoPara_enviadoEn_idx" ON "Recordatorio"("programadoPara", "enviadoEn");

-- CreateIndex
CREATE INDEX "Recordatorio_entidadId_idx" ON "Recordatorio"("entidadId");

-- CreateIndex
CREATE UNIQUE INDEX "PedidoMaterial_ordenCompraId_key" ON "PedidoMaterial"("ordenCompraId");

-- CreateIndex
CREATE INDEX "PedidoViaje_viajeId_idx" ON "PedidoViaje"("viajeId");

-- CreateIndex
CREATE INDEX "PedidoViaje_sucursalId_idx" ON "PedidoViaje"("sucursalId");

-- CreateIndex
CREATE INDEX "Proveedor_cuit_idx" ON "Proveedor"("cuit");

-- CreateIndex
CREATE INDEX "Viaje_pedidoId_idx" ON "Viaje"("pedidoId");

-- AddForeignKey
ALTER TABLE "ObraSede" ADD CONSTRAINT "ObraSede_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SucursalProveedor" ADD CONSTRAINT "SucursalProveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoViaje" ADD CONSTRAINT "PedidoViaje_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "SucursalProveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoViaje" ADD CONSTRAINT "PedidoViaje_destinoSedeId_fkey" FOREIGN KEY ("destinoSedeId") REFERENCES "ObraSede"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoViaje" ADD CONSTRAINT "PedidoViaje_viajeId_fkey" FOREIGN KEY ("viajeId") REFERENCES "Viaje"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViajeParada" ADD CONSTRAINT "ViajeParada_viajeId_fkey" FOREIGN KEY ("viajeId") REFERENCES "Viaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViajePedido" ADD CONSTRAINT "ViajePedido_viajeId_fkey" FOREIGN KEY ("viajeId") REFERENCES "Viaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViajePedido" ADD CONSTRAINT "ViajePedido_pedidoViajeId_fkey" FOREIGN KEY ("pedidoViajeId") REFERENCES "PedidoViaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViajePedido" ADD CONSTRAINT "ViajePedido_paradaRetiroId_fkey" FOREIGN KEY ("paradaRetiroId") REFERENCES "ViajeParada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViajePedido" ADD CONSTRAINT "ViajePedido_paradaEntregaId_fkey" FOREIGN KEY ("paradaEntregaId") REFERENCES "ViajeParada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemParada" ADD CONSTRAINT "ItemParada_paradaId_fkey" FOREIGN KEY ("paradaId") REFERENCES "ViajeParada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemParada" ADD CONSTRAINT "ItemParada_pedidoViajeId_fkey" FOREIGN KEY ("pedidoViajeId") REFERENCES "PedidoViaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adjunto" ADD CONSTRAINT "Adjunto_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoMaterial" ADD CONSTRAINT "PedidoMaterial_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialListo" ADD CONSTRAINT "MaterialListo_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "SucursalProveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_pedidoMaterialId_fkey" FOREIGN KEY ("pedidoMaterialId") REFERENCES "PedidoMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "SucursalProveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_aprobadaPorId_fkey" FOREIGN KEY ("aprobadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenglonOC" ADD CONSTRAINT "RenglonOC_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recordatorio" ADD CONSTRAINT "Recordatorio_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- ═════════════════════════════ DATOS EXISTENTES ═════════════════════════════

-- 1) Cada proveedor queda con una sucursal "Casa central" con su dirección y coordenadas
--    (id predecible para poder enganchar lo que ya apuntaba al proveedor).
INSERT INTO "SucursalProveedor" ("id", "proveedorId", "nombre", "direccion", "localidad", "latitud", "longitud", "telefono", "principal", "activa", "creadoEn")
SELECT 'cs_' || p."id", p."id", 'Casa central', p."direccion", p."localidad", p."latitud", p."longitud", p."telefono", true, true, p."creadoEn"
FROM "Proveedor" p;

-- Horario y contacto de retiro: lo último que cargó Compras al habilitar.
UPDATE "SucursalProveedor" s SET "horarioRetiro" = m."horarioRetiro", "contacto" = m."contactoRetiro"
FROM (
  SELECT DISTINCT ON ("proveedorId") "proveedorId", "horarioRetiro", "contactoRetiro"
  FROM "MaterialListo" ORDER BY "proveedorId", "habilitadoEn" DESC
) m
WHERE s."proveedorId" = m."proveedorId";

UPDATE "MaterialListo" SET "sucursalId" = 'cs_' || "proveedorId";
ALTER TABLE "MaterialListo" ALTER COLUMN "sucursalId" SET NOT NULL;

-- Pedidos de retiro en proveedor: el origen pasa a ser la sucursal.
UPDATE "PedidoViaje" SET "proveedorId" = "origenId"
WHERE "origenTipo" = 'PROVEEDOR' AND "proveedorId" IS NULL AND EXISTS (SELECT 1 FROM "Proveedor" x WHERE x."id" = "PedidoViaje"."origenId");
UPDATE "PedidoViaje" SET "sucursalId" = 'cs_' || "proveedorId", "origenId" = 'cs_' || "proveedorId"
WHERE "origenTipo" = 'PROVEEDOR' AND "proveedorId" IS NOT NULL;

-- Recién ahora la dirección deja de estar en el proveedor.
ALTER TABLE "Proveedor" DROP COLUMN "direccion",
DROP COLUMN "latitud",
DROP COLUMN "localidad",
DROP COLUMN "longitud";

-- 2) Cada pedido apunta al viaje que lo lleva (hasta hoy era uno por pedido).
UPDATE "PedidoViaje" p SET "viajeId" = v."id" FROM "Viaje" v WHERE v."pedidoId" = p."id";

-- 3) Cada viaje existente: parada de RETIRO (salvo que haya salido directo a la obra) y de ENTREGA,
--    con su estado según dónde iba, un ViajePedido y un ítem por parada.
INSERT INTO "ViajeParada" ("id", "viajeId", "orden", "tipo", "lugarTipo", "lugarId", "nombre", "direccion", "latitud", "longitud", "estado", "llegadaEn", "salidaEn", "distanciaDesdeAnteriorM", "duracionDesdeAnteriorS")
SELECT 'pr_' || v."id", v."id", 1, 'RETIRO',
  (CASE p."origenTipo" WHEN 'PROVEEDOR' THEN 'PROVEEDOR_SUCURSAL' WHEN 'DEPOSITO' THEN 'DEPOSITO' WHEN 'OBRA' THEN 'OBRA' ELSE 'BASE' END)::"LugarParada",
  p."origenId", p."origenNombre", p."origenDireccion", p."origenLat", p."origenLng",
  (CASE
    WHEN v."salidaRetiroEn" IS NOT NULL OR v."etapa" IN ('HACIA_DESTINO', 'EN_DESTINO', 'FINALIZADO') THEN 'COMPLETADA'
    WHEN v."etapa" = 'EN_RETIRO' THEN 'LLEGO'
    WHEN v."etapa" = 'HACIA_RETIRO' THEN 'EN_CAMINO'
    ELSE 'PENDIENTE' END)::"EstadoParada",
  v."llegadaRetiroEn", v."salidaRetiroEn", v."distanciaRetiroM", v."duracionRetiroS"
FROM "Viaje" v JOIN "PedidoViaje" p ON p."id" = v."pedidoId"
WHERE NOT (v."inicioEn" IS NOT NULL AND v."llegadaRetiroEn" = v."inicioEn" AND v."salidaRetiroEn" = v."inicioEn");

INSERT INTO "ViajeParada" ("id", "viajeId", "orden", "tipo", "lugarTipo", "lugarId", "nombre", "direccion", "latitud", "longitud", "estado", "llegadaEn", "salidaEn", "distanciaDesdeAnteriorM", "duracionDesdeAnteriorS")
SELECT 'pe_' || v."id", v."id", 2, 'ENTREGA', (CASE WHEN p."destinoSedeId" IS NULL THEN 'OBRA' ELSE 'OBRA_SEDE' END)::"LugarParada", COALESCE(p."destinoSedeId", p."obraId"),
  p."destinoNombre", p."destinoDireccion", p."destinoLat", p."destinoLng",
  (CASE
    WHEN v."etapa" = 'FINALIZADO' THEN 'COMPLETADA'
    WHEN v."etapa" = 'EN_DESTINO' THEN 'LLEGO'
    WHEN v."etapa" = 'HACIA_DESTINO' THEN 'EN_CAMINO'
    ELSE 'PENDIENTE' END)::"EstadoParada",
  COALESCE(v."llegadaDestinoEn", v."llegadaReal"), v."llegadaReal", v."distanciaDestinoM", v."duracionDestinoS"
FROM "Viaje" v JOIN "PedidoViaje" p ON p."id" = v."pedidoId";

INSERT INTO "ViajePedido" ("id", "viajeId", "pedidoViajeId", "paradaRetiroId", "paradaEntregaId", "orden", "costoImputado")
SELECT 'vp_' || v."id", v."id", v."pedidoId", (SELECT r."id" FROM "ViajeParada" r WHERE r."id" = 'pr_' || v."id"), 'pe_' || v."id", 1, v."costoCalculado"
FROM "Viaje" v;

INSERT INTO "ItemParada" ("id", "paradaId", "pedidoViajeId", "descripcion", "obraNombre", "marcado", "marcadoEn")
SELECT 'ip_' || x."id", x."id", v."pedidoId", p."descripcion", o."nombre", x."estado" = 'COMPLETADA', x."salidaEn"
FROM "ViajeParada" x JOIN "Viaje" v ON v."id" = x."viajeId" JOIN "PedidoViaje" p ON p."id" = v."pedidoId" JOIN "Obra" o ON o."id" = p."obraId";

UPDATE "Viaje" v SET "distanciaTotalM" = s.total
FROM (SELECT "viajeId", SUM("distanciaDesdeAnteriorM") AS total FROM "ViajeParada" GROUP BY "viajeId") s
WHERE s."viajeId" = v."id" AND s.total IS NOT NULL;

-- 4) Los depósitos "Terreno 1" y "Terreno 2" eran provisorios: se dan de baja (nada se borra).
UPDATE "Ubicacion" SET "activa" = false WHERE "nombre" IN ('Terreno 1', 'Terreno 2');
UPDATE "Ubicacion" SET "etiqueta" = 'Base' WHERE "tipo" = 'BASE_VEHICULOS' AND "etiqueta" IS NULL;
UPDATE "Ubicacion" SET "etiqueta" = 'Galpón' WHERE "tipo" = 'DEPOSITO' AND "etiqueta" IS NULL;

-- 5) Una sola orden de compra vigente por pedido; un número de OC nunca se repite (además del UNIQUE):
--    el formato es OC-AAAA-NNNN.
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_numero_formato" CHECK ("numero" IS NULL OR "numero" ~ '^OC-[0-9]{4}-[0-9]{4,}$');
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_numero_si_enviada" CHECK ("estado" = 'BORRADOR' OR "numero" IS NOT NULL);
ALTER TABLE "RenglonOC" ADD CONSTRAINT "RenglonOC_cantidad_positiva" CHECK ("cantidad" > 0);
