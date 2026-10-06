# Signa · Qué ve cada uno

Cada persona tiene **su versión** de la app: ve solo lo que le sirve. Si entra a una pantalla que
no es suya (por ejemplo, escribiendo la dirección a mano), la app la lleva a su inicio. Todo se
controla en el servidor: no alcanza con esconder un botón.

La regla de fondo: **cada dato vive en un solo sistema**. Obras, proveedores, compras y stock de
materiales están en Lebane; Signa solo organiza los viajes, la flota y las herramientas.

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
- **Pedir**: tres pasos. Si alguien ya pidió algo parecido para la misma obra en las últimas 48 h,
  la app le avisa con nombre y fecha ("Lolo ya pidió esto hoy a las 9:00…") y decide él.
- **Mis pedidos**: Pendientes / Aceptados / Entregados. En el detalle, el **seguimiento en vivo**
  como PedidosYa: cuatro pasos, el mapa con el camión, "Claudio está a 6 km, llega 9:40 aprox"
  y el botón para llamar al chofer. Puede cancelar mientras está pendiente.
- **Viajes**: lo que ya aceptaron los choferes y va a sus obras ("hoy a Darwin llegan dos camiones").
- **Herramientas**: las disponibles para pedir (botón "Pedir": obra y fecha), y un buscador de
  todas con dónde está cada una ("En Obra Chubut · la tiene César desde el 28/9"). Si pide la
  misma herramienta para la misma obra y el mismo día que otro, la app avisa.

**Avisos que recibe** (en la campana y, si los activó, en el celular): su pedido fue aceptado,
el chofer salió, está cargando, llegó a la obra, viene con demora, lo soltaron; alguien pidió
una herramienta que está en su obra. **Alertas**: su pedido urgente sin aceptar, pedidos
repetidos de su obra, herramientas vencidas que tiene él o su obra.

**No ve**: las solicitudes pendientes de otras personas, flota, costos, mapa general, agenda,
alertas de vehículos, licencias, combustible ni de choferes, ni la actividad de los demás.

---

## Capataz general (Lolo)

**Igual que el responsable de obra, pero con todas las obras.** Mismas pantallas, misma barra,
mismos avisos. Cancela solo sus propios pedidos y mientras están pendientes.

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
- **Pantalla del viaje**: mapa chico del tramo, a dónde va, distancia y minutos, **"Abrir en
  Google Maps"** y un solo botón: **Iniciar viaje → Llegué al punto de retiro → Llegué al destino**.
  Sin señal, cada botón se guarda en el teléfono con su hora real y se manda solo al volver.
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
