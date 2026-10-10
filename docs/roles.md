# Signa · Qué ve cada uno

Cada persona tiene **su versión** de la app: ve solo lo que le sirve. Si entra a una pantalla que
no es suya (por ejemplo, escribiendo la dirección a mano), la app la lleva a su inicio. Todo se
controla en el servidor: no alcanza con esconder un botón.

La regla de fondo: **cada dato vive en un solo sistema**. Stock de materiales, cajas y contabilidad
están en Lebane; Signa organiza los viajes, la flota, las herramientas y el circuito de los pedidos de
material, **con la orden de compra armada acá** (número OC-AAAA-NNNN, PDF y aprobación del dueño).
Obras y proveedores se cargan en Signa mientras no haya API de Lebane (docs/pendientes.md).

---

## Dirección (el dueño)

**Ve todo.** Todas las pantallas de todos los roles, todas las alertas y todo lo que hace cada uno.

- **Inicio**: el mapa en vivo con todos los vehículos y cuatro números: solicitudes pendientes,
  viajes en curso, alertas críticas y acciones de hoy.
- **Barra**: Mapa · Solicitudes · Viajes · Más. En **Más**, agrupado: Pedidos y viajes, Flota,
  Depósito, Mapa, Alertas, Actividad, Costos, Obras.
- **Solicitudes**: todas las pendientes. Puede **asignar** una a un chofer (elige chofer, vehículo
  y hora), como si la hubiera aceptado él.
- **Viajes**: todos los viajes de todos los choferes, en curso y terminados.
- **Actividad**: cada acción de cada usuario en una lista, con filtros por persona, tipo de acción,
  obra y fecha, buscador y exportación a CSV. Una ficha por persona con su mes.
- **Usuarios**: alta, rol, licencias, obras de cada responsable, desactivar.
- **Proveedores** con buscador y sus **sucursales** (cada una con dirección en el mapa, horario y
  contacto); **Obras** con alta y edición (dirección ubicada en el mapa, sedes si tiene varios
  frentes); **Configuración → Ubicaciones**: base y depósitos (Galpón Florida, Terreno Humboldt).
- **Seguimiento**: en cualquier viaje en curso ve el mapa con el camión y la hora estimada.
  En modo demo tiene el botón **"Demo: avanzar 1 km"** para mostrar el seguimiento en una reunión.
- **Avisos**: una copia de los avisos de cada viaje (aceptado, salió, cargando, llegó, demoras)
  en su bandeja, sin notificación en el celular para no llenarlo.
- **Aprobaciones**: cada orden de compra con **todos los datos escritos** (número, proveedor y
  sucursal, renglones con cantidad y precio, subtotal, IVA, total, método de pago, condiciones, lo que
  pidió la obra) y el **PDF**. **Aprobar** (un toque, con 10 s para deshacer; queda el PDF con el sello
  "Aprobada por…") o **Rechazar** con motivo (vuelve a Compras). Le llega un push por cada OC nueva.
  También ve toda la pantalla de Compras y **Órdenes de compra** (todas, con buscador y CSV).
- **Fechas de los viajes**: si un chofer pide adelantar un viaje, le llega el aviso; desde el detalle
  del pedido, **Reprogramar** (día y hora). A las 9:00, en su bandeja, el resumen de los viajes de hoy
  que todavía no salieron.
- **Rastreo (Cusat)**: estado de la conexión con Cusat, "Probar conexión", "Sincronizar ahora" y
  qué unidad de Cusat es cada vehículo (se enlazan solas por patente; las otras, a mano).
- **Demo**: en un viaje en curso, los botones **Simular: llegó al retiro / salió / llegó a destino**.

**No hay nada que no vea.**

---

## Responsable de obra (Leandro, Daniela, César, Vicky)

Trabaja **solo con sus obras** (las que tiene asignadas en la tabla de responsables).

- **Inicio**: botón grande **"Pedir un viaje"**, sus pedidos de hoy con estado en palabras
  ("Aceptado por Claudio · sale 8:30", "En viaje · llega 10:40 aprox") y los viajes que van hoy
  a sus obras.
- **Barra**: Obras · Pedir · Viajes · Herramientas (sin "Más").
- **Obras**: sus obras con pedidos activos y herramientas; en cada una, pedidos, herramientas
  (quién la tiene y desde cuándo) y datos (dirección con "Abrir en Maps", responsables).
