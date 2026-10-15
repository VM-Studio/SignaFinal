-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- DOCUMENTO DE COMPRA UNIFICADO (CLAUDE.md, "Documento de compra (OC/PE)").
-- Cada PedidoMaterial pasa a ser una OrdenCompra (el documento): si tenía una OC vigente, el pedido se
-- funde en ella; si no, se crea el documento con el mismo id del pedido. Su historia de estados, sus
-- adjuntos, sus habilitaciones (MaterialListo), su auditoría, favoritos y avisos apuntan al documento.
-- Después se borran PedidoMaterial y CambioEstadoMaterial. Los estados pasan a los del documento.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

CREATE TYPE "EstadoFacturacion" AS ENUM ('PENDIENTE', 'FACTURADA');
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'AUTORIZADO', 'PAGADO');

-- ── 1. Columnas nuevas del documento (estado y fuente pasan a texto mientras se migra) ──
ALTER TABLE "OrdenCompra"
  ADD COLUMN "numeroInterno" INTEGER,
  ADD COLUMN "obraSedeId" TEXT,
  ADD COLUMN "observacionesSolicitante" TEXT,
  ADD COLUMN "prioridad" "Prioridad" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "tomadoPorId" TEXT,
  ADD COLUMN "tomadoEn" TIMESTAMP(3),
  ADD COLUMN "presupuestoSolicitado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "completo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "notaDevolucion" TEXT,
  ADD COLUMN "enviadaAComprasEn" TIMESTAMP(3),
  ADD COLUMN "rechazadaEn" TIMESTAMP(3),
  ADD COLUMN "estadoFacturacion" "EstadoFacturacion" NOT NULL DEFAULT 'PENDIENTE',
  ADD COLUMN "pagoSolicitadoPorId" TEXT,
  ADD COLUMN "pagoSolicitadoEn" TIMESTAMP(3),
  ADD COLUMN "estadoPago" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
  ADD COLUMN "versionesCeldas" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "estadoNuevo" TEXT;

-- El número llega al enviar a autorización (las de antes pueden no tenerlo): la regla nueva va al final.
ALTER TABLE "OrdenCompra" DROP CONSTRAINT IF EXISTS "OrdenCompra_numero_si_enviada";
ALTER TABLE "OrdenCompra" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "OrdenCompra" ALTER COLUMN "estado" TYPE TEXT USING "estado"::text;
ALTER TABLE "OrdenCompra" ALTER COLUMN "fuente" DROP DEFAULT;
ALTER TABLE "OrdenCompra" ALTER COLUMN "fuente" TYPE TEXT USING "fuente"::text;
ALTER TABLE "OrdenCompra" ALTER COLUMN "estadoTablero" TYPE TEXT USING "estadoTablero"::text;
ALTER TABLE "OrdenCompra" ALTER COLUMN "estadoTableroAuto" TYPE TEXT USING "estadoTableroAuto"::text;

-- ── 2. Qué documento es cada pedido ──
CREATE TABLE "_pm_doc" ("pm_id" TEXT PRIMARY KEY, "doc_id" TEXT NOT NULL, "fundido" BOOLEAN NOT NULL);
INSERT INTO "_pm_doc" ("pm_id", "doc_id", "fundido")
SELECT pm."id", COALESCE(oc."id", pm."id"), oc."id" IS NOT NULL
FROM "PedidoMaterial" pm LEFT JOIN "OrdenCompra" oc ON oc."id" = pm."ordenCompraId";

