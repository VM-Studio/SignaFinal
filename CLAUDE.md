# SIGNA · Logística

Contexto permanente del proyecto. Leelo completo antes de cada tarea.

## Qué es

App interna de Signa Desarrollos (constructora y desarrolladora, Buenos Aires) para
organizar los viajes de la flota y saber dónde está cada máquina y herramienta. Se usa
desde el celular en la obra y desde la computadora en la oficina.

La empresa usa Lebane como sistema de gestión: ahí viven las obras, las compras, las
órdenes de compra, los proveedores, el stock de materiales, las cajas y la contabilidad.
Esta app NO duplica nada de eso. Solo cubre lo que Lebane no tiene:

1. Pedidos de viaje: la gente de obra pide, los choferes aceptan y ejecutan
2. Seguimiento en vivo de cada viaje, estilo PedidosYa / Uber
3. Flota: camiones, camionetas y autos, documentación, combustible, mantenimiento, costos
4. Depósito: maquinaria y herramientas, dónde está cada una y quién la tiene
5. Avisos y alertas, cada rol las suyas

Regla: cada dato vive en un solo sistema. Obras y proveedores se leen de Lebane (por API,
o cargados a mano mientras no haya API). Nunca se editan acá.

## El problema real que resuelve

Seis personas (cuatro responsables de obra, el capataz general y el dueño) le piden
viajes a dos choferes, cada una sin saber qué pidieron las otras. Se duplican pedidos,
los choferes responden de memoria, y los responsables terminan yendo ellos mismos con su
camioneta. La solución: una sola lista de solicitudes que ven los choferes, de la que
aceptan viajes; el que pidió ve en vivo cómo viene su pedido sin llamar a nadie.

## Cómo trabaja la empresa (datos reales)

- Obras activas: unas 8, cada una con uno o más responsables. Leandro (varias), Daniela
  (Darwin, Pinares II), César (todas, hoy encima de Chubut y Gaspar Campos), Vicky (Laura
  Thomas). Lolo es el capataz general, está en todas.
- Choferes: Claudio y Cristian (camiones y camionetas). David maneja auto para cosas
  chicas.
- Flota: 3 camiones de 5, 4 y 3 toneladas, guardados en Martínez (al lado de la casa de
  Claudio). 6 camionetas: asignadas a Leandro, Lolo, Claudio, Cristian, y dos en el
  interior. Autos.
- Camión solo para materiales pesados de corralón y traslado de maquinaria. Camioneta
  para el día a día.
- Viaje típico: Martínez → proveedor (retiro) → obra (entrega). La dirección del proveedor
  sale de la orden de compra de Lebane.
- Depósito: uno solo. Las herramientas y la maquinaria están en el depósito o en una
  obra, nunca en otro lado. Materiales casi no se guardan (solo sobrantes eléctricos y
  sanitarios). Los acopios van del corralón a la obra sin pasar por el depósito.

## Principio rector

SIMPLE, RÁPIDO Y PRÁCTICO. Cada rol tiene SU versión de la app y ve solo lo que le
sirve. Si una pantalla no le cambia el día a esa persona, no existe para ella.

## Roles y qué ve cada uno

| Rol | Quién | Ve y hace |
|---|---|---|
| DIRECCION | el dueño | TODO: todas las pantallas de todos los roles, mapa, costos, flota, depósito, todas las alertas, y la Actividad completa (cada acción de cada usuario). También pide viajes |
| RESPONSABLE_OBRA | Leandro, Daniela, César, Vicky | Solo sus obras. Pide viajes. Ve sus pedidos (pendientes y aceptados). Ve los viajes aceptados por los choferes (nunca las solicitudes pendientes de otros). Herramientas: disponibles para pedir, y buscador de todas con estado y en qué obra está cada una |
| CAPATAZ | Lolo | Igual que RESPONSABLE_OBRA, pero con todas las obras |
| CHOFER | Claudio, Cristian, David | Sus viajes de hoy, próximos y todos. Las solicitudes pendientes. Acepta, inicia, marca retiro y destino. Combustible |
| DEPOSITO | encargado del depósito | Escanear, herramientas, entregas y devoluciones, mantenimiento de maquinaria |
| ADMINISTRACION | oficina | Flota, documentación, costos, exportaciones |

Reglas de visibilidad (se verifican en el servidor, en cada query y cada action):
- RESPONSABLE_OBRA solo ve datos de las obras donde está asignado (tabla ResponsableObra).
- Las solicitudes PENDIENTES de viaje las ven CHOFER y DIRECCION. Un responsable ve
  solo las propias.
- Flota, costos, mapa general, agenda y alertas de otros roles NO existen para
  RESPONSABLE_OBRA ni CAPATAZ.
- Cada usuario ve solo sus avisos y alertas (matriz en src/lib/alertas/destinatarios.ts).
- Si un rol entra a una ruta que no le corresponde, va a /inicio. Sin pantalla de error.

## Navegación (barra inferior en celular, máximo 4 ítems, distinta por rol)

- RESPONSABLE_OBRA / CAPATAZ: Obras · Pedir · Viajes · Herramientas
- CHOFER: Hoy · Solicitudes · Combustible · Más
- DEPOSITO: Escanear · Herramientas · Entregas · Más
- ADMINISTRACION: Flota · Costos · Alertas · Más
- DIRECCION: Mapa · Solicitudes · Viajes · Más (y en Más: todo lo demás)
Cuenta y cerrar sesión viven en el avatar del header, no en la barra.
Escritorio (1024px+): barra lateral negra de 240px con las mismas entradas del rol.

