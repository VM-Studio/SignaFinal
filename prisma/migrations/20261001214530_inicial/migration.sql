-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('DIRECCION', 'RESPONSABLE_OBRA', 'CAPATAZ', 'CHOFER', 'DEPOSITO', 'ADMINISTRACION');

-- CreateEnum
CREATE TYPE "EstadoObra" AS ENUM ('ACTIVA', 'PAUSADA', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "TipoUbicacion" AS ENUM ('DEPOSITO', 'BASE_VEHICULOS');

-- CreateEnum
CREATE TYPE "TipoVehiculo" AS ENUM ('CAMION', 'CAMIONETA', 'AUTO', 'MAQUINA');

-- CreateEnum
CREATE TYPE "EstadoVehiculo" AS ENUM ('DISPONIBLE', 'EN_VIAJE', 'EN_TALLER', 'FUERA_DE_SERVICIO');

-- CreateEnum
CREATE TYPE "TipoDocumentoVehiculo" AS ENUM ('SEGURO', 'VTV', 'PATENTE', 'CEDULA', 'RUTA', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoMantenimiento" AS ENUM ('SERVICE', 'REPARACION', 'NEUMATICOS', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoIncidente" AS ENUM ('MULTA', 'SINIESTRO', 'ROTURA', 'ROBO');

-- CreateEnum
CREATE TYPE "TipoPedido" AS ENUM ('RETIRO_PROVEEDOR', 'TRASLADO_MAQUINARIA', 'TRASLADO_HERRAMIENTAS', 'LLEVAR_A_OBRA', 'RETIRO_ESCOMBROS', 'TRASLADO_PERSONAS', 'OTRO');

-- CreateEnum
CREATE TYPE "OrigenTipo" AS ENUM ('BASE', 'PROVEEDOR', 'DEPOSITO', 'OBRA');

-- CreateEnum
CREATE TYPE "Prioridad" AS ENUM ('NORMAL', 'URGENTE');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('PENDIENTE', 'TOMADO', 'EN_VIAJE', 'ENTREGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoViaje" AS ENUM ('PROGRAMADO', 'EN_CURSO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "TipoControl" AS ENUM ('UNITARIA', 'CANTIDAD');

-- CreateEnum
CREATE TYPE "EstadoHerramienta" AS ENUM ('DISPONIBLE', 'EN_OBRA', 'EN_REPARACION', 'EXTRAVIADA', 'BAJA');

-- CreateEnum
CREATE TYPE "Condicion" AS ENUM ('BUENA', 'REGULAR', 'MALA');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ENTREGA', 'DEVOLUCION', 'TRANSFERENCIA', 'A_REPARACION', 'DE_REPARACION', 'EXTRAVIO', 'BAJA');

-- CreateEnum
CREATE TYPE "CategoriaSobrante" AS ENUM ('ELECTRICO', 'SANITARIO', 'OTRO');

-- CreateEnum
CREATE TYPE "Severidad" AS ENUM ('AVISO', 'CRITICA');

-- CreateEnum
CREATE TYPE "EstadoAlerta" AS ENUM ('ABIERTA', 'VISTA', 'RESUELTA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "licenciaCategoria" TEXT,
    "licenciaVencimiento" DATE,
    "vehiculoAsignadoId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Obra" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "localidad" TEXT NOT NULL,
    "latitud" DOUBLE PRECISION NOT NULL,
    "longitud" DOUBLE PRECISION NOT NULL,
    "responsableId" TEXT NOT NULL,
    "estado" "EstadoObra" NOT NULL DEFAULT 'ACTIVA',
    "idLebane" TEXT,
    "radioGeocercaM" INTEGER NOT NULL DEFAULT 200,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Obra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "localidad" TEXT NOT NULL,
    "latitud" DOUBLE PRECISION NOT NULL,
    "longitud" DOUBLE PRECISION NOT NULL,
    "telefono" TEXT,
    "idLebane" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ubicacion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoUbicacion" NOT NULL,
    "direccion" TEXT NOT NULL,
    "latitud" DOUBLE PRECISION NOT NULL,
    "longitud" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Ubicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehiculo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "patente" TEXT NOT NULL,
    "tipo" "TipoVehiculo" NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "capacidadCargaKg" INTEGER NOT NULL DEFAULT 0,
    "kmActual" INTEGER NOT NULL DEFAULT 0,
    "horasMotor" INTEGER,
    "costoKm" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoVehiculo" NOT NULL DEFAULT 'DISPONIBLE',
    "entraEnCola" BOOLEAN NOT NULL DEFAULT true,
    "asignadoAId" TEXT,
    "baseId" TEXT,
    "idCusat" TEXT,
    "fotoUrl" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoVehiculo" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "tipo" "TipoDocumentoVehiculo" NOT NULL,
    "vencimiento" DATE,
    "archivoUrl" TEXT,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoVehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargaCombustible" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "litros" DECIMAL(10,2) NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "km" INTEGER NOT NULL,
    "comprobanteUrl" TEXT,
    "obraId" TEXT,

    CONSTRAINT "CargaCombustible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MantenimientoVehiculo" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "tipo" "TipoMantenimiento" NOT NULL,
    "fecha" DATE NOT NULL,
    "km" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "taller" TEXT,
    "costo" DECIMAL(12,2) NOT NULL,
    "proximoKm" INTEGER,
    "proximaFecha" DATE,

    CONSTRAINT "MantenimientoVehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidenteVehiculo" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "tipo" "TipoIncidente" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "resuelto" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "IncidenteVehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoViaje" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "tipo" "TipoPedido" NOT NULL,
    "origenTipo" "OrigenTipo" NOT NULL,
    "origenId" TEXT NOT NULL,
    "proveedorId" TEXT,
    "ordenCompraLebane" TEXT,
    "descripcion" TEXT NOT NULL,
    "pesoKg" INTEGER,
    "cantidadPersonas" INTEGER,
    "necesitaCamion" BOOLEAN NOT NULL DEFAULT false,
    "paraCuando" TIMESTAMP(3) NOT NULL,
    "prioridad" "Prioridad" NOT NULL DEFAULT 'NORMAL',
    "estado" "EstadoPedido" NOT NULL DEFAULT 'PENDIENTE',
    "tomadoPorId" TEXT,
    "tomadoEn" TIMESTAMP(3),
    "motivoCancelacion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PedidoViaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Viaje" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "choferId" TEXT NOT NULL,
    "salidaReal" TIMESTAMP(3),
    "llegadaReal" TIMESTAMP(3),
    "kmSalida" INTEGER,
    "kmLlegada" INTEGER,
    "peajes" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costoCalculado" DECIMAL(12,2),
    "observaciones" TEXT,
    "estado" "EstadoViaje" NOT NULL DEFAULT 'PROGRAMADO',

    CONSTRAINT "Viaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosicionVehiculo" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "latitud" DOUBLE PRECISION NOT NULL,
    "longitud" DOUBLE PRECISION NOT NULL,
    "velocidad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rumbo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "motorEncendido" BOOLEAN NOT NULL DEFAULT false,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosicionVehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaHerramienta" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "CategoriaHerramienta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Herramienta" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "esMaquina" BOOLEAN NOT NULL DEFAULT false,
    "tipoControl" "TipoControl" NOT NULL DEFAULT 'UNITARIA',
    "marca" TEXT,
    "modelo" TEXT,
    "nroSerie" TEXT,
    "estado" "EstadoHerramienta" NOT NULL DEFAULT 'DISPONIBLE',
    "condicion" "Condicion" NOT NULL DEFAULT 'BUENA',
    "ubicacionId" TEXT,
    "obraId" TEXT,
    "responsableId" TEXT,
    "devolucionPrevista" DATE,
    "valorCompra" DECIMAL(14,2),
    "fotoUrl" TEXT,
    "mantenimientoCadaDias" INTEGER,
    "proximoMantenimiento" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Herramienta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExistenciaHerramienta" (
    "id" TEXT NOT NULL,
    "herramientaId" TEXT NOT NULL,
    "ubicacionId" TEXT,
    "obraId" TEXT,
    "cantidad" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExistenciaHerramienta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoHerramienta" (
    "id" TEXT NOT NULL,
    "herramientaId" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "desdeUbicacionId" TEXT,
    "desdeObraId" TEXT,
    "haciaUbicacionId" TEXT,
    "haciaObraId" TEXT,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "condicion" "Condicion",
    "registradoPorId" TEXT NOT NULL,
    "recibidoPorId" TEXT,
    "viajeId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,

    CONSTRAINT "MovimientoHerramienta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialSobrante" (
    "id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "categoria" "CategoriaSobrante" NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "unidad" TEXT NOT NULL,
    "obraOrigenId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialSobrante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alerta" (
    "id" TEXT NOT NULL,
    "claveUnica" TEXT NOT NULL,
    "regla" TEXT NOT NULL,
    "severidad" "Severidad" NOT NULL,
    "titulo" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "entidadTipo" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "enlace" TEXT,
    "estado" "EstadoAlerta" NOT NULL DEFAULT 'ABIERTA',
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "antes" JSONB,
    "despues" JSONB,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_vehiculoAsignadoId_key" ON "Usuario"("vehiculoAsignadoId");

-- CreateIndex
CREATE INDEX "Usuario_rol_activo_idx" ON "Usuario"("rol", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "Obra_codigo_key" ON "Obra"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Obra_idLebane_key" ON "Obra"("idLebane");

-- CreateIndex
CREATE INDEX "Obra_estado_idx" ON "Obra"("estado");

-- CreateIndex
CREATE INDEX "Obra_responsableId_idx" ON "Obra"("responsableId");

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_idLebane_key" ON "Proveedor"("idLebane");

-- CreateIndex
CREATE INDEX "Proveedor_nombre_idx" ON "Proveedor"("nombre");

-- CreateIndex
CREATE INDEX "Ubicacion_tipo_idx" ON "Ubicacion"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "Vehiculo_patente_key" ON "Vehiculo"("patente");

-- CreateIndex
CREATE UNIQUE INDEX "Vehiculo_idCusat_key" ON "Vehiculo"("idCusat");

-- CreateIndex
CREATE INDEX "Vehiculo_activo_entraEnCola_tipo_idx" ON "Vehiculo"("activo", "entraEnCola", "tipo");

-- CreateIndex
CREATE INDEX "Vehiculo_estado_idx" ON "Vehiculo"("estado");

-- CreateIndex
CREATE INDEX "Vehiculo_asignadoAId_idx" ON "Vehiculo"("asignadoAId");

-- CreateIndex
CREATE INDEX "DocumentoVehiculo_vehiculoId_tipo_idx" ON "DocumentoVehiculo"("vehiculoId", "tipo");

-- CreateIndex
CREATE INDEX "DocumentoVehiculo_vencimiento_idx" ON "DocumentoVehiculo"("vencimiento");

-- CreateIndex
CREATE INDEX "CargaCombustible_vehiculoId_fecha_idx" ON "CargaCombustible"("vehiculoId", "fecha");

-- CreateIndex
CREATE INDEX "CargaCombustible_obraId_idx" ON "CargaCombustible"("obraId");

-- CreateIndex
CREATE INDEX "MantenimientoVehiculo_vehiculoId_fecha_idx" ON "MantenimientoVehiculo"("vehiculoId", "fecha");

-- CreateIndex
CREATE INDEX "IncidenteVehiculo_vehiculoId_resuelto_idx" ON "IncidenteVehiculo"("vehiculoId", "resuelto");

-- CreateIndex
CREATE UNIQUE INDEX "PedidoViaje_numero_key" ON "PedidoViaje"("numero");

-- CreateIndex
CREATE INDEX "PedidoViaje_estado_prioridad_paraCuando_idx" ON "PedidoViaje"("estado", "prioridad", "paraCuando");

-- CreateIndex
CREATE INDEX "PedidoViaje_obraId_estado_idx" ON "PedidoViaje"("obraId", "estado");

-- CreateIndex
CREATE INDEX "PedidoViaje_tomadoPorId_estado_idx" ON "PedidoViaje"("tomadoPorId", "estado");

-- CreateIndex
CREATE INDEX "PedidoViaje_solicitanteId_idx" ON "PedidoViaje"("solicitanteId");

-- CreateIndex
CREATE UNIQUE INDEX "Viaje_pedidoId_key" ON "Viaje"("pedidoId");

-- CreateIndex
CREATE INDEX "Viaje_vehiculoId_estado_idx" ON "Viaje"("vehiculoId", "estado");

-- CreateIndex
CREATE INDEX "Viaje_choferId_estado_idx" ON "Viaje"("choferId", "estado");

-- CreateIndex
CREATE INDEX "Viaje_llegadaReal_idx" ON "Viaje"("llegadaReal");

-- CreateIndex
CREATE INDEX "PosicionVehiculo_vehiculoId_fecha_idx" ON "PosicionVehiculo"("vehiculoId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaHerramienta_nombre_key" ON "CategoriaHerramienta"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Herramienta_codigo_key" ON "Herramienta"("codigo");

-- CreateIndex
CREATE INDEX "Herramienta_estado_activo_idx" ON "Herramienta"("estado", "activo");

-- CreateIndex
CREATE INDEX "Herramienta_obraId_idx" ON "Herramienta"("obraId");

-- CreateIndex
CREATE INDEX "Herramienta_categoriaId_idx" ON "Herramienta"("categoriaId");

-- CreateIndex
CREATE INDEX "Herramienta_devolucionPrevista_idx" ON "Herramienta"("devolucionPrevista");

-- CreateIndex
CREATE INDEX "ExistenciaHerramienta_obraId_idx" ON "ExistenciaHerramienta"("obraId");

-- CreateIndex
CREATE UNIQUE INDEX "ExistenciaHerramienta_herramientaId_ubicacionId_obraId_key" ON "ExistenciaHerramienta"("herramientaId", "ubicacionId", "obraId");

-- CreateIndex
CREATE INDEX "MovimientoHerramienta_herramientaId_fecha_idx" ON "MovimientoHerramienta"("herramientaId", "fecha");

-- CreateIndex
CREATE INDEX "MovimientoHerramienta_fecha_idx" ON "MovimientoHerramienta"("fecha");

-- CreateIndex
CREATE INDEX "MaterialSobrante_categoria_idx" ON "MaterialSobrante"("categoria");

-- CreateIndex
CREATE UNIQUE INDEX "Alerta_claveUnica_key" ON "Alerta"("claveUnica");

-- CreateIndex
CREATE INDEX "Alerta_estado_severidad_idx" ON "Alerta"("estado", "severidad");

-- CreateIndex
CREATE INDEX "Alerta_entidadTipo_entidadId_idx" ON "Alerta"("entidadTipo", "entidadId");

-- CreateIndex
CREATE INDEX "Auditoria_entidad_entidadId_idx" ON "Auditoria"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "Auditoria_fecha_idx" ON "Auditoria"("fecha");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_vehiculoAsignadoId_fkey" FOREIGN KEY ("vehiculoAsignadoId") REFERENCES "Vehiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehiculo" ADD CONSTRAINT "Vehiculo_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehiculo" ADD CONSTRAINT "Vehiculo_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "Ubicacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoVehiculo" ADD CONSTRAINT "DocumentoVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargaCombustible" ADD CONSTRAINT "CargaCombustible_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargaCombustible" ADD CONSTRAINT "CargaCombustible_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargaCombustible" ADD CONSTRAINT "CargaCombustible_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MantenimientoVehiculo" ADD CONSTRAINT "MantenimientoVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidenteVehiculo" ADD CONSTRAINT "IncidenteVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidenteVehiculo" ADD CONSTRAINT "IncidenteVehiculo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoViaje" ADD CONSTRAINT "PedidoViaje_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoViaje" ADD CONSTRAINT "PedidoViaje_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoViaje" ADD CONSTRAINT "PedidoViaje_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoViaje" ADD CONSTRAINT "PedidoViaje_tomadoPorId_fkey" FOREIGN KEY ("tomadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viaje" ADD CONSTRAINT "Viaje_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoViaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viaje" ADD CONSTRAINT "Viaje_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viaje" ADD CONSTRAINT "Viaje_choferId_fkey" FOREIGN KEY ("choferId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosicionVehiculo" ADD CONSTRAINT "PosicionVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Herramienta" ADD CONSTRAINT "Herramienta_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaHerramienta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Herramienta" ADD CONSTRAINT "Herramienta_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "Ubicacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Herramienta" ADD CONSTRAINT "Herramienta_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Herramienta" ADD CONSTRAINT "Herramienta_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExistenciaHerramienta" ADD CONSTRAINT "ExistenciaHerramienta_herramientaId_fkey" FOREIGN KEY ("herramientaId") REFERENCES "Herramienta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExistenciaHerramienta" ADD CONSTRAINT "ExistenciaHerramienta_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "Ubicacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExistenciaHerramienta" ADD CONSTRAINT "ExistenciaHerramienta_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoHerramienta" ADD CONSTRAINT "MovimientoHerramienta_herramientaId_fkey" FOREIGN KEY ("herramientaId") REFERENCES "Herramienta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoHerramienta" ADD CONSTRAINT "MovimientoHerramienta_desdeUbicacionId_fkey" FOREIGN KEY ("desdeUbicacionId") REFERENCES "Ubicacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoHerramienta" ADD CONSTRAINT "MovimientoHerramienta_desdeObraId_fkey" FOREIGN KEY ("desdeObraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoHerramienta" ADD CONSTRAINT "MovimientoHerramienta_haciaUbicacionId_fkey" FOREIGN KEY ("haciaUbicacionId") REFERENCES "Ubicacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoHerramienta" ADD CONSTRAINT "MovimientoHerramienta_haciaObraId_fkey" FOREIGN KEY ("haciaObraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoHerramienta" ADD CONSTRAINT "MovimientoHerramienta_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoHerramienta" ADD CONSTRAINT "MovimientoHerramienta_recibidoPorId_fkey" FOREIGN KEY ("recibidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoHerramienta" ADD CONSTRAINT "MovimientoHerramienta_viajeId_fkey" FOREIGN KEY ("viajeId") REFERENCES "Viaje"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialSobrante" ADD CONSTRAINT "MaterialSobrante_obraOrigenId_fkey" FOREIGN KEY ("obraOrigenId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auditoria" ADD CONSTRAINT "Auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════ Reglas de negocio garantizadas por la base ═══════════

-- Herramienta unitaria: en el depósito o en una obra, nunca en ambos.
ALTER TABLE "Herramienta" ADD CONSTRAINT "Herramienta_un_solo_lugar"
  CHECK (NOT ("ubicacionId" IS NOT NULL AND "obraId" IS NOT NULL));

-- Existencias por cantidad: exactamente un lugar, cantidad no negativa, una fila por lugar.
ALTER TABLE "ExistenciaHerramienta" ADD CONSTRAINT "Existencia_un_lugar"
  CHECK (("ubicacionId" IS NULL) <> ("obraId" IS NULL));
ALTER TABLE "ExistenciaHerramienta" ADD CONSTRAINT "Existencia_cantidad_no_negativa" CHECK ("cantidad" >= 0);
CREATE UNIQUE INDEX "Existencia_herramienta_lugar_unico"
  ON "ExistenciaHerramienta" ("herramientaId", COALESCE("ubicacionId", ''), COALESCE("obraId", ''));

-- Un chofer no puede tener dos viajes en curso. Un vehículo tampoco.
CREATE UNIQUE INDEX "Viaje_un_viaje_en_curso_por_chofer" ON "Viaje" ("choferId") WHERE "estado" = 'EN_CURSO';
CREATE UNIQUE INDEX "Viaje_un_viaje_en_curso_por_vehiculo" ON "Viaje" ("vehiculoId") WHERE "estado" = 'EN_CURSO';

-- Km y plata coherentes.
ALTER TABLE "Viaje"
  ADD CONSTRAINT "Viaje_km_llegada_mayor_o_igual" CHECK ("kmLlegada" IS NULL OR "kmSalida" IS NULL OR "kmLlegada" >= "kmSalida"),
  ADD CONSTRAINT "Viaje_peajes_no_negativos" CHECK ("peajes" >= 0),
  ADD CONSTRAINT "Viaje_finalizado_completo" CHECK ("estado" <> 'FINALIZADO' OR ("kmLlegada" IS NOT NULL AND "llegadaReal" IS NOT NULL AND "costoCalculado" IS NOT NULL));
ALTER TABLE "Vehiculo"
  ADD CONSTRAINT "Vehiculo_valores_no_negativos" CHECK ("costoKm" >= 0 AND "kmActual" >= 0 AND "capacidadCargaKg" >= 0);
ALTER TABLE "CargaCombustible"
  ADD CONSTRAINT "CargaCombustible_valores" CHECK ("litros" > 0 AND "monto" >= 0);
ALTER TABLE "MantenimientoVehiculo" ADD CONSTRAINT "Mantenimiento_costo_no_negativo" CHECK ("costo" >= 0);

-- Un pedido tomado, en viaje o entregado siempre tiene chofer.
ALTER TABLE "PedidoViaje" ADD CONSTRAINT "PedidoViaje_tomado_tiene_chofer"
  CHECK ("estado" IN ('PENDIENTE', 'CANCELADO') OR "tomadoPorId" IS NOT NULL);
ALTER TABLE "PedidoViaje" ADD CONSTRAINT "PedidoViaje_peso_positivo" CHECK ("pesoKg" IS NULL OR "pesoKg" > 0);

ALTER TABLE "MovimientoHerramienta" ADD CONSTRAINT "Movimiento_cantidad_positiva" CHECK ("cantidad" > 0);

-- Nada se borra: la auditoría es solo de inserción.
CREATE OR REPLACE FUNCTION auditoria_inmutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La auditoría no se modifica ni se borra';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Auditoria_inmutable" BEFORE UPDATE OR DELETE ON "Auditoria"
  FOR EACH ROW EXECUTE FUNCTION auditoria_inmutable();
