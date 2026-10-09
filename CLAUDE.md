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
- Flota: la real está en "Flota real" (más abajo). Los camiones se guardan en Martínez
  (al lado de la casa de Claudio).
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
| COMPRAS | la persona de compras | Pedidos de material: los toma, arma la OC, pide aprobación al dueño, habilita para retirar. Proveedores |

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
- COMPRAS: Pedidos · Habilitados · Proveedores · Más
- DIRECCION: Mapa · Solicitudes · Viajes · Más (y en Más: todo lo demás, con Aprobaciones)
Cuenta y cerrar sesión viven en el avatar del header, no en la barra.
Escritorio (1024px+): barra lateral negra de 232px con las mismas entradas del rol.

## Ciclo de un viaje (la lógica más importante de la app)

Pedido: PENDIENTE → TOMADO (se muestra "Aceptado por Claudio") → EN_VIAJE → ENTREGADO,
o CANCELADO. El chofer que lo aceptó puede soltarlo (vuelve a PENDIENTE).

Viaje (se crea al aceptar), etapas:
  PROGRAMADO → HACIA_RETIRO → EN_RETIRO → HACIA_DESTINO → EN_DESTINO → FINALIZADO.
El chofer toca "Iniciar viaje" (PROGRAMADO → HACIA_RETIRO) y "Viaje terminado"
(EN_DESTINO → FINALIZADO: km de llegada, peajes, foto opcional; pedido ENTREGADO y costo
imputado a la obra). Las otras transiciones las hace el motor de viajes
(src/lib/viajes/motor.ts) a partir de posiciones (Cusat primero, teléfono de respaldo):
llegó al retiro (150 m, quieto, 2 lecturas), salió del retiro (más de 300 m), llegó a la obra
(radio de la geocerca, quieto, 2 lecturas). Si el viaje no tiene un retiro distinto de donde
arranca, empieza directo en HACIA_DESTINO. El chofer siempre tiene botones manuales de
respaldo, que hacen la misma transición, y puede negar una llegada detectada ("No, todavía
no"). En cada transición se avisa al solicitante con distancia y hora estimada; sin señal
más de 10 minutos, también. Parámetros en src/lib/viajes/parametros.ts.

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

Fino y profesional, como Linear, Vercel o Notion: mucho blanco, bordes de 1px grises, tipografía
ajustada y el contenido usando todo el ancho. Nada de bordes gruesos ni bloques centrados. Todo
sale de un solo lugar: src/app/globals.css (tokens) y src/components/ui (componentes).

- Grilla de 8px. Espaciados solo de 4, 8, 12, 16, 24, 32, 48.
- Colores: página #FAFAFA; superficies #FFFFFF; bordes #E5E7EB (1px, nunca más grueso); borde fuerte
  #D1D5DB solo para foco o selección; texto #111827, secundario #6B7280, terciario #9CA3AF (solo
  texto de 11px no esencial). Negro #0A0A0A solo en header de celular, barra lateral y botón
  primario. Estado: verde #1F7A4D, ámbar #B7791F, rojo #B42318, como texto o punto de 8px al lado
  del texto, con fondo al 8% en insignias. Siempre con palabras. Nada más de color.
- Tipografía Archivo (next/font): 13px base en escritorio, 15px en celular. Escala 11 (meta), 13
  (cuerpo), 15 (cuerpo celular / énfasis), 18 (título de sección), 22 (título de página), 28
  (número destacado). Pesos 400, 500 y 600; nunca 700. Mayúsculas solo en etiquetas de 11px con
  tracking. Los campos van a 16px en celular (si no, iPhone hace zoom).
- Radios: 6px componentes, 8px tarjetas, 999 insignias. Sin sombras, salvo menús y hojas
  (0 4px 16px rgba(0,0,0,.08)).
- Botones: primario negro 36px (escritorio) / 48px (celular); 52px solo la acción principal del
  chofer. Secundario blanco con borde 1px. Terciario solo texto.
- Campos: 36px / 44px, borde 1px, foco con borde #111827 y anillo suave, etiqueta de 12px gris.
- Tablas (escritorio): filas de 44px, borde inferior 1px, encabezado de 11px en mayúsculas gris,
  hover #F9FAFB, números a la derecha, sin zebra.
- Tarjetas: borde 1px, sin sombra, padding 16; agrupan, no destacan.
- Insignia: punto de color + texto, alto 22, fondo suave.
- Íconos lucide: 16px escritorio, 20px celular, trazo 1,75.
- Escritorio (1024px+): barra lateral negra de 232px (logo a 120px, ítems de 32px a 13px, activo con
  blanco al 10%); header blanco de 48px con el título de la página (22px, 600), acciones de 36px,
  campana y avatar; contenido con padding 24 y sin max-width. Lista + detalle: lista de 380px a la
  izquierda y detalle a la derecha. Mapa: columna de 400px con la información y el mapa a la
  derecha ocupando todo el alto.
- Celular: header negro de 52px (logo chico, título, campana); barra inferior de 56px (íconos de
  22px, etiqueta de 11px); contenido con padding 16; listas como filas de 56-64px con borde inferior,
  sin tarjeta por fila. Tarjeta solo para la acción principal del inicio y el viaje en curso.
