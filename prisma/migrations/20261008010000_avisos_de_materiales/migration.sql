-- Avisos del circuito de Compras (pedido de material: tomado, aprobado, listo, en camino, entregado).
ALTER TYPE "TipoNotificacion" ADD VALUE 'MATERIAL' BEFORE 'GENERAL';
