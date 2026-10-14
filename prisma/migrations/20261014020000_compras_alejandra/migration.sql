-- La persona de Compras es Alejandra: el saludo del inicio y las notas del tablero ("ajustado a mano por
-- Alejandra") usan el nombre real. Solo si sigue con el nombre genérico de los datos base.
UPDATE "Usuario" SET "nombre" = 'Alejandra' WHERE "rol" = 'COMPRAS' AND "nombre" = 'Compras';
