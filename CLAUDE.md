# SIGNA · Logística

Contexto permanente del proyecto. Leelo completo antes de cada tarea.

## Qué es

App interna de Signa Desarrollos (constructora y desarrolladora, Buenos Aires) para organizar
los viajes de la flota y saber dónde está cada máquina y herramienta. Se usa desde el celular
en la obra y desde la computadora en la oficina.

La empresa usa Lebane como sistema de gestión: ahí viven las obras, las compras, las órdenes
de compra, los proveedores, el stock de materiales, las cajas y la contabilidad. Esta app NO
duplica nada de eso. Solo cubre lo que Lebane no tiene:

1. Pedidos de viaje y cola única de pedidos
2. Flota: camiones, camionetas y autos, con choferes, documentación y mantenimiento
3. Viajes: asignación, ejecución desde el celular del chofer, costo por obra
4. Mapa en vivo con el rastreo satelital de Cusat (cuando llegue el acceso)
5. Depósito: maquinaria y herramientas, dónde está cada una y quién la tiene
6. Alertas de todo lo anterior

Regla: cada dato vive en un solo sistema. Las obras y los proveedores se leen de Lebane
(por API, o cargados a mano mientras no haya API). Nunca se editan acá.

## El problema real que resuelve

Seis personas (cuatro responsables de obra, el capataz general y el dueño) le piden viajes
a dos choferes, cada una sin saber qué pidieron las otras. Se duplican pedidos, los choferes
responden de memoria, y los responsables terminan yendo ellos mismos con su camioneta.
La solución es una cola única de pedidos que todos ven, de la que los choferes toman los
viajes en orden. Todo el diseño apunta a eso.

## Cómo trabaja la empresa (datos reales)

- Obras activas: unas 8, cada una con un responsable. Leandro (varias), Daniela (Darwin,
  Pinares II), César (todas, hoy encima de Chubut y Gaspar Campos), Vicky (Laura Thomas).
  Lolo es el capataz general, está en todas.
- Choferes: Claudio y Cristian (camiones y camionetas). David maneja auto para cosas chicas.
- Flota: 3 camiones de 5, 4 y 3 toneladas de carga, guardados en Martínez (al lado de la
  casa de Claudio). 6 camionetas: asignadas a Leandro, Lolo, Claudio, Cristian, y dos en el
  interior. Autos.
- Regla de uso: camión solo para materiales pesados de corralón y traslado de maquinaria.
  Camioneta para el día a día.
- Viaje típico: Martínez → proveedor → obra. La dirección del proveedor sale de la orden
  de compra de Lebane.
- Depósito: uno solo. Las herramientas y la maquinaria están en el depósito o en una obra,
  nunca en otro lado. Materiales casi no se guardan (solo sobrantes eléctricos y sanitarios).
  Los acopios no pasan por el depósito: van del corralón a la obra.

## Usuarios y roles

| Rol | Quién | Qué hace en la app |
|---|---|---|
| DIRECCION | el dueño | Ve todo, mapa, costos, alertas. Puede pedir viajes |
| RESPONSABLE_OBRA | Leandro, Daniela, César, Vicky | Pide viajes, ve la cola y sus obras, pide y devuelve herramientas |
| CAPATAZ | Lolo | Igual que responsable de obra, en todas las obras |
| CHOFER | Claudio, Cristian, David | Ve la cola, toma pedidos, inicia y finaliza viajes, carga combustible |
| DEPOSITO | encargado del depósito | Entrega y recibe maquinaria y herramientas, mantenimiento |
| ADMINISTRACION | oficina | Documentación de vehículos, costos, exportaciones |

Los permisos se definen en un solo archivo y se verifican en el servidor en cada acción.

## Principios de diseño (los más importantes de este archivo)

Lo van a usar choferes y gente de obra desde el celular, al sol y apurados. Si no es
obvio en tres segundos, está mal.

- Una pantalla de inicio por rol con UNA acción principal grande. Chofer: "Pedidos para
  tomar". Responsable de obra: "Pedir un viaje". Depósito: "Escanear". Dirección: el mapa.
- Máximo 4 ítems en la barra inferior. Nada de menús "Más" con diez cosas adentro.
- Cada formulario cabe en una pantalla de celular sin scroll. Si necesita más, se parte
  en pasos de uno o dos campos.
- Todo lo que se pueda elegir de una lista, se elige de una lista: obras, proveedores,
  vehículos, personas. Escribir a mano solo observaciones.