-- Estado del documento según el paso del pedido.
CREATE FUNCTION pg_temp.estado_de_material(e TEXT, encargada TIMESTAMP) RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE e
    WHEN 'SOLICITADO' THEN 'ENVIADA_A_COMPRAS'
    WHEN 'EN_COMPRA' THEN 'EN_COMPRAS'
    WHEN 'ESPERANDO_APROBACION' THEN 'ESPERANDO_AUTORIZACION'
    WHEN 'APROBADO' THEN CASE WHEN encargada IS NULL THEN 'AUTORIZADA' ELSE 'ENCARGADA' END
    WHEN 'LISTO_PARA_RETIRAR' THEN 'HABILITADA'
    WHEN 'RETIRO_PEDIDO' THEN 'HABILITADA'
    WHEN 'EN_CAMINO' THEN 'HABILITADA'
    WHEN 'ENTREGADO' THEN 'ENTREGADA'
    ELSE 'ANULADA' END
$$;

-- Quién empezó el pedido (el primer paso de su historia; si no, el que pidió).
CREATE TABLE "_pm_creador" AS
SELECT pm."id" AS "pm_id", COALESCE((SELECT c."usuarioId" FROM "CambioEstadoMaterial" c WHERE c."pedidoMaterialId" = pm."id" AND c."usuarioId" IS NOT NULL ORDER BY c."fecha" ASC LIMIT 1), pm."solicitanteId") AS "usuarioId"
FROM "PedidoMaterial" pm;

-- ── 3a. Pedido con OC vigente: se funde en esa OC ──
UPDATE "OrdenCompra" oc SET
  "numeroInterno" = pm."numero",
  "obraId" = COALESCE(oc."obraId", pm."obraId"),
  "obraSedeId" = pm."obraSedeId",
  "solicitanteId" = CASE WHEN oc."solicitanteId" IS NULL AND oc."solicitanteExternoId" IS NULL THEN pm."solicitanteId" ELSE oc."solicitanteId" END,
  "detallePedido" = COALESCE(NULLIF(oc."detallePedido", ''), pm."descripcion"),
  "fechaNecesaria" = COALESCE(oc."fechaNecesaria", pm."paraCuando"),
  "prioridad" = pm."prioridad",
  "observacionesSolicitante" = pm."observaciones",
  "notasInternas" = NULLIF(CONCAT_WS(E'\n', NULLIF(pm."notasCompras", ''), NULLIF(oc."notasInternas", '')), ''),
  "tomadoPorId" = pm."tomadoPorId",
  "tomadoEn" = pm."tomadoEn",
  "presupuestoSolicitado" = pm."presupuestoSolicitado",
  "completo" = pm."completo",
  "enviadaAComprasEn" = pm."creadoEn",
  "aprobadaPorId" = COALESCE(oc."aprobadaPorId", pm."aprobadoPorId"),
  "aprobadaEn" = COALESCE(oc."aprobadaEn", pm."aprobadoEn"),
  "motivoAnulacion" = COALESCE(oc."motivoAnulacion", pm."motivoCancelacion"),
  "ordenCompraLebaneId" = COALESCE(oc."ordenCompraLebaneId", pm."ordenCompraLebaneId"),
  "creadaPorId" = cr."usuarioId",
  "creadoEn" = LEAST(oc."creadoEn", pm."creadoEn"),
  "estadoNuevo" = pg_temp.estado_de_material(pm."estado"::text, oc."encargadaEn")
FROM "PedidoMaterial" pm JOIN "_pm_creador" cr ON cr."pm_id" = pm."id"
WHERE pm."ordenCompraId" = oc."id";

