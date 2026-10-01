-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('DIRECCION', 'RESPONSABLE_OBRA', 'CAPATAZ', 'CHOFER', 'DEPOSITO', 'ADMINISTRACION');

-- CreateEnum
CREATE TYPE "TipoLugar" AS ENUM ('COCHERA', 'DEPOSITO');

-- CreateEnum
CREATE TYPE "TipoVehiculo" AS ENUM ('CAMION', 'CAMIONETA', 'AUTO');

-- CreateEnum
CREATE TYPE "TipoMantenimiento" AS ENUM ('SERVICE', 'CUBIERTAS', 'FRENOS', 'REPARACION', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('PENDIENTE', 'TOMADO', 'EN_VIAJE', 'ENTREGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoCarga" AS ENUM ('MATERIALES', 'MAQUINARIA', 'HERRAMIENTAS', 'OTRO');

-- CreateEnum
CREATE TYPE "VehiculoRequerido" AS ENUM ('CUALQUIERA', 'CAMION', 'CAMIONETA', 'AUTO');

-- CreateEnum
CREATE TYPE "Prioridad" AS ENUM ('NORMAL', 'URGENTE');

-- CreateEnum
CREATE TYPE "EstadoViaje" AS ENUM ('EN_VIAJE', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "TipoControl" AS ENUM ('UNITARIA', 'CANTIDAD');

-- CreateEnum
CREATE TYPE "CategoriaItem" AS ENUM ('MAQUINARIA', 'HERRAMIENTA', 'SOBRANTE');

-- CreateEnum
CREATE TYPE "EstadoItem" AS ENUM ('OPERATIVO', 'EN_REPARACION', 'FUERA_DE_SERVICIO');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ALTA', 'ENTREGA', 'DEVOLUCION', 'TRANSFERENCIA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "TipoSolicitud" AS ENUM ('PEDIDO', 'DEVOLUCION');

-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('PENDIENTE', 'COMPLETADA', 'RECHAZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "Severidad" AS ENUM ('AVISO', 'CRITICO');

-- CreateEnum
CREATE TYPE "AreaAlerta" AS ENUM ('FLOTA', 'PEDIDOS', 'DEPOSITO', 'PERSONAS');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "telefono" TEXT,
    "licenciaVence" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Obra" (
    "id" TEXT NOT NULL,
    "idLebane" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "localidad" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "sincronizadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Obra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" TEXT NOT NULL,
    "idLebane" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rubro" TEXT,
    "direccion" TEXT NOT NULL,
    "localidad" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "sincronizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenCompra" (
    "id" TEXT NOT NULL,
    "idLebane" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "descripcion" TEXT NOT NULL,
    "pesoEstimadoKg" INTEGER,
    "abierta" BOOLEAN NOT NULL DEFAULT true,
    "proveedorId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "sincronizadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrdenCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lugar" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoLugar" NOT NULL,
    "direccion" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Lugar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehiculo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoVehiculo" NOT NULL,
    "patente" TEXT NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "anio" INTEGER,
    "capacidadKg" INTEGER NOT NULL DEFAULT 0,
    "costoKm" DECIMAL(12,2) NOT NULL,
    "kmActual" INTEGER NOT NULL DEFAULT 0,
    "seguroCompania" TEXT,
    "seguroPoliza" TEXT,
    "seguroVence" DATE,
    "vtvVence" DATE,
    "idCusat" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "asignadoAId" TEXT,
    "lugarId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mantenimiento" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "tipo" "TipoMantenimiento" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "km" INTEGER,
    "costo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taller" TEXT,
    "proximoKm" INTEGER,
    "proximaFecha" DATE,
    "registradoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mantenimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargaCombustible" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "vehiculoId" TEXT NOT NULL,
    "choferId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "litros" DECIMAL(10,2) NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "km" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CargaCombustible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoViaje" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "clientId" TEXT,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'PENDIENTE',
    "prioridad" "Prioridad" NOT NULL DEFAULT 'NORMAL',
    "tipoCarga" "TipoCarga" NOT NULL,
    "vehiculoRequerido" "VehiculoRequerido" NOT NULL DEFAULT 'CUALQUIERA',
    "descripcion" TEXT NOT NULL,
    "pesoKg" INTEGER,
    "observaciones" TEXT,
    "necesarioPara" DATE,
    "solicitanteId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "proveedorId" TEXT,
    "ordenCompraId" TEXT,
    "origenTexto" TEXT,
    "choferId" TEXT,
    "vehiculoId" TEXT,
    "tomadoEn" TIMESTAMP(3),
    "canceladoEn" TIMESTAMP(3),
    "canceladoPorId" TEXT,
    "motivoCancelacion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PedidoViaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Viaje" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "choferId" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "estado" "EstadoViaje" NOT NULL DEFAULT 'EN_VIAJE',
    "kmSalida" INTEGER NOT NULL,
    "kmLlegada" INTEGER,
    "kmRecorridos" INTEGER,
    "peajes" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costoKmAplicado" DECIMAL(12,2) NOT NULL,
    "costo" DECIMAL(12,2),
    "salidaEn" TIMESTAMP(3) NOT NULL,
    "llegadaEn" TIMESTAMP(3),
    "observaciones" TEXT,
    "clientIdInicio" TEXT,
    "clientIdFin" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Viaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "CategoriaItem" NOT NULL,
    "control" "TipoControl" NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "numeroSerie" TEXT,
    "unidad" TEXT,
    "estado" "EstadoItem" NOT NULL DEFAULT 'OPERATIVO',
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "obraId" TEXT,
    "tenedorId" TEXT,
    "ubicadoDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "obraId" TEXT,
    "cantidad" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoItem" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "desdeObraId" TEXT,
    "haciaObraId" TEXT,
    "recibidoPorId" TEXT,
    "registradoPorId" TEXT NOT NULL,
    "solicitudId" TEXT,
    "observaciones" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudHerramienta" (
    "id" TEXT NOT NULL,
    "tipo" "TipoSolicitud" NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'PENDIENTE',
    "itemId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "obraId" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "resueltaPorId" TEXT,
    "observaciones" TEXT,
    "motivoRechazo" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltaEn" TIMESTAMP(3),

    CONSTRAINT "SolicitudHerramienta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alerta" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "regla" TEXT NOT NULL,
    "area" "AreaAlerta" NOT NULL,
    "severidad" "Severidad" NOT NULL,
    "titulo" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "href" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,
    "resueltaEn" TIMESTAMP(3),

    CONSTRAINT "Alerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "detalle" JSONB,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ResponsablesObra" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ResponsablesObra_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_usuario_key" ON "Usuario"("usuario");

-- CreateIndex
CREATE INDEX "Usuario_rol_activo_idx" ON "Usuario"("rol", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "Obra_idLebane_key" ON "Obra"("idLebane");

-- CreateIndex
CREATE INDEX "Obra_activa_idx" ON "Obra"("activa");

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_idLebane_key" ON "Proveedor"("idLebane");

-- CreateIndex
CREATE INDEX "Proveedor_activo_idx" ON "Proveedor"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCompra_idLebane_key" ON "OrdenCompra"("idLebane");

-- CreateIndex
CREATE INDEX "OrdenCompra_obraId_abierta_idx" ON "OrdenCompra"("obraId", "abierta");

-- CreateIndex
CREATE INDEX "OrdenCompra_proveedorId_idx" ON "OrdenCompra"("proveedorId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehiculo_patente_key" ON "Vehiculo"("patente");

-- CreateIndex
CREATE UNIQUE INDEX "Vehiculo_idCusat_key" ON "Vehiculo"("idCusat");

-- CreateIndex
CREATE INDEX "Vehiculo_activo_tipo_idx" ON "Vehiculo"("activo", "tipo");

-- CreateIndex
CREATE INDEX "Vehiculo_asignadoAId_idx" ON "Vehiculo"("asignadoAId");

-- CreateIndex
CREATE INDEX "Mantenimiento_vehiculoId_fecha_idx" ON "Mantenimiento"("vehiculoId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "CargaCombustible_clientId_key" ON "CargaCombustible"("clientId");

-- CreateIndex
CREATE INDEX "CargaCombustible_vehiculoId_fecha_idx" ON "CargaCombustible"("vehiculoId", "fecha");

-- CreateIndex
CREATE INDEX "CargaCombustible_choferId_fecha_idx" ON "CargaCombustible"("choferId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "PedidoViaje_numero_key" ON "PedidoViaje"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "PedidoViaje_clientId_key" ON "PedidoViaje"("clientId");

-- CreateIndex
CREATE INDEX "PedidoViaje_estado_prioridad_creadoEn_idx" ON "PedidoViaje"("estado", "prioridad", "creadoEn");

-- CreateIndex
CREATE INDEX "PedidoViaje_obraId_estado_idx" ON "PedidoViaje"("obraId", "estado");

-- CreateIndex
CREATE INDEX "PedidoViaje_choferId_estado_idx" ON "PedidoViaje"("choferId", "estado");

-- CreateIndex
CREATE INDEX "PedidoViaje_solicitanteId_idx" ON "PedidoViaje"("solicitanteId");

-- CreateIndex
CREATE UNIQUE INDEX "Viaje_pedidoId_key" ON "Viaje"("pedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "Viaje_clientIdInicio_key" ON "Viaje"("clientIdInicio");

-- CreateIndex
CREATE UNIQUE INDEX "Viaje_clientIdFin_key" ON "Viaje"("clientIdFin");

-- CreateIndex
CREATE INDEX "Viaje_obraId_llegadaEn_idx" ON "Viaje"("obraId", "llegadaEn");

-- CreateIndex
CREATE INDEX "Viaje_vehiculoId_salidaEn_idx" ON "Viaje"("vehiculoId", "salidaEn");

-- CreateIndex
CREATE INDEX "Viaje_choferId_salidaEn_idx" ON "Viaje"("choferId", "salidaEn");

-- CreateIndex
CREATE UNIQUE INDEX "Item_codigo_key" ON "Item"("codigo");

-- CreateIndex
CREATE INDEX "Item_categoria_activo_idx" ON "Item"("categoria", "activo");

-- CreateIndex
CREATE INDEX "Item_obraId_idx" ON "Item"("obraId");

-- CreateIndex
CREATE INDEX "StockItem_obraId_idx" ON "StockItem"("obraId");

-- CreateIndex
CREATE INDEX "MovimientoItem_itemId_fecha_idx" ON "MovimientoItem"("itemId", "fecha");

-- CreateIndex
CREATE INDEX "MovimientoItem_fecha_idx" ON "MovimientoItem"("fecha");

-- CreateIndex
CREATE INDEX "SolicitudHerramienta_estado_creadaEn_idx" ON "SolicitudHerramienta"("estado", "creadaEn");

-- CreateIndex
CREATE INDEX "SolicitudHerramienta_obraId_estado_idx" ON "SolicitudHerramienta"("obraId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "Alerta_clave_key" ON "Alerta"("clave");

-- CreateIndex
CREATE INDEX "Alerta_activa_severidad_idx" ON "Alerta"("activa", "severidad");

-- CreateIndex
CREATE INDEX "Auditoria_entidad_entidadId_idx" ON "Auditoria"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "Auditoria_fecha_idx" ON "Auditoria"("fecha");

-- CreateIndex
CREATE INDEX "_ResponsablesObra_B_index" ON "_ResponsablesObra"("B");

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehiculo" ADD CONSTRAINT "Vehiculo_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehiculo" ADD CONSTRAINT "Vehiculo_lugarId_fkey" FOREIGN KEY ("lugarId") REFERENCES "Lugar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mantenimiento" ADD CONSTRAINT "Mantenimiento_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mantenimiento" ADD CONSTRAINT "Mantenimiento_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargaCombustible" ADD CONSTRAINT "CargaCombustible_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargaCombustible" ADD CONSTRAINT "CargaCombustible_choferId_fkey" FOREIGN KEY ("choferId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoViaje" ADD CONSTRAINT "PedidoViaje_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoViaje" ADD CONSTRAINT "PedidoViaje_choferId_fkey" FOREIGN KEY ("choferId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoViaje" ADD CONSTRAINT "PedidoViaje_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoViaje" ADD CONSTRAINT "PedidoViaje_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoViaje" ADD CONSTRAINT "PedidoViaje_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoViaje" ADD CONSTRAINT "PedidoViaje_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viaje" ADD CONSTRAINT "Viaje_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoViaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viaje" ADD CONSTRAINT "Viaje_choferId_fkey" FOREIGN KEY ("choferId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viaje" ADD CONSTRAINT "Viaje_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viaje" ADD CONSTRAINT "Viaje_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_tenedorId_fkey" FOREIGN KEY ("tenedorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoItem" ADD CONSTRAINT "MovimientoItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoItem" ADD CONSTRAINT "MovimientoItem_desdeObraId_fkey" FOREIGN KEY ("desdeObraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoItem" ADD CONSTRAINT "MovimientoItem_haciaObraId_fkey" FOREIGN KEY ("haciaObraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoItem" ADD CONSTRAINT "MovimientoItem_recibidoPorId_fkey" FOREIGN KEY ("recibidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoItem" ADD CONSTRAINT "MovimientoItem_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoItem" ADD CONSTRAINT "MovimientoItem_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudHerramienta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudHerramienta" ADD CONSTRAINT "SolicitudHerramienta_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudHerramienta" ADD CONSTRAINT "SolicitudHerramienta_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudHerramienta" ADD CONSTRAINT "SolicitudHerramienta_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudHerramienta" ADD CONSTRAINT "SolicitudHerramienta_resueltaPorId_fkey" FOREIGN KEY ("resueltaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auditoria" ADD CONSTRAINT "Auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ResponsablesObra" ADD CONSTRAINT "_ResponsablesObra_A_fkey" FOREIGN KEY ("A") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ResponsablesObra" ADD CONSTRAINT "_ResponsablesObra_B_fkey" FOREIGN KEY ("B") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