- Nombres reales de la empresa en todos lados: "Camión 5 tn", "Claudio", "Obra Darwin".
  Nunca códigos internos a la vista.
- Estados con palabras, nunca solo color: "Pendiente", "Tomado por Claudio", "En viaje",
  "Entregado".
- Confirmación con un toque y deshacer durante 10 segundos, en vez de "¿Está seguro?".
- Funciona lento o sin señal: el formulario de pedido y el inicio/fin de viaje se guardan
  en el dispositivo y se envían cuando vuelve la señal, con indicador visible.

## Stack (fijo)

- Next.js 15 (App Router), React 19, TypeScript estricto, Tailwind v4
- PostgreSQL + Prisma 6 (no 7)
- Zod, Server Actions para mutaciones, Server Components para lecturas
- Auth propia: JWT con jose en cookie httpOnly + bcryptjs
- Mapas: Leaflet con OpenStreetMap (gratis, sin clave). Marcadores propios.
- Íconos lucide-react. Fechas date-fns en español. QR: qrcode para generar, lectura por cámara.
- PWA instalable. Deploy en Vercel + Postgres administrado.

## Diseño visual

Negro, blanco y gris. Sobrio. Header y barra inferior negros; contenido sobre fondo claro
(se usa al sol). Color solo para estado: verde #1F7A4D ok, ámbar #B7791F aviso, rojo
#B42318 crítico, siempre con texto. Tipografía Inter (next/font). Botones mínimo 52px de
alto en celular. Sin gradientes, sin sombras difusas, sin animaciones salvo el splash.
Splash de carga: fondo negro, logo public/loading.png grande y centrado, barra blanca fina
del ancho del logo con el porcentaje debajo, 2,5 segundos. Se ve al abrir el sistema (una vez
por sesión) y cada vez que alguien ingresa. Login: public/inicio.png grande arriba del formulario.
Escritorio (1024px+): barra lateral negra de 240px con la navegación; contenido a todo el
ancho; listados como tablas; formularios en panel lateral derecho.

## Reglas de negocio

- Un pedido de viaje tiene un solo estado a la vez: PENDIENTE → TOMADO → EN_VIAJE →
  ENTREGADO, o CANCELADO. Solo un chofer puede tomarlo; el segundo que intenta ve
  "Ya lo tomó Claudio".
- Un chofer no puede tener dos viajes EN_VIAJE a la vez. Un vehículo tampoco.
- Un vehículo con seguro o VTV vencidos no se puede usar para un viaje. Un chofer con
  licencia vencida tampoco. Mensaje claro, no bloqueo silencioso.
- Peso del pedido ≤ capacidad del camión. Si el pedido supera 3 tn, solo aparecen los
  camiones que alcanzan.
- Las camionetas asignadas a una persona no entran en la cola de pedidos. Se registran
  para combustible, documentación y mantenimiento.
- Al finalizar un viaje: km llegada ≥ km salida; se actualiza kmActual del vehículo;
  costo = km recorridos × costoKm del vehículo + peajes; el costo queda imputado a la obra.
- Herramienta o máquina UNITARIA: está en el depósito o en una obra, nunca en ambos.
  Solo cambia de lugar con un movimiento registrado (entrega, devolución, transferencia).
- Herramientas por CANTIDAD (palas, baldes, puntales): stock por ubicación.
- Alertas con clave única por regla + entidad: no se duplican; se resuelven solas cuando
  el problema desaparece.
- Plata en Decimal en el servidor; se convierte a number antes de pasar a Client
  Components (ningún Decimal cruza a "use client").
- Nada se borra: se desactiva o cambia de estado. Cambios importantes dejan auditoría.

## Integraciones (puntos de extensión, no implementar hasta tener acceso)

- Lebane: lib/lebane/ con una interfaz para listar obras, proveedores y órdenes de compra.
  Implementación mock hasta tener la API. Las obras tienen idLebane como clave.
- Cusat: lib/cusat/ con una interfaz para obtener posiciones actuales e historial.
  Implementación mock que simula movimiento. Vehículo tiene idCusat.

## Forma de trabajar

- Una tarea por vez. No adelantar lo que no se pidió.
- Al terminar: lint, build, y un recorrido de prueba en el navegador en vista móvil (380px)
  y escritorio. Cerrar con qué se hizo y qué probar.
- Nombres de dominio en español. Nada hardcodeado en componentes: todo sale de la base.