-- ── 3b. Pedido sin OC: el documento se crea con el id del pedido ──
INSERT INTO "OrdenCompra" (
  "id", "numeroInterno", "tipo", "fecha", "fechaNecesaria", "solicitanteId", "obraId", "obraSedeId", "detallePedido",
  "empresaCompraId", "prioridad", "observacionesSolicitante", "notasInternas", "tomadoPorId", "tomadoEn",
  "presupuestoSolicitado", "completo", "enviadaAComprasEn", "aprobadaPorId", "aprobadaEn", "motivoAnulacion",
  "ordenCompraLebaneId", "creadaPorId", "fuente", "estado", "estadoNuevo", "importeAConfirmar", "moneda", "version",
  "versionAprobacion", "creadoEn", "actualizadoEn"
)
SELECT pm."id", pm."numero", 'OC', pm."creadoEn"::date, pm."paraCuando", pm."solicitanteId", pm."obraId", pm."obraSedeId", pm."descripcion",
  COALESCE(o."razonSocialId", (SELECT "id" FROM "RazonSocial" WHERE "id" = 'rs_signa')), pm."prioridad", pm."observaciones", pm."notasCompras",
  pm."tomadoPorId", pm."tomadoEn", pm."presupuestoSolicitado", pm."completo", pm."creadoEn", pm."aprobadoPorId", pm."aprobadoEn",
  pm."motivoCancelacion", pm."ordenCompraLebaneId", cr."usuarioId", 'SISTEMA', 'BORRADOR',
  pg_temp.estado_de_material(pm."estado"::text, NULL), false, 'ARS', 1, 1, pm."creadoEn", pm."actualizadoEn"
FROM "PedidoMaterial" pm
JOIN "_pm_creador" cr ON cr."pm_id" = pm."id"
JOIN "Obra" o ON o."id" = pm."obraId"
WHERE pm."ordenCompraId" IS NULL;

-- Sus renglones (los que había escrito el que pidió) quedan como renglones del documento.
INSERT INTO "RenglonOC" ("id", "ordenCompraId", "orden", "descripcion", "cantidad", "unidad")
SELECT pm."id" || '_r' || r.ord, pm."id", r.ord, LEFT(COALESCE(r.x->>'descripcion', ''), 200),
  COALESCE(NULLIF(r.x->>'cantidad', '')::numeric, 1), COALESCE(NULLIF(r.x->>'unidad', ''), 'u')
FROM "PedidoMaterial" pm, LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(pm."renglones") = 'array' THEN pm."renglones" ELSE '[]'::jsonb END) WITH ORDINALITY AS r(x, ord)
WHERE pm."ordenCompraId" IS NULL AND COALESCE(r.x->>'descripcion', '') <> '';

-- ── 3c. Las otras órdenes de un pedido (rechazadas o anuladas antes de la vigente) ──
UPDATE "OrdenCompra" oc SET
  "obraSedeId" = pm."obraSedeId", "prioridad" = pm."prioridad",
  "detallePedido" = COALESCE(NULLIF(oc."detallePedido", ''), pm."descripcion"),
  "fechaNecesaria" = COALESCE(oc."fechaNecesaria", pm."paraCuando")
FROM "PedidoMaterial" pm
WHERE oc."pedidoMaterialId" = pm."id" AND oc."estadoNuevo" IS NULL;

-- ── 3d. Estado de las órdenes que no salieron de un pedido vigente ──
UPDATE "OrdenCompra" SET "estadoNuevo" = CASE
  WHEN "fuente" = 'IMPORTADA_EXCEL' THEN CASE COALESCE("estadoTablero", '')
    WHEN 'PEDIR_AUTORIZACION' THEN 'ESPERANDO_AUTORIZACION'
    WHEN 'AUTORIZADA' THEN 'AUTORIZADA'
    WHEN 'SOLICITUD_PRESUPUESTO' THEN 'EN_COMPRAS'
    WHEN 'ENCARGADO' THEN 'ENCARGADA'
    WHEN 'ENTREGADO' THEN 'ENTREGADA'
    WHEN 'ANULADA' THEN 'ANULADA'
    ELSE CASE "estado" WHEN 'APROBADA' THEN 'AUTORIZADA' WHEN 'ESPERANDO_APROBACION' THEN 'ESPERANDO_AUTORIZACION' WHEN 'BORRADOR' THEN 'EN_COMPRAS' ELSE "estado" END
  END
  ELSE CASE "estado"
    WHEN 'BORRADOR' THEN 'EN_COMPRAS'
    WHEN 'ESPERANDO_APROBACION' THEN 'ESPERANDO_AUTORIZACION'
    WHEN 'APROBADA' THEN CASE WHEN "estadoTableroAuto" = 'ENTREGADO' THEN 'ENTREGADA' WHEN "encargadaEn" IS NOT NULL OR "estadoTableroAuto" = 'ENCARGADO' THEN 'ENCARGADA' ELSE 'AUTORIZADA' END
    ELSE "estado" END
