-- Índices según los filtros reales (EXPLAIN de las listas más usadas).
CREATE INDEX "PedidoViaje_estado_prioridad_fechaNecesaria_idx" ON "PedidoViaje"("estado", "prioridad", "fechaNecesaria");
CREATE INDEX "Notificacion_usuarioId_creadaEn_idx" ON "Notificacion"("usuarioId", "creadaEn");
