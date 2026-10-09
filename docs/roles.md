# Signa · Qué ve cada uno

Cada persona tiene **su versión** de la app: ve solo lo que le sirve. Si entra a una pantalla que
no es suya (por ejemplo, escribiendo la dirección a mano), la app la lleva a su inicio. Todo se
controla en el servidor: no alcanza con esconder un botón.

La regla de fondo: **cada dato vive en un solo sistema**. Obras, proveedores, órdenes de compra y
stock de materiales están en Lebane; Signa organiza los viajes, la flota, las herramientas y el
circuito de los pedidos de material (quién pidió qué, en qué paso está y cuándo se retira).

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
- **Usuarios**: alta, rol, licencias, obras de cada responsable, desactivar. **Proveedores**: la
  lista que viene de Lebane, con teléfono y "Cómo llegar".
- **Seguimiento**: en cualquier viaje en curso ve el mapa con el camión y la hora estimada.
  En modo demo tiene el botón **"Demo: avanzar 1 km"** para mostrar el seguimiento en una reunión.
- **Avisos**: una copia de los avisos de cada viaje (aceptado, salió, cargando, llegó, demoras)
  en su bandeja, sin notificación en el celular para no llenarlo.
- **Aprobaciones**: las órdenes de compra que armó Compras, con monto y OC. **Aprobar** (un toque,
  con 10 s para deshacer) o **Rechazar** con motivo (vuelve a Compras). En el inicio, un aviso
  amarillo cuando hay alguna esperando. También ve toda la pantalla de Compras.
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
  - *Materiales*: obra, un renglón por material (con "+"), para cuándo y prioridad. "Pedido enviado
    a Compras. Te avisamos en cada paso."
- **Mis pedidos**: arriba **Viajes** y **Materiales**.
  - *Viajes*: Pendientes / Aceptados / Entregados. En el detalle, el **seguimiento en vivo** como
    PedidosYa: cinco pasos (Aceptado · Salió · En el retiro · En camino · Entregado), el mapa con el
    camión (de Cusat o del teléfono del chofer, con "hace 30 seg"), "Claudio está a 6 km, llega
    9:40 aprox" y el botón para llamar al chofer. Puede cancelar mientras está pendiente.
  - *Materiales*: cada pedido con su estado en palabras ("Compras lo está comprando", "Esperando
    aprobación del dueño"…). Lo **listo para retirar** aparece en verde con **Pedir el viaje**. En el
    detalle, la línea de tiempo de 8 pasos y, si ya va en camino, el seguimiento del viaje.
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
- **Hoy**: sus viajes de hoy con letra grande: cuándo, **dónde retira**, **dónde entrega**, qué
  lleva, quién pidió, vehículo. También "Próximos" (agrupados por día) y "Todos" (historial).
- **Solicitudes**: todas las pendientes, urgentes primero, con un botón **"Aceptar"**: elige el
  vehículo (los que no sirven aparecen en gris con el motivo) y a qué hora sale. Si otro la aceptó
  un segundo antes, le dice "Ya lo aceptó Cristian". Un punto rojo en la barra avisa que hay nuevas.
- **Pantalla del viaje**: **dos botones**, nada más: **Iniciar viaje** y **Viaje terminado**. Lo del
  medio lo detecta el GPS (Cusat, o el teléfono si Cusat no reporta) y la pantalla cambia sola:
  "Vas a Corralón San Martín · horario · OC · preguntar por…", **"Llegaste a Corralón San Martín"**
  (Sí, estoy acá / No, todavía no), "Cargando…", camino a la obra, **"Llegaste a Obra Darwin"**.
  Siempre: mapa del tramo, distancia, minutos y **Abrir en Google Maps**. Abajo, chicos, los botones
  para marcarlo a mano si el GPS falla, y el estado de la señal ("GPS Cusat hace 30 seg").
  Sin señal, cada botón se guarda en el teléfono con su hora real y se manda solo al volver.
- **Retiros de material**: la tarjeta muestra el horario de retiro, a quién preguntar y la OC.
- Mientras viaja, el teléfono manda su posición cada 30 s (si dio permiso de ubicación).
- **Combustible**: cuatro campos, con el vehículo del viaje en curso ya elegido y la carga imputada
  a esa obra.

**Avisos**: solicitud urgente nueva; a las 7:00, el resumen de sus viajes del día; si cancelan un
pedido que había aceptado. **Alertas**: urgentes sin aceptar, pedidos para hoy sin chofer, su
licencia por vencer, documentos o service de su camioneta, su viaje de más de 10 h.

**No ve**: los pedidos ya aceptados por otros choferes, depósito, flota, costos, obras, mapa
general, ni alertas de otros choferes.

---

## Depósito (encargado)

- **Inicio**: botón grande **"Escanear"**, las herramientas que hay que preparar hoy (traslados ya
  aceptados) y las devoluciones vencidas.
- **Barra**: Escanear · Herramientas · Entregas · Más (Inicio, Sobrantes, Etiquetas QR, Alta masiva).
- Entrega, recibe, transfiere y manda a reparar herramientas y máquinas; mantenimiento de maquinaria;
  sobrantes; etiquetas QR; alta masiva por CSV.

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
- **Detalle**: UN botón con lo que sigue: **Tomar** → **OC armada, pedir aprobación** (número y
  monto; le llega al dueño) → (esperando al dueño, con **El dueño ya aprobó en papel** por si no usa
  la app ese día) → **Habilitar para retirar** (proveedor, horario, contacto, qué, peso, "lo retira
  un chofer" o "lo entrega el proveedor", y "con esto no falta nada"). Cancelar con motivo.
- **Habilitados**: lo que habilitó y qué pasó después (sin retiro pedido, retiro pedido, en camino,
  entregado); en rojo lo que lleva 3 días o más sin que la obra pida el viaje.
- **Proveedores**: la lista de Lebane con teléfono y "Cómo llegar"; en cada uno, lo habilitado ahí.

**Avisos**: pedido de material nuevo (urgente con push), el dueño aprobó o rechazó, el material se
entregó o volvió a quedar sin retirar. **Alertas**: pedidos demorados, material sin retirar.

**No ve**: solicitudes de viaje, flota, costos, mapa, depósito ni la actividad de los demás (solo
el seguimiento de los viajes que retiran sus materiales).

---

## Administración (oficina)

- **Inicio**: vencimientos de documentación de los próximos 30 días y el costo del mes por obra.
- **Barra**: Flota · Costos · Alertas · Más (Inicio, Agenda, Mantenimiento, Obras, Usuarios).
- Documentación de vehículos, mantenimiento, incidentes, costos por obra y por vehículo con
  exportación para Lebane.
- **Usuarios**: alta de personas, rol, teléfono, licencia de los choferes y obras de cada
  responsable. Para sacar a alguien se lo desactiva (no se borra nada). No puede dar de alta a
  alguien de Dirección.

**Alertas**: documentos por vencer o vencidos, licencias, service próximo, consumo de combustible
anómalo, vehículos en movimiento fuera de horario o parados en viaje.

**No ve**: solicitudes ni pedidos, el mapa en vivo, depósito ni la actividad de los demás.