END
WHERE "estadoNuevo" IS NULL;

-- Número interno para las órdenes que no tenían pedido (después de los números de pedido).
WITH sin AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "creadoEn", "id") AS n FROM "OrdenCompra" WHERE "numeroInterno" IS NULL
)
UPDATE "OrdenCompra" oc SET "numeroInterno" = (SELECT COALESCE(MAX("numero"), 0) FROM "PedidoMaterial") + sin.n
FROM sin WHERE sin."id" = oc."id";
CREATE SEQUENCE "OrdenCompra_numeroInterno_seq" OWNED BY "OrdenCompra"."numeroInterno";
SELECT setval('"OrdenCompra_numeroInterno_seq"', GREATEST((SELECT COALESCE(MAX("numeroInterno"), 0) FROM "OrdenCompra"), 1));
ALTER TABLE "OrdenCompra" ALTER COLUMN "numeroInterno" SET DEFAULT nextval('"OrdenCompra_numeroInterno_seq"');
ALTER TABLE "OrdenCompra" ALTER COLUMN "numeroInterno" SET NOT NULL;
CREATE UNIQUE INDEX "OrdenCompra_numeroInterno_key" ON "OrdenCompra"("numeroInterno");

-- ── 4. Lo que colgaba del pedido pasa al documento ──
CREATE TABLE "CambioEstadoOC" (
  "id" TEXT NOT NULL,
  "ordenCompraId" TEXT NOT NULL,
  "de" TEXT,
  "a" TEXT NOT NULL,
  "usuarioId" TEXT,
  "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nota" TEXT,
  CONSTRAINT "CambioEstadoOC_pkey" PRIMARY KEY ("id")
);
INSERT INTO "CambioEstadoOC" ("id", "ordenCompraId", "de", "a", "usuarioId", "fecha", "nota")
SELECT c."id", m."doc_id",
  CASE WHEN c."de" IS NULL THEN NULL ELSE pg_temp.estado_de_material(c."de"::text, NULL) END,
  pg_temp.estado_de_material(c."a"::text, NULL), c."usuarioId", c."fecha", c."nota"
FROM "CambioEstadoMaterial" c JOIN "_pm_doc" m ON m."pm_id" = c."pedidoMaterialId";
-- Los saltos que eran el mismo paso del documento (listo → retiro pedido → en camino) quedan como nota.
UPDATE "CambioEstadoOC" SET "nota" = COALESCE("nota", 'Avanzó el retiro') WHERE "de" = "a";

ALTER TABLE "MaterialListo" ADD COLUMN "ordenCompraId" TEXT;
UPDATE "MaterialListo" ml SET "ordenCompraId" = m."doc_id" FROM "_pm_doc" m WHERE m."pm_id" = ml."pedidoMaterialId";
ALTER TABLE "MaterialListo" ALTER COLUMN "ordenCompraId" SET NOT NULL;
ALTER TABLE "MaterialListo" DROP CONSTRAINT "MaterialListo_pedidoMaterialId_fkey";
DROP INDEX "MaterialListo_pedidoMaterialId_idx";
ALTER TABLE "MaterialListo" DROP COLUMN "pedidoMaterialId";
CREATE INDEX "MaterialListo_ordenCompraId_idx" ON "MaterialListo"("ordenCompraId");