## Ciclo de un viaje (la lógica más importante de la app)

Pedido: PENDIENTE → TOMADO (se muestra "Aceptado por Claudio") → EN_VIAJE → ENTREGADO,
o CANCELADO. El chofer que lo aceptó puede soltarlo (vuelve a PENDIENTE).

Viaje (se crea al aceptar), etapas:
  PROGRAMADO → HACIA_RETIRO → EN_RETIRO → HACIA_DESTINO → FINALIZADO
Tres botones del chofer, en orden, uno a la vez:
  1. "Iniciar viaje": la app calcula la ruta desde donde está el chofer hasta el punto
     de retiro y la muestra. Etapa HACIA_RETIRO.
  2. "Llegué al punto de retiro": la app carga sola la ruta retiro → destino. Etapa
     EN_RETIRO y, al salir (automático por GPS o al tocar "Salgo"), HACIA_DESTINO.
  3. "Llegué al destino": km de llegada, peajes, foto opcional. Etapa FINALIZADO,
     pedido ENTREGADO, costo imputado a la obra.
En los tres momentos, el solicitante recibe un aviso con distancia restante y hora
estimada de llegada. Mientras el viaje está en curso, la app del chofer manda su posición
cada 30 segundos y el solicitante la ve en un mapa.

## Reglas de negocio

- Un pedido tiene un solo estado. Solo un chofer puede aceptarlo; el segundo ve "Ya lo
  aceptó Claudio".
- Un chofer no puede tener dos viajes en curso a la vez. Un vehículo tampoco.
- Vehículo con seguro o VTV vencidos no se usa. Chofer con licencia vencida tampoco.
  Mensaje claro, no bloqueo silencioso.
- Peso del pedido ≤ capacidad del camión. Camionetas asignadas no entran en solicitudes.
- Duplicados de viaje: misma obra + mismo tipo + mismo proveedor (o descripción muy
  parecida) en 48 h → aviso con quién y cuándo, antes de guardar.
- Duplicados de herramienta: misma herramienta + misma obra + misma fecha → aviso con
  quién lo pidió y cuándo, antes de guardar.
- Al finalizar: km llegada ≥ km salida; costo = km × costoKm + peajes, imputado a la obra.
- Herramienta UNITARIA está en el depósito o en una obra, nunca en ambos. Cambia de
  lugar solo con un movimiento registrado. Por CANTIDAD: stock por ubicación.
- Alertas con clave única por regla + entidad; se resuelven solas. Cada alerta tiene
  destinatarios (roles y/o usuario); nadie ve alertas de otro rol.
- Plata en Decimal en el servidor; number antes de cualquier Client Component.
- Nada se borra: se desactiva o cambia de estado. Toda acción deja Auditoria.

## Principios de diseño

Lo usan choferes y gente de obra desde el celular, al sol y apurados. Si no es obvio en
tres segundos, está mal.
- Una pantalla de inicio por rol con UNA acción principal grande.
- Cada formulario cabe en una pantalla de celular sin scroll; si no, pasos de 1-2 campos.
- Todo se elige de listas: obras, proveedores, vehículos, personas, herramientas.
- Nombres reales en todos lados. Estados con palabras, nunca solo color.
- Confirmación con un toque y deshacer 10 segundos.
- Funciona sin señal: pedir, aceptar, y los tres botones del viaje se guardan en el
  dispositivo y se envían cuando vuelve la señal, con indicador visible.
- Rápido: Server Components para leer, paginación, índices, Leaflet solo en pantallas
  con mapa (import dinámico), esqueletos de carga, nada de librerías pesadas.

## Stack (fijo)

Next.js 15 (App Router), React 19, TypeScript estricto, Tailwind v4. PostgreSQL + Prisma
6 (no 7). Zod, Server Actions, Server Components. Auth propia: jose JWT en cookie
httpOnly + bcryptjs. Leaflet + OpenStreetMap. Ruteo: OSRM público (lib/rutas) con
respaldo por distancia en línea recta. Push: web-push (VAPID). lucide-react, date-fns
es, qrcode. PWA. Vercel + Postgres administrado.

## Diseño visual

Negro, blanco y gris. Header y barra inferior negros; contenido sobre fondo claro. Color
solo para estado: verde #1F7A4D ok, ámbar #B7791F aviso, rojo #B42318 crítico, siempre
con texto. Tipografía Inter (next/font). Botones mínimo 52px en celular. Sin gradientes ni
sombras difusas. Splash de carga negro con public/loading.png centrado, barra fina del ancho
del logo y porcentaje, 2,5 s: al abrir el sistema (una vez por sesión) y al ingresar. Login con
public/inicio.png arriba del formulario.

## Integraciones (puntos de extensión)

- Lebane: lib/lebane, interfaz para obras, proveedores y órdenes de compra. Mock hasta
  tener la API. Obra.idLebane.
- Cusat: lib/cusat, posiciones actuales e historial. Mock. Vehiculo.idCusat. Cuando
  exista, es una segunda fuente de PosicionVehiculo (fuente CUSAT) junto al teléfono
  del chofer (fuente TELEFONO).

## Forma de trabajar

- Una tarea por vez. Leer el código existente antes de tocarlo; adaptar, no duplicar.
- Al terminar: lint, build, recorrido en navegador a 380px y en escritorio, un usuario
  por rol. Cerrar con qué se hizo y qué probar.
- Nombres de dominio en español. Nada hardcodeado en componentes.
