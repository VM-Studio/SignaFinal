# Compras en Signa · Guía para Alejandra

Todo lo que hacías en tu planilla (OC NUEVA, PEDIDOS ESPECIALES y el TABLERO DE CONTROL) ahora está
en el sistema, con las mismas palabras y las mismas columnas, pero sin copiar y pegar. Entrás con tu
usuario de Compras y abajo (o a la izquierda en la computadora) tenés **Pedidos · Órdenes · Viajes · Más**.

## 1. El tablero (tu planilla de control)

**Órdenes.** Es tu "TABLERO DE CONTROL ORDENES DE C", con su franja rosa "Planilla de control COMPRAS": una
fila por orden, con tus columnas en tu orden: Nº · OC/PE · N° OC/PE · Fecha · Solicitado por · Obra · Proveedor
· Importe · Descripción/Materiales · Estado · Fecha de entrega · Observaciones en OC / Próximos pasos ·
Comentarios. El encabezado es gris y queda fijo al bajar; la Nº tiene el número de tu leyenda (0 pedir
autorización / autorizada, 1 solicitud de presupuesto, 2 encargado, 3 entregado) con su color, y los "A
confirmar" están en amarillo como tus "????".

![Tablero](compras/tablero.png)

- Arriba, cuatro tarjetas: **Todas**, **Pedir autorización**, **Encargado** y **Entregado este mes**. Tocás
  una y el tablero muestra solo esas; **Todas** vuelve a mostrar todo. Al lado, la leyenda de colores.
- **Estado**: tocás la celda y elegís de la lista; queda pintada del color del estado y aparece un tilde
  chico cuando se guardó. Si ponés uno que no corresponde con lo que pasó (por ejemplo Entregado sin que
  haya llegado), se acepta igual y queda anotado en Comentarios "(ajustado a mano por Alejandra el 14/10)".
- **Próximos pasos** y **Comentarios** se escriben en la misma celda, como en Excel: tocás, escribís (Enter
  es otra línea) y se guarda al salir de la celda o con Ctrl+Enter; Esc cancela. Queda guardado con tu
  nombre y la hora.
- Tocás una fila y se abre la orden completa a la derecha (en el celular, abajo), con las secciones 1 a 4,
  sin cambiar de pantalla.
- Por defecto arriba van las que vencen antes (Fecha de caducidad más cercana) y al final las
  entregadas y anuladas. Las vencidas dicen "venció 22/09" en rojo.

![Una orden abierta en el tablero](compras/tablero-orden.png)

### Qué significa cada estado

| Estado | Cuándo |
|---|---|
| **Solicitud de presupuesto** | Marcaste "Pedí presupuesto" en el pedido y todavía no armaste la OC. |
| **Pedir autorización** | La mandaste a aprobación: la tiene el dueño. |
| **Autorizada** | El dueño la aprobó. |
| **Encargado** | Ya se la pediste al proveedor ("Encargado al proveedor") o habilitaste algo para retirar. |
| **Entregado** | Llegó todo a la obra (y marcaste "con esto no falta nada"). |
| **Anulada** | La anulaste o el dueño la rechazó. |