UPDATE "Adjunto" a SET "entidadTipo" = 'ORDEN_COMPRA', "entidadId" = m."doc_id" FROM "_pm_doc" m WHERE a."entidadTipo" = 'PEDIDO_MATERIAL' AND a."entidadId" = m."pm_id";
UPDATE "Adjunto" SET "entidadTipo" = 'ORDEN_COMPRA' WHERE "entidadTipo" = 'PEDIDO_MATERIAL';
-- La auditoría no se toca (es inmutable): lo viejo queda como "PedidoMaterial" con el id del pedido.
UPDATE "PedidoFavorito" f SET "pedidoId" = m."doc_id" FROM "_pm_doc" m WHERE f."tipo" = 'MATERIALES' AND f."pedidoId" = m."pm_id";
UPDATE "Notificacion" n SET "enlace" = '/compras/oc/' || m."doc_id" FROM "_pm_doc" m WHERE n."enlace" IN ('/materiales/' || m."pm_id", '/compras/' || m."pm_id", '/mis-pedidos/material/' || m."pm_id");
UPDATE "Alerta" a SET "enlace" = '/compras/oc/' || m."doc_id", "entidadId" = m."doc_id" FROM "_pm_doc" m WHERE a."entidadId" = m."pm_id";
DELETE FROM "EventoCambio" WHERE "entidad" = 'PEDIDO_MATERIAL';

-- ── 5. Fuente, facturación y pago ──
UPDATE "OrdenCompra" oc SET "fuente" = CASE
  WHEN oc."fuente" = 'IMPORTADA_EXCEL' THEN 'IMPORTADA'
  ELSE CASE (SELECT u."rol"::text FROM "Usuario" u WHERE u."id" = oc."creadaPorId")
    WHEN 'RESPONSABLE_OBRA' THEN 'ARQUITECTA' WHEN 'CAPATAZ' THEN 'ARQUITECTA'
    WHEN 'ADMINISTRACION' THEN 'ADMINISTRACION' WHEN 'DIRECCION' THEN 'DIRECCION' ELSE 'COMPRAS' END
END;
UPDATE "OrdenCompra" SET
  "facturaCondicion" = COALESCE("facturaCondicion", "condicionPago"),
  "estadoFacturacion" = CASE WHEN COALESCE("facturaNumero", '') <> '' THEN 'FACTURADA'::"EstadoFacturacion" ELSE 'PENDIENTE'::"EstadoFacturacion" END,
  "estadoPago" = CASE WHEN "fechaPago" IS NOT NULL THEN 'PAGADO'::"EstadoPago" WHEN "ordenPagoAutorizadaEn" IS NOT NULL THEN 'AUTORIZADO'::"EstadoPago" ELSE 'PENDIENTE'::"EstadoPago" END,
  "rechazadaEn" = CASE WHEN "estadoNuevo" = 'RECHAZADA' THEN "actualizadoEn" END;

-- ── 6. Tipos nuevos (estado del documento, fuente y tablero con HABILITADA entre Encargado y Entregado) ──
UPDATE "OrdenCompra" SET "estado" = "estadoNuevo";
ALTER TABLE "OrdenCompra" DROP COLUMN "estadoNuevo";
DROP TYPE "EstadoOC";
CREATE TYPE "EstadoOC" AS ENUM ('BORRADOR', 'ENVIADA_A_COMPRAS', 'EN_COMPRAS', 'ESPERANDO_AUTORIZACION', 'AUTORIZADA', 'RECHAZADA', 'ENCARGADA', 'HABILITADA', 'ENTREGADA', 'ANULADA');
ALTER TABLE "OrdenCompra" ALTER COLUMN "estado" TYPE "EstadoOC" USING "estado"::"EstadoOC";
ALTER TABLE "OrdenCompra" ALTER COLUMN "estado" SET DEFAULT 'BORRADOR';
ALTER TABLE "CambioEstadoOC" ALTER COLUMN "de" TYPE "EstadoOC" USING "de"::"EstadoOC";
ALTER TABLE "CambioEstadoOC" ALTER COLUMN "a" TYPE "EstadoOC" USING "a"::"EstadoOC";
-- Lo que espera al dueño siempre tiene número.
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_numero_si_espera" CHECK ("estado" <> 'ESPERANDO_AUTORIZACION' OR "numero" IS NOT NULL);