- Splash de carga negro con public/loading.png centrado, barra fina y porcentaje, 2,5 s: al abrir
  el sistema (una vez por sesión) y al ingresar. Login con public/inicio.png arriba del formulario.

## Materiales y Compras (circuito nuevo)

Hoy el responsable de obra pide material a Compras por WhatsApp y nadie sabe en qué quedó.
El circuito queda en la app, con un estado a la vista de todos:

SOLICITADO → EN_COMPRA → ESPERANDO_APROBACION → APROBADO → LISTO_PARA_RETIRAR →
RETIRO_PEDIDO → EN_CAMINO → ENTREGADO, o CANCELADO.

- El responsable de obra (o el capataz) pide el material: obra, qué y cuánto, para cuándo,
  prioridad. Lo ve Compras (con copia al dueño).
- Compras lo toma (EN_COMPRA), cotiza y arma la orden de compra en Lebane; carga el número de
  OC y el monto y pide aprobación (ESPERANDO_APROBACION).
- El dueño (DIRECCION) aprueba o rechaza en /aprobaciones. Si rechaza, vuelve a EN_COMPRA con
  el motivo.
- Cuando el proveedor lo tiene, Compras lo **habilita para retirar** (MaterialListo):
  proveedor, horario y contacto de retiro, OC, qué se retira, peso, y si lo retira un chofer
  o lo entrega el proveedor. Un pedido puede tener **retiros parciales** (varios MaterialListo);
  queda ENTREGADO cuando todos se entregaron y Compras marcó "con esto no falta nada".
- Un viaje RETIRO_PROVEEDOR **solo se pide desde un material habilitado** (LISTO, misma obra,
  mismo proveedor). Varios proveedores = varios pedidos de viaje. El viaje copia dirección,
  horario y contacto del proveedor.
- ENTREGA_PROVEEDOR: el proveedor lo lleva a la obra; no hace falta viaje.
- Los estados del viaje mueven el material: en viaje → EN_CAMINO; entregado → ENTREGADO;
  si el chofer lo suelta o se cancela, vuelve a LISTO.
- Rol nuevo COMPRAS. El dueño aprueba en /aprobaciones.
- A futuro, los pedidos pueden venir de Lebane (fuente LEBANE, ordenCompraLebaneId).

## Flota real (datos de Cusat, confirmar con el dueño)

| Cusat | Patente | En la app | Tipo | Cola |
|---|---|---|---|---|
| MERCEDES 710 | HFD336 | Camión Mercedes 710 | Camión, 5 tn // confirmar | Sí |
| KIA | AH282PU | Camión Kia | Camión chico (nuevo), 3 tn // confirmar | Sí |
| ZANELLA | AG149BJ | Zanella | Tipo a confirmar | No |
| OROCH | AC689NR | Oroch | Camioneta | No |
| KANGOO | AF399OO | Kangoo | Utilitario (interior, Cusat la mostró en Lincoln) | No |
| KANGOO LL | AF399OP | Kangoo LL | Utilitario | No |

Base: Martínez (Triunfo Argentino / Granada y Maestro). Depósito: Terreno 1 y Terreno 2
// confirmar. Los vehículos viejos que no estén en esta lista quedan con activo=false, no se
borran. Vehiculo.cusatNombre guarda el nombre tal cual aparece en Cusat.

## Rastreo (Cusat View, plataforma de Suartec)

- El rastreo satelital es Cusat View (cusatglobal.com), de Suartec. No tiene API pública:
  el adaptador (lib/cusat/cusatView.ts) reproduce las llamadas internas de la web con un
  usuario de la cuenta, CUSAT_WEB_USER / CUSAT_WEB_PASS en .env (nunca en el código ni en
  los docs). Lo que se descubrió está en docs/cusat/.
- Fuente de posición: CUSAT primero; si no hay dato reciente, TELEFONO (el celular del
  chofer); si no hay ninguna, los botones manuales del chofer.

## Integraciones (puntos de extensión)

- Lebane: lib/lebane, interfaz para obras, proveedores y órdenes de compra. Mock hasta
  tener la API. Obra.idLebane.
- Cusat: lib/cusat (ver "Rastreo" y docs/cusat/). CUSAT_MODO=cusatview usa la web real;
  mock, el simulador. Vehiculo.idCusat se completa al emparejar (patente o cusatNombre).
  Sincroniza cada minuto (/api/cusat/sincronizar) y cada 20 s mientras alguien mira el mapa.

## Datos base (lo único fijo)

La app no tiene datos de demostración. src/lib/base/ define lo que queda siempre: usuarios con
su rol, base Martínez y Depósito Florida, los seis vehículos reales y el inventario de herramientas
(todo en el depósito). prisma/seed.ts, scripts/cargar-base.ts y el botón "Dejar solo los datos
base" cargan eso y borran el resto. Obras y proveedores se cargan a mano desde la app (Nueva obra,
Nuevo proveedor) mientras no haya API de Lebane; las coordenadas se buscan por la dirección.

## Forma de trabajar

- Una tarea por vez. Leer el código existente antes de tocarlo; adaptar, no duplicar.
- Al terminar: lint, build, recorrido en navegador a 380px y en escritorio, un usuario
  por rol. Cerrar con qué se hizo y qué probar.
- Nombres de dominio en español. Nada hardcodeado en componentes.