El estado cambia solo con lo que va pasando. Si necesitás, lo cambiás a mano en la orden ("Estado en el
tablero"): queda así hasta que pase algo nuevo (por ejemplo, que llegue a la obra).

Los **pedidos especiales** además tienen su semáforo, como arriba de cada PE en tu planilla: No se hizo
nada todavía · En proceso (falta entregar o pagar) · Lista (paga y entregada) · Anulada.

## 2. Crear una OC o un PE (la plantilla)

**Órdenes → Nueva OC** (o **Nuevo PE**), arriba a la derecha. También desde un pedido de material: **Armar orden de compra**.
Es tu bloque de la planilla, con las mismas etiquetas y en el mismo orden:

![Plantilla de la orden](compras/plantilla-oc.png)

- **Encabezado:** OC o PE, el N° de Orden ("se asigna al enviar") y la Empresa que compra (sale la de la
  obra, o Signa Desarrollos).
- **1. Orden de Pedido:** Fecha del pedido, Fecha de caducidad (una semana después, como tu fórmula),
  Solicitado por (si no está en la lista, "+ otro nombre"), Obra, **Detalle del Pedido** (escribilo como
  siempre, una línea por material: "40 - bolsas de cemento"), Proveedor Sugerido, Proveedor Final,
  Presupuesto N°, Importe (o "A confirmar", tus "????"), Forma de Pago, Condición de Pago y Fecha de
  entrega programada.
  - **Pasar a renglones** convierte cada línea del detalle en un renglón con cantidad y unidad. Es
    opcional: con el detalle alcanza.
  - El Proveedor Final se puede dejar para después (hace falta para habilitar el retiro).
- **1.1 Observaciones de la Orden de Pedido:** van en el PDF.
- **Adjuntos:** el presupuesto del proveedor o la lista de materiales. Las notas internas no van en el PDF.
- **3. Facturación** y **4. Orden de Pago:** están plegadas; las completás cuando llega la factura o se
  paga. La autorización de la orden de pago la da el dueño con un botón.

Los botones de abajo:

- **Guardar:** queda como borrador, sin número, en la fila **Borradores sin enviar** arriba de la planilla.
  La retomás cuando quieras.
- **Vista previa PDF:** el PDF con la marca BORRADOR.
- **Enviar a aprobación:** le pone el número (OC-0417, o PE-0151: cada uno con su numeración), arma el PDF
  y le avisa al dueño con todos los datos escritos.

Si la orden no venía de un pedido (la armás vos directo), el sistema crea el pedido de material a nombre
de quien elegiste en "Solicitado por": así sigue el circuito (habilitar, retiro, entrega).

**Editar una orden ya autorizada:** la abrís y tocás **Editar**. Si cambiás el Proveedor Final, el
Importe, los materiales, la Forma o la Condición de Pago, vuelve a aprobación con el mismo número y "v2".
Si solo completás Facturación, Orden de Pago, Próximos pasos, Comentarios u Observaciones, no.

## 3. El PDF

Sale de los datos de la orden, con el diseño de tu bloque: el logo, ORDEN DE COMPRA o PEDIDO ESPECIAL,
la grilla con tus etiquetas, 1.1 Observaciones, 2. Autorización (con el sello cuando el dueño la aprueba)
y Facturación y Orden de Pago solo si tienen datos.

![PDF de una orden](compras/pdf-oc.png)

## 4. Buscar una orden

En **Órdenes**, el buscador encuentra por número, proveedor, obra, material u observaciones, y los filtros
(Tipo, Obra, Solicitado por, Proveedor, Estado, Fecha, Fecha de entrega) se combinan. Tocás una fila y la
orden completa se abre a la derecha.

## 5. Importar tu tablero de Excel

Por ahora lo hace el dueño (**Más → Compras → Importar Excel**). Opcional, para cargar tu historial:

1. Elegís el .xlsx. El sistema busca la hoja del tablero y la fila con "N° OC / PE" y "SOLICITADO POR".
2. Ves **todas** las filas: en rojo las que no se pueden importar (con el motivo), en amarillo las que
   conviene revisar (una fecha rara como "31/3/0202", un proveedor nuevo, una obra que no reconoció).
3. Corregís en la misma tabla (la obra, el estado, el número) o destildás las que no querés.
4. **Importar N filas válidas.**

![Vista previa de la importación](compras/importar.png)

- Entiende los errores de tipeo del estado (ENRTEGADO, ANUDALADA, ENCARGADAS…), los importes como "$
  723.839,42" y los "????" (quedan "A confirmar"), los números como "41 B", y los nombres sin tildes.
- Lo que no es un estado ("REPETIDA", "EN LA OFICINA") o una fecha de entrega que no es fecha ("jue/vier")
  pasa a Comentarios.
- Si importás dos veces el mismo archivo no se duplica: se actualizan las que ya estaban.
- Después de importar, la numeración sigue sola después del número más alto.

## 6. Exportar el tablero

**Exportar a Excel** (arriba a la derecha) baja un Excel como tu planilla: la franja de título, el
encabezado gris, tus mismas columnas en tu orden y con tus títulos, los colores de cada estado y los "A
CONFIRMAR" en amarillo, con los filtros que tengas puestos.

## 7. Filtros y vistas guardadas

En Órdenes, en Pedidos, en Viajes y en Habilitados tenés la misma barra, en una sola fila: un buscador,
chips que se combinan (Obra, Solicitado por, Proveedor, Estado, fechas…), el orden, **Limpiar** y **Vistas**.
Si no entran todos, los que sobran quedan en el botón **Filtros (N)**. En el celular están en el botón
**Filtros**.

![Pedidos con filtros](compras/cola-filtros.png)

- **Vistas → Guardar los filtros de ahora como vista:** le ponés un nombre ("Pendientes de retiro",
  "Pinares") y la tenés a un toque siempre.
- En **Pedidos**, la fecha de caducidad de hoy o vencida está en rojo y la de mañana en ámbar. En el filtro
  **Arquitecto/a** ves cuántos pidió cada uno.

## 8. Coordinar un viaje para las arquitectas

**Viajes → Coordinar viaje.** Primero "Para quién": la obra y el responsable. Después el formulario de
siempre. A la derecha, **Pedidos anteriores**: los viajes que coordinaste, para repetirlos. El pedido sale a nombre de esa persona y vos quedás como quien lo coordinó: los avisos del viaje
les llegan a las dos y el chofer ve "Pidió Daniela · coordinó …". Para un retiro en un proveedor elegís
"Retirar en un proveedor" y aparece lo que habilitaste para esa obra.

![Coordinar viaje](compras/coordinar-viaje.png)

**Viajes → Solicitudes:** todos los viajes (pendientes, aceptados, en curso y lo entregado hoy) en una tabla,
con filtros de Obra, Lugar, Persona, Prioridad, Fecha, Estado y Chofer. Con el filtro de **Lugar**, quedan
agrupados con una fila gris ("Corralón San Martín · 3 retiros"); tocás un lugar o un nombre de la tabla y ves
esos (de una persona, también los viejos). En los pendientes podés **Editar** (fecha,
prioridad, qué) o **Cancelar** con el motivo: les avisamos al que pidió y a los choferes.

![Solicitudes agrupadas por lugar](compras/solicitudes-por-lugar.png)

## 9. Numeración y "Solicitado por"

La numeración de OC y PE la fija el dueño en su Configuración (solo para arriba). Los nombres que piden sin
usuario (Romina, Hernán…) los agregás vos desde la misma orden: en **Solicitado por**, **+ otro nombre**.

## 10. El dólar

Arriba a la derecha, en la píldora verde: **$ Blue 1.550 · Oficial 1.535** (venta). En tu inicio, la tarjeta
**Dólar** con compra y venta del blue y del oficial y la hora. Tocalo para ver la fuente. Las órdenes en dólares guardan la venta
del oficial del día.

## Lo que ve el dueño

En **Aprobaciones** ve cada orden con todos los datos escritos (detalle, proveedor, importe, forma y
condición de pago, observaciones, adjuntos y el PDF) y la aprueba o la rechaza con el motivo. Si
rechaza, el pedido vuelve a "En compra" y la corregís con número nuevo.

![Aprobaciones](compras/aprobaciones.png)