DROP TYPE "FuenteOC";
CREATE TYPE "FuenteOC" AS ENUM ('ARQUITECTA', 'COMPRAS', 'ADMINISTRACION', 'DIRECCION', 'IMPORTADA');
ALTER TABLE "OrdenCompra" ALTER COLUMN "fuente" TYPE "FuenteOC" USING "fuente"::"FuenteOC";
ALTER TABLE "OrdenCompra" ALTER COLUMN "fuente" SET DEFAULT 'COMPRAS';

-- Tablero: lo que sale del estado (estadoTablero.ts); el ajuste a mano se respeta si lo había.
UPDATE "OrdenCompra" SET "estadoTablero" = NULL WHERE "estadoTablero" IS NOT NULL AND "estadoTablero" = "estadoTableroAuto" AND "fuente" <> 'IMPORTADA';
UPDATE "OrdenCompra" SET "estadoTableroAuto" = CASE
  WHEN "fuente" = 'IMPORTADA' THEN "estadoTableroAuto"
  ELSE CASE "estado"::text
    WHEN 'ANULADA' THEN 'ANULADA' WHEN 'RECHAZADA' THEN 'ANULADA'
    WHEN 'ESPERANDO_AUTORIZACION' THEN 'PEDIR_AUTORIZACION'
    WHEN 'AUTORIZADA' THEN 'AUTORIZADA'
    WHEN 'ENCARGADA' THEN 'ENCARGADO'
    WHEN 'HABILITADA' THEN 'HABILITADA'
    WHEN 'ENTREGADA' THEN 'ENTREGADO'
    ELSE CASE WHEN "presupuestoSolicitado" THEN 'SOLICITUD_PRESUPUESTO' END
  END
END;
UPDATE "OrdenCompra" SET "estadoTablero" = "estadoTableroAuto" WHERE "estadoTablero" IS NULL OR "fuente" = 'IMPORTADA';
DROP TYPE "EstadoTablero";
CREATE TYPE "EstadoTablero" AS ENUM ('PEDIR_AUTORIZACION', 'AUTORIZADA', 'SOLICITUD_PRESUPUESTO', 'ENCARGADO', 'HABILITADA', 'ENTREGADO', 'ANULADA');
ALTER TABLE "OrdenCompra" ALTER COLUMN "estadoTablero" TYPE "EstadoTablero" USING "estadoTablero"::"EstadoTablero";
ALTER TABLE "OrdenCompra" ALTER COLUMN "estadoTableroAuto" TYPE "EstadoTablero" USING "estadoTableroAuto"::"EstadoTablero";

ALTER TYPE "FormaPago" ADD VALUE 'ACOPIO';

BEGIN;
CREATE TYPE "EntidadAdjunto_new" AS ENUM ('ORDEN_COMPRA', 'VIAJE', 'HERRAMIENTA', 'VEHICULO');
ALTER TABLE "Adjunto" ALTER COLUMN "entidadTipo" TYPE "EntidadAdjunto_new" USING ("entidadTipo"::text::"EntidadAdjunto_new");
ALTER TYPE "EntidadAdjunto" RENAME TO "EntidadAdjunto_old";
ALTER TYPE "EntidadAdjunto_new" RENAME TO "EntidadAdjunto";
DROP TYPE "public"."EntidadAdjunto_old";
COMMIT;

BEGIN;
CREATE TYPE "EntidadCambio_new" AS ENUM ('PEDIDO_VIAJE', 'VIAJE', 'ORDEN_COMPRA', 'MATERIAL_LISTO', 'HERRAMIENTA', 'ALERTA', 'AVISO');
ALTER TABLE "EventoCambio" ALTER COLUMN "entidad" TYPE "EntidadCambio_new" USING ("entidad"::text::"EntidadCambio_new");
ALTER TYPE "EntidadCambio" RENAME TO "EntidadCambio_old";
ALTER TYPE "EntidadCambio_new" RENAME TO "EntidadCambio";
DROP TYPE "public"."EntidadCambio_old";
COMMIT;