- **Pedir**: arriba, dos botones: **Pedir un viaje** y **Pedir materiales a Compras**.
  - *Viaje*: tres pasos. Si alguien ya pidió algo parecido para la misma obra en las últimas 48 h,
    la app le avisa con nombre y fecha ("Lolo ya pidió esto hoy a las 9:00…") y decide él.
  - *Retiro en proveedor*: ya no se escribe el proveedor. Se elige de la lista de **lo que Compras
    dejó listo** en esa obra (marca uno o varios); si son de dos proveedores, se crean dos viajes.
  - *Materiales*: obra (y sede si tiene varias), un renglón por material **o la planilla / foto
    adjunta** (Excel, PDF, Word, CSV o fotos, hasta 20 MB cada uno; con uno alcanza), **observaciones**
    para Compras, para cuándo y prioridad. "Pedido enviado a Compras. Te avisamos en cada paso."
- **Mis pedidos**: arriba **Viajes** y **Materiales**.
  - *Viajes*: Pendientes / Aceptados / Entregados. En el detalle, el **seguimiento en vivo** como
    PedidosYa: cinco pasos (Aceptado · Salió · En el retiro · En camino · Entregado), el mapa con el
    camión (de Cusat o del teléfono del chofer, con "hace 30 seg"), "Claudio está a 6 km, llega
    9:40 aprox" y el botón para llamar al chofer. Puede cancelar mientras está pendiente.
  - *Materiales*: cada pedido con su estado en palabras ("Compras lo está comprando", "Esperando
    aprobación del dueño"…). Lo **listo para retirar** aparece en verde con **Pedir el viaje**. En el
    detalle, sus observaciones y adjuntos, la **OC aprobada** (número, proveedor, sucursal, quién y
    cuándo aprobó, **PDF aprobado**; nunca las notas internas de Compras), la línea de tiempo de 8
    pasos y, si ya va en camino, el seguimiento del viaje.
  - Un pedido de viaje pendiente o aceptado (sin salir) se puede **Reprogramar** (día y hora).
  - Si el viaje lleva pedidos de otras obras, el seguimiento es de **su** parte: "Claudio está en el
    corralón cargando tu pedido (también lleva material para Chubut)", "Salió, antes pasa por Chubut,
    después Darwin · está a 9 km". Sin clave de Google, solo distancia (nunca una hora inventada).
- **Viajes**: lo que ya aceptaron los choferes y va a sus obras ("hoy a Darwin llegan dos camiones").
- **Herramientas**: las disponibles para pedir (botón "Pedir": obra y fecha), y un buscador de
  todas con dónde está cada una ("En Obra Chubut · la tiene César desde el 28/9"). Si pide la
  misma herramienta para la misma obra y el mismo día que otro, la app avisa.

**Avisos que recibe** (en la campana y, si los activó, en el celular): su pedido fue aceptado,
el chofer salió, llegó al retiro, salió hacia la obra, llegó a la obra, viene con demora, no hay
señal del camión, lo soltaron; alguien pidió una herramienta que está en su obra; cada paso de
sus pedidos de material (Compras lo tomó, aprobado, **listo para retirar en tal proveedor**,
entregado). **Alertas**: su pedido urgente sin aceptar, pedidos repetidos de su obra,
herramientas vencidas que tiene él o su obra, material listo hace más de 3 días sin retirar.

**No ve**: las solicitudes pendientes de otras personas, flota, costos, mapa general, agenda,
alertas de vehículos, licencias, combustible ni de choferes, ni la actividad de los demás.

---

## Capataz general (Lolo)

**Igual que el responsable de obra, pero con todas las obras.** Mismas pantallas, misma barra,
mismos avisos; también pide materiales a Compras. Cancela solo sus propios pedidos y mientras
están pendientes.

**No ve**: lo mismo que el responsable de obra.

---

## Chofer (Claudio, Cristian, David)

La versión más simple: botones grandes y una cosa por pantalla.

- **Inicio**: su viaje en curso con el botón de lo que sigue o, si no tiene, **"Solicitudes
  pendientes: 4"**, y los viajes aceptados de hoy.
- **Barra**: Hoy · Solicitudes · Combustible · Más (Mi cuenta, Mis avisos, Cerrar sesión).
- **La fecha, primero y grande**, en toda tarjeta: "HOY · 8:30" (negro), "MAÑANA · por la tarde"
  (ámbar), "LUNES 13/10 · 8:30" (gris), "ATRASADO · ayer 8:30" (rojo). Es la fecha del pedido, nunca
  la de aceptación.
- **Hoy**: solo los de hoy (los atrasados arriba, en rojo); el que está en curso primero. **Próximos**:
  agrupados por día con el día como título. **Todos**: historial con buscador por obra. Un viaje
  combinado es una sola tarjeta: "3 pedidos · 4 paradas · 31 km" y las obras.
- **Solicitudes**: todas las pendientes, urgentes primero. **Aceptar** abre **"Aprovechá el viaje"**:
  lo que hay para retirar en el mismo lugar ("En Corralón San Martín también hay para retirar: hierro
  para Chubut…") y lo que queda cerca de su camino ("A 1,2 km del corralón: hormigonera…"), con
  casilla, fecha, peso y para quién (los de otro día en gris). Después el vehículo: si el peso total no
  entra (ej. 5.200 kg en el Kia de 3.000), lo dice y no deja confirmar. Si otro lo aceptó un segundo
  antes: "Ya lo aceptó Cristian".
- **Bloqueo por fecha**: un viaje para otro día muestra **Iniciar viaje** deshabilitado con "Este viaje
  es para el lunes 13/10" (el servidor lo rechaza igual) y **Pedir que lo adelanten** (avisa al que
  pidió y al dueño, que lo reprograman).
- **Pantalla del viaje, por paradas**: arriba la parada actual (retirar o entregar, dirección, horario,
  contacto y OC del retiro, **solo distancia** salvo que haya Google con tránsito); la **lista de
  verificación** de esa parada (al cargar, por obra: "→ Darwin: 40 bolsas cemento (OC-2026-0012)"; al
  entregar, solo lo de esa obra), con **Faltó** (cantidad real y nota: avisa al que pidió y a Compras);
  **Cargué todo, salgo** / **Entregado acá** (con foto del remito opcional); abajo, las paradas
  numeradas con su estado y km, **Reordenar** y **Agregar parada** (mientras no llegó a ninguna).
  **Abrir en Google Maps** arma la ruta con las paradas que faltan. **Viaje terminado** (km y peajes una
  vez) aparece en la última parada.
- **GPS y botón manual**: las llegadas y salidas las detecta el GPS (Cusat, o el teléfono). El botón
  manual dice el lugar: **"Llegué al proveedor / al galpón / al terreno / a la obra / a la base"**; si no
  hay GPS hace 3 minutos pasa a ser el principal ("Sin señal GPS: marcá a mano"). Si llega a otra parada
  antes, la app pregunta "Llegaste a Chubut antes que a Darwin, ¿seguimos así?". Sin señal, cada botón
  se guarda en el teléfono y se manda solo al volver.
- Mientras viaja, el teléfono manda su posición cada 30 s (si dio permiso de ubicación).
- **Combustible**: cuatro campos, con el vehículo del viaje en curso ya elegido y la carga imputada
  a esa obra.

**Avisos (recordatorios)**: el día anterior a las 18:00 ("Mañana tenés un retiro en Corralón San Martín
a las 8:30 para Obra Darwin"), el mismo día a las 7:00 (con varios viajes, uno solo con la lista en
orden) y, si llegó la hora y no inició, a la hora y cada 60 minutos (hasta 4). También: solicitud
urgente nueva, le reprogramaron un viaje, cancelaron un pedido que había aceptado. **Alertas**:
urgentes sin aceptar, pedidos para hoy sin chofer, su licencia por vencer, documentos o service de su
camioneta, su viaje de más de 10 h.

**No ve**: los pedidos ya aceptados por otros choferes, precios de las órdenes de compra (solo
materiales y cantidades), depósito, flota, costos, obras, mapa general, ni alertas de otros choferes.

---

## Depósito (encargado)

- **Inicio**: acción principal **"Depósito"**, las herramientas que hay que preparar hoy (traslados ya
  aceptados) y las devoluciones vencidas.
- **Barra**: Depósito · Sobrantes · Entregas · Más (Inicio, Alta masiva).
- **Depósito**: la maquinaria y las herramientas, con el filtro *Maquinaria* / *Herramientas*, buscador y
  ubicación. Desde cada ficha entrega, recibe, transfiere y manda a reparar; mantenimiento de maquinaria.
- **Sobrantes**: los materiales de construcción que sobraron de las obras (construcción, eléctrico,
  sanitario, otro), con cantidad y de qué obra vinieron. Se agregan y se "usan" (todo o una parte).
- Alta masiva de herramientas por CSV.

**Alertas**: devoluciones vencidas, máquinas en obras pausadas, mantenimiento de máquinas vencido.

**No ve**: solicitudes de viaje (salvo los traslados de herramientas), flota, costos, mapa,
alertas de vehículos o choferes, ni la actividad de los demás.

---

## Compras (la persona de compras)

- **Inicio**: botón grande **"Pedidos nuevos: 3"**, cuántos hay en compra, esperando al dueño,
  aprobados y sin retirar hace más de 3 días, y la lista de los demorados.
- **Barra**: Pedidos · Habilitados · Proveedores · Más (Inicio, Mis avisos, Mi cuenta).
- **Pedidos** (la cola): Nuevos / En compra / Esperando aprobación / Aprobados / Listos. Urgentes
  primero, después por para cuándo; en rojo lo demorado (más de 2 días hábiles sin comprar, más de
  un día esperando al dueño). Filtro por obra. **Nuevo pedido** para lo que le piden por teléfono.
- **Detalle**: arriba las **observaciones** del que pidió y sus **adjuntos** (se ven en la app o se
  descargan); **notas internas de Compras** y adjuntos propios (presupuestos) que el que pidió no ve.
  UN botón con lo que sigue: **Tomar** → **Armar orden de compra** → (esperando al dueño) →
  **Habilitar para retirar** → listo. Cancelar con motivo.
- **Orden de compra** (`/compras/{pedido}/oc`): el formulario de la plantilla con los datos ya copiados
  del pedido; **Importar desde la planilla adjunta** (xlsx o csv) para no transcribir; proveedor con
  buscador y **sucursal** (o **Nuevo proveedor** / **Agregar sucursal** sin salir); renglones con precio,
  IVA, método de pago (acopio, cuenta corriente, transferencia, efectivo o eCheq), condiciones
  y observaciones; **Vista previa del PDF**. **Enviar a aprobación** le asigna el número (OC-2026-0001,
  correlativo, nunca se repite) y le avisa al dueño. Si la rechazan: **Corregir y reenviar** (número
  nuevo; la vieja queda como historial). **Anular** con motivo.
- **Habilitar para retirar**: si hay OC aprobada, viene precargado (proveedor, sucursal, OC y renglones
  para tildar lo que se retira ahora; retiros parciales).
- **Órdenes de compra**: todas, con buscador (número, proveedor, obra), filtros por estado y fechas,
  PDF y **CSV** (lo que va a recibir Lebane).
- **Habilitados**: lo que habilitó y qué pasó después (sin retiro pedido, retiro pedido, en camino,
  entregado); en rojo lo que lleva 3 días o más sin que la obra pida el viaje.
- **Proveedores**: buscador, ficha con CUIT, teléfono, mail y sus **sucursales** (dirección en el mapa,
  horario y contacto de retiro), y las OC de ese proveedor.

**Avisos**: pedido de material nuevo (con las primeras palabras de las observaciones y cuántos
adjuntos trae), el dueño aprobó o rechazó la OC, faltó material en un retiro ("Retiraron 30 de 40
bolsas"), el material se entregó o volvió a quedar sin retirar. **Alertas**: pedidos demorados, material sin retirar.

**No ve**: solicitudes de viaje, flota, costos, mapa, depósito ni la actividad de los demás (solo
el seguimiento de los viajes que retiran sus materiales).

---

## Administración (oficina)

- **Inicio**: vencimientos de documentación de los próximos 30 días y el costo del mes por obra.
- **Barra**: Flota · Costos · Alertas · Más (Inicio, Agenda, Mantenimiento, Obras, Usuarios, Ubicaciones).
- Documentación de vehículos, mantenimiento, incidentes, costos por obra y por vehículo con
  exportación para Lebane. Un viaje con varias obras **reparte su costo** por tramo entre ellas.
- **Usuarios**: alta de personas, rol, teléfono, licencia de los choferes y obras de cada
  responsable. Para sacar a alguien se lo desactiva (no se borra nada). No puede dar de alta a
  alguien de Dirección.

**Alertas**: documentos por vencer o vencidos, licencias, service próximo, consumo de combustible
anómalo, vehículos en movimiento fuera de horario o parados en viaje.

**No ve**: solicitudes ni pedidos, el mapa en vivo, depósito ni la actividad de los demás.