-- ── 7. Fuera el pedido de material ──
ALTER TABLE "OrdenCompra" DROP CONSTRAINT "OrdenCompra_pedidoMaterialId_fkey";
DROP INDEX "OrdenCompra_pedidoMaterialId_idx";
ALTER TABLE "OrdenCompra" DROP COLUMN "pedidoMaterialId";
DROP TABLE "CambioEstadoMaterial";
DROP TABLE "PedidoMaterial";
DROP TYPE "EstadoMaterial";
DROP TYPE "FuenteMaterial";
DROP TABLE "_pm_doc";
DROP TABLE "_pm_creador";

-- ── 8. Lo nuevo: historial por celda, presencia y token del PDF ──
CREATE TABLE "CambioCelda" (
  "id" TEXT NOT NULL,
  "ordenCompraId" TEXT NOT NULL,
  "celda" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "anterior" TEXT,
  "nuevo" TEXT,
  "usuarioId" TEXT NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CambioCelda_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PresenciaDocumento" (
  "ordenCompraId" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "vistoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PresenciaDocumento_pkey" PRIMARY KEY ("ordenCompraId", "usuarioId")
);
CREATE TABLE "TokenDocumento" (
  "id" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  "ordenCompraId" TEXT NOT NULL,
  "expiraEn" TIMESTAMP(3) NOT NULL,
  "usadoEn" TIMESTAMP(3),
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TokenDocumento_pkey" PRIMARY KEY ("id")
);

DROP INDEX "OrdenCompra_obraId_idx";
CREATE INDEX "CambioEstadoOC_ordenCompraId_fecha_idx" ON "CambioEstadoOC"("ordenCompraId", "fecha");
CREATE INDEX "CambioCelda_ordenCompraId_fecha_idx" ON "CambioCelda"("ordenCompraId", "fecha");
CREATE INDEX "CambioCelda_ordenCompraId_celda_version_idx" ON "CambioCelda"("ordenCompraId", "celda", "version");
CREATE INDEX "PresenciaDocumento_ordenCompraId_vistoEn_idx" ON "PresenciaDocumento"("ordenCompraId", "vistoEn");
CREATE UNIQUE INDEX "TokenDocumento_hash_key" ON "TokenDocumento"("hash");
CREATE INDEX "TokenDocumento_ordenCompraId_idx" ON "TokenDocumento"("ordenCompraId");
CREATE INDEX "OrdenCompra_estado_fechaNecesaria_idx" ON "OrdenCompra"("estado", "fechaNecesaria");
CREATE INDEX "OrdenCompra_obraId_estado_idx" ON "OrdenCompra"("obraId", "estado");
CREATE INDEX "OrdenCompra_creadaPorId_estado_idx" ON "OrdenCompra"("creadaPorId", "estado");
CREATE INDEX "OrdenCompra_estadoFacturacion_estadoPago_idx" ON "OrdenCompra"("estadoFacturacion", "estadoPago");

ALTER TABLE "MaterialListo" ADD CONSTRAINT "MaterialListo_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_obraSedeId_fkey" FOREIGN KEY ("obraSedeId") REFERENCES "ObraSede"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_tomadoPorId_fkey" FOREIGN KEY ("tomadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_pagoSolicitadoPorId_fkey" FOREIGN KEY ("pagoSolicitadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CambioEstadoOC" ADD CONSTRAINT "CambioEstadoOC_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CambioEstadoOC" ADD CONSTRAINT "CambioEstadoOC_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CambioCelda" ADD CONSTRAINT "CambioCelda_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CambioCelda" ADD CONSTRAINT "CambioCelda_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PresenciaDocumento" ADD CONSTRAINT "PresenciaDocumento_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PresenciaDocumento" ADD CONSTRAINT "PresenciaDocumento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
