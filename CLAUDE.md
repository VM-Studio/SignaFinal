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
- Viaje típico: Martínez → proveedor (retiro) → obra (entrega). La dirección de retiro es la
  de la sucursal del proveedor elegida en la orden de compra.
- Depósitos: Depósito Florida ("galpón", donde está el inventario) y Terreno Humboldt 2417
  (Villa Crespo). La gente le dice "galpón" al depósito: cada Ubicacion tiene una etiqueta
  ("Galpón", "Terreno", "Base") que se usa en los textos del chofer. Las herramientas y la
  maquinaria están en un depósito o en una obra, nunca en otro lado; en la app se ven en
  "Depósito" con el filtro Maquinaria / Herramientas (sin escaneo ni etiquetas QR: se buscan
  por nombre). Materiales casi no se guardan: los que sobran de una obra van a "Sobrantes".
  Los acopios van del corralón a la obra sin pasar por el depósito.

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
| DEPOSITO | encargado del depósito | Depósito (maquinaria y herramientas), entregas y devoluciones, mantenimiento de maquinaria, sobrantes de materiales |
| ADMINISTRACION | oficina (Camila) | Flota, documentación, costos, exportaciones. Tablero (lectura) y Facturación: completa las secciones 3 y 4 del documento de compra, adjunta la factura y pide la autorización del pago |
| COMPRAS | la persona de compras (Alejandra) | Documentos de compra (OC/PE): los toma, los completa, pide autorización al dueño, marca encargada y habilita para retirar. Proveedores |

Reglas de visibilidad (se verifican en el servidor, en cada query y cada action):
- RESPONSABLE_OBRA solo ve datos de las obras donde está asignado (tabla ResponsableObra).
- Las solicitudes PENDIENTES de viaje las ven CHOFER y DIRECCION. Un responsable ve
  solo las propias.
- Flota, costos, mapa general, agenda y alertas de otros roles NO existen para
  RESPONSABLE_OBRA ni CAPATAZ.
- Cada usuario ve solo sus avisos y alertas (matriz en src/lib/alertas/destinatarios.ts).
- Si un rol entra a una ruta que no le corresponde, va a su primer módulo (inicioDe). Sin pantalla de error.

## Navegación (lo más usado adelante, distinta por rol)

| Rol | Barra inferior (4 ítems) | En "Más" |
|---|---|---|
| DIRECCION | Aprobaciones · Pedidos · Pedir un viaje · Más | Mapa, Viajes en curso, Solicitudes, Mis pedidos, Tablero, Habilitados, Facturación, Flota, Costos, Combustible, Herramientas, Sobrantes, Entregas, Actividad, Alertas, Obras, Proveedores, Configuración, Avisos (también en la campana) |
| COMPRAS | Tablero · Pedidos · Viajes · Más | Habilitados, Proveedores, Mis avisos, Cuenta |
| RESPONSABLE_OBRA / CAPATAZ | Pedir (viaje, materiales, OC o PE) · Mis pedidos · Viajes · Más | Herramientas, Obras, Avisos |
| CHOFER | Hoy · Solicitudes · Avisos · Más | Combustible |
| DEPOSITO | Herramientas · Entregas · Sobrantes · Más | Alta masiva, Avisos |
| ADMINISTRACION | Facturación · Costos · Tablero · Más | Flota, Alertas, Obras, Proveedores, Razones sociales, Depósitos y base, Usuarios, Mis avisos, Cuenta |

- Todo en src/lib/navegacion.ts (NAV). COMPRAS no tiene /inicio: entra directo al **Tablero** (/compras/tablero;
  inicioDe(rol) en permisos.ts, también al ingresar). "Pedidos" (Pedidos de material) es la bandeja de documentos
  ENVIADA_A_COMPRAS / EN_COMPRAS (/compras) y "Viajes" son Coordinar viaje · Solicitudes. Arriba del tablero, la
  franja negra "N pedidos nuevos esperan que los tomes → Ver pedidos" (/compras?filtro=nuevos). Importar Excel y
  "Numeración y solicitantes" están en Más del dueño (Compras · Configuración).
  "Pedidos" del dueño es la vista global de pedidos de materiales (/compras).
- **No hay página de inicio**: cada rol entra al primer módulo de su barra (inicioDe en permisos.ts, también al
  ingresar, en "/" y en /inicio, que solo redirige; navegacion.test.ts verifica que coincidan): DIRECCION en
  Aprobaciones, obra en Pedir, ADMINISTRACION en Facturación, COMPRAS en el Tablero, CHOFER en Hoy, DEPOSITO en
  Herramientas (buscador arriba: no hay escaneo ni QR). El logo lleva ahí.
- Lo que se abre desde un botón de otra pantalla no tiene lugar propio (ENLAZADAS_DESDE en navegacion.ts):
  Pedir materiales desde Pedir, el historial de recorridos desde el Mapa; Agenda y Mantenimiento son
  subpantallas de Flota. Dirección no tiene Hoy del chofer ni la lista de viajes de la obra.
- **Volver** (components/ui/volver.tsx): todo detalle usa <VolverA clave="/lista" href etiqueta>, visible
  también en el celular. <RecordarListas /> (layout) guarda la lista (URL + scroll) al tocar un enlace y la
  repone al volver; si se llegó tocando un enlace de la app, Volver hace history.back().
- Meta de uso: las 5 tareas más frecuentes de cada rol en 3 toques o menos (scripts/medir-toques.ts;
  docs/auditoria-ux.md; guía por rol en docs/roles.md). Sin frases de ayuda bajo títulos ni campos.
- Contadores (punto rojo con número; src/lib/contadores.ts, en vivo con el tiempo real): Aprobaciones
  (órdenes esperando al dueño), Pedidos (nuevos sin tomar, Compras), Solicitudes (pendientes, choferes),
  Avisos (sin leer) y Mis pedidos (materiales listos para retirar, obra).
- "Más" es una grilla de tarjetas (dos columnas en celular) con ícono, nombre y contador; Mi cuenta y
  Cerrar sesión al pie. Cuenta y cerrar sesión también en el avatar del header.
- Escritorio (1024px+): barra lateral negra de 232px con los mismos tres arriba y el resto en "Más", plegado.
- COMPRAS (rediseño visual): navbar de 64px (--alto-header, .header-64 / .header-compras en globals.css) con
  las acciones de la página (40px), la píldora verde del dólar ("$ Blue 1.550 · Oficial 1.535"), Actualizar,
  campana y avatar a 12px; sin frases debajo de los títulos; pestañas como barra de segmentos con contador
  (Segmentos); tablas a todo el ancho con filas de 56px (.tabla-56); estados vacíos a todo el alto
  (PaginaCompleta + <Vacio llenar>). Capturas antes/después: npx tsx scripts/capturas.ts compras-<etiqueta>.
- Ninguna ruta de la matriz queda sin enlace: scripts/verificar-navegacion.ts (y su test).
- "Pedir un viaje" del dueño abre el formulario de viaje (como lo ve un responsable de obra, con todas las obras).
- Pedir un viaje: paso 1 el tipo, paso 2 detalles y ¿para cuándo? en la misma pantalla, con todo puesto
  (desde el Depósito Florida, la obra única o la del último pedido, hoy a la mañana). La tarjeta verde de un
  material listo abre /pedir/retiro en el último paso con "mañana a la mañana". Entregas (Depósito) tiene "En
  obras" con **Volvió** (abre la devolución).

## Ciclo de un viaje (la lógica más importante de la app)

Pedido: PENDIENTE → TOMADO (se muestra "Aceptado por Claudio") → EN_VIAJE → ENTREGADO,
o CANCELADO. El chofer que lo aceptó puede soltarlo (vuelve a PENDIENTE).

Viaje (se crea al aceptar): una lista ordenada de PARADAS (RETIRO o ENTREGA). Etapa del viaje:
  PROGRAMADO → HACIA_RETIRO → EN_RETIRO → HACIA_DESTINO → EN_DESTINO → FINALIZADO,
derivada de la PARADA ACTUAL (la primera que falta): retiro en camino / con llegada, entrega en
camino / con llegada. El chofer hace el viaje en el modo conducción, UN paso por pantalla (ver "Modo
conducción"): "Iniciar viaje" → "Llegué a X" / "En camino a Y" → "Terminar viaje" (peajes una sola vez, foto
opcional; pedidos ENTREGADOS y costo repartido). **El chofer nunca escribe un número**: no hay km.
Lo del medio lo hace el motor de viajes (src/lib/viajes/motor.ts, reglas puras en motor-reglas.ts)
con cada posición (Cusat primero, teléfono de respaldo) sobre la parada actual: llegó (geocerca de
la parada: radio de la obra o 150 m, quieto, 2 lecturas) → LLEGO; se fue (más de 300 m) → COMPLETADA
y la siguiente EN_CAMINO. Si llega a otra parada que ya se puede hacer (sus retiros hechos), se
reordena y la pantalla pregunta "Llegaste a Chubut antes que a Darwin, ¿seguimos así?". Si arranca
en el mismo lugar del primer retiro, empieza "cargando" ahí. El chofer siempre puede deslizar el paso actual
sin esperar al GPS (misma transición); una llegada que detectó el GPS pone el deslizador verde.
Los avisos van SOLO a los solicitantes de los pedidos de esa parada (con distancia; la hora solo con
tránsito real); al completar una entrega, esos pedidos quedan ENTREGADOS. Sin señal más de 10
minutos, también se avisa. Parámetros en src/lib/viajes/parametros.ts.

Reglas del chofer (src/lib/viajes/fecha.ts, recordatorios*.ts, manual.ts):
- La fecha de un viaje es SIEMPRE paraCuando del pedido (hora argentina), nunca la de aceptación.
  Toda tarjeta del chofer empieza con ella, grande y en palabras: "HOY · 8:30" (negro), "MAÑANA ·
  por la tarde" (ámbar), "LUNES 13/10 · 8:30" (gris), "ATRASADO · ayer 8:30" (rojo, sin iniciar).
- Bloqueo por fecha: "Iniciar viaje" solo el día del pedido o después (atrasado: avisa "Claudio
  salió (estaba previsto para ayer)"). Futuro: botón deshabilitado con "Este viaje es para el lunes
  13/10" y la action lo rechaza en el servidor. "Pedir que lo adelanten" avisa al que pidió y a
  Dirección; ellos cambian la fecha con "Reprogramar" (detalle del pedido).
- Recordatorios (solo CHOFER, job /api/jobs/recordatorios cada minuto, claveUnica): 18:00 del día
  anterior, 7:00 del día (varios viajes = un aviso con la lista) y, si no inició, a la hora y cada 60
  min hasta 4. Se programan al aceptar (crearViaje), se cancelan al iniciar/soltar/cancelar y se
  recalculan al reprogramar. Dirección: resumen en bandeja a las 9:00 de los viajes sin iniciar.
- Sin tránsito no hay minutos: sin GOOGLE_MAPS_API_KEY la app muestra solo distancia ("está a 7 km
  de la obra"), nunca una hora. Con la clave, Google Routes (TRAFFIC_AWARE_OPTIMAL) solo para la hora
  de llegada, "(con tránsito)". Detalle y costo en docs/rutas.md.
- Sin botones manuales de respaldo: el deslizador es el único control (es manual por definición). Sin
  señal, funciona igual y abajo dice "Sin señal GPS" en gris. Nunca marca una parada que no es la que sigue.

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
- Al finalizar: km = distancia recorrida según las posiciones GPS del viaje (Cusat o teléfono) entre el
  inicio y el fin, descartando saltos imposibles (más de 140 km/h), lecturas imprecisas y el temblor del GPS
  parado; si no hubo posiciones (o cubren menos de la mitad de la ruta), la distancia de la ruta (lib/rutas).
  src/lib/viajes/km.ts. costo = km × costoKm + peajes, repartido entre los pedidos del viaje por tramo (ver
  "Viajes con paradas"). Vehiculo.kmActual suma esos km (Cusat no informa un odómetro confiable: docs/cusat).
- Herramienta UNITARIA está en el depósito o en una obra, nunca en ambos. Cambia de
  lugar solo con un movimiento registrado. Por CANTIDAD: stock por ubicación.
- Alertas con clave única por regla + entidad; se resuelven solas. Cada alerta tiene
  destinatarios (roles y/o usuario); nadie ve alertas de otro rol.
- Plata en Decimal en el servidor; number antes de cualquier Client Component.
- Nada se borra: se desactiva o cambia de estado. Toda acción deja Auditoria.

## Principios de diseño

Lo usan choferes y gente de obra desde el celular, al sol y apurados. Si no es obvio en
tres segundos, está mal.
- Cada rol entra directo a lo que más usa (su primer módulo), con UNA acción principal grande.
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
es. @vercel/blob (adjuntos y PDFs). PWA. Vercel + Postgres administrado.

## Diseño visual

Fino y profesional, como Linear, Vercel o Notion: mucho blanco, bordes de 1px grises, tipografía
ajustada y el contenido usando todo el ancho. Nada de bordes gruesos ni bloques centrados. Todo
sale de un solo lugar: src/app/globals.css (tokens) y src/components/ui (componentes).

- Grilla de 8px. Espaciados solo de 4, 8, 12, 16, 24, 32, 48.
- Colores: página #FAFAFA; superficies #FFFFFF; bordes #E5E7EB (1px, nunca más grueso); borde fuerte
  #D1D5DB solo para foco o selección; texto #111827, secundario #6B7280, terciario #9CA3AF (solo
  texto de 11px no esencial). Negro #0A0A0A solo en header de celular, barra lateral y botón
  primario. Estado: verde #1F7A4D, ámbar #B7791F (#92600F para texto chico, por contraste), rojo #B42318, como texto o punto de 8px al lado
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
  blanco al 10%); header blanco de 64px para todos los roles (como el de Compras: --alto-header, .header-64)
  con el título de la página (22px, 600), acciones, la píldora del dólar si la ve, y Actualizar, campana y
  avatar de 40px separados 12px; contenido con padding 24 y sin max-width (ni mx-auto): todo usa el ancho completo,
  también a 1920. Lista + detalle (ListaDetalle): la lista ocupa todo el ancho y al elegir una fila el
  detalle se abre en un panel de 480px a la derecha (la lista se achica). Detalles: grilla de 12, 8 + 4
  (contenido / línea de tiempo, adjuntos y acciones). Formularios: 2/3 + 1/3 de contexto (DosTercios,
  ConHistorial). Inicios: grilla de 12 (el del dueño: mapa 8, cifras 4). Mapa: columna de 400px con la
  información y el mapa a la derecha ocupando todo el alto.
- Container queries: `main` y el panel de 480 son `@container`; los detalles y ColumnaMapa se arman con
  `@2xl:` (no `lg:`), así se ven en una columna dentro del panel y en 8 + 4 a página completa.
- Celular sin scroll horizontal nunca (html overflow-x hidden, body clip). Pistas de grilla con
  minmax(0,1fr), flex con min-w-0, tablas dentro de overflow-x-auto, hojas max-w 100vw, áreas seguras con
  env(). scripts/auditar-responsive.ts recorre todas las rutas de todos los roles (360/390/430 y
  1440/1920) y tiene que dar cero desbordes y ninguna pantalla de escritorio por debajo del 90 %.
- Celular: header negro de 60px (--alto-header-movil; logo de 76px, título de 15px, Actualizar, campana y avatar de 44px); barra inferior de 56px (íconos de
  22px, etiqueta de 11px); contenido con padding 16; listas como filas de 56-64px con borde inferior,
  sin tarjeta por fila. Tarjeta solo para la acción principal y el viaje en curso.
- Splash de carga negro con public/loading.png centrado, barra fina y porcentaje, 2,5 s: al abrir
  el sistema (una vez por sesión) y al ingresar. Login con public/inicio.png arriba del formulario.

## Documento de compra (OC/PE)

Esta sección manda sobre lo que diga otra cosa de pedidos de material u órdenes de compra.

Compras (Alejandra) trabajaba con una planilla (docs/plantilla-oc/ORDENES_DE_COMPRA_PEDIDOS_ESPECIALES.xlsx,
solo local: tiene datos reales y el repo es PÚBLICO, así que está en .gitignore; nunca se sube). Su bloque
impreso es docs/plantilla-oc/orden-de-compra.pdf. **El pedido de material y la orden de compra son UN SOLO
objeto: OrdenCompra, el "documento de compra"**, que es la plantilla de Alejandra compartida entre todos.
(PedidoMaterial se migró a OrdenCompra en la migración documento_compra_unificado y ya no existe.)

- **Dos tipos**, misma hoja: **OC** (franja celeste #BDD7EE, OC-NNNN) y **PE** (pedido especial, franja verde
  #C6E0B4, PE-NNNN). Numeración sin año (src/lib/compras/numerar.ts, NumeradorOC por tipo, nunca se repite;
  el número se asigna al enviarla a autorización; antes se muestra "OC #182" con numeroInterno). El próximo
  número se fija en /configuracion/compras (solo DIRECCION, solo hacia arriba).
- **Celdas con el nombre exacto de la plantilla** (CELDAS en src/lib/compras/permisosCeldas.ts): Empresa ·
  Fecha del pedido · Fecha de caducidad · N° de Orden · Solicitado por · Obra · Detalle del Pedido · Proveedor
  Sugerido · Proveedor Final · Presupuesto N° · Importe · Forma de Pago · 1.1 Observaciones · 2 Autorización ·
  3 Facturación (Empresa para Facturar, Cuit, Factura N°, Importe, Forma y Condición de Pago, la factura) ·
  4 Orden de Pago (Autorización, Fecha de Pago).
- **Estados** (EstadoOC, transiciones en src/lib/compras/documento.ts): BORRADOR → ENVIADA_A_COMPRAS →
  EN_COMPRAS → ESPERANDO_AUTORIZACION → AUTORIZADA → ENCARGADA → HABILITADA → ENTREGADA, más RECHAZADA (vuelve
  a EN_COMPRAS con el motivo) y ANULADA. Aparte: estadoFacturacion (PENDIENTE/FACTURADA) y estadoPago
  (PENDIENTE/AUTORIZADO/PAGADO). fuente: ARQUITECTA | COMPRAS | ADMINISTRACION | DIRECCION | IMPORTADA.
- **Permisos por celda** (src/lib/compras/permisosCeldas.ts, puedeEditarCelda, verificado en el servidor en
  cada guardado): la obra completa la sección 1 menos Proveedor Final / Presupuesto / N° (en gris #F3F4F6);
  Compras toda la sección 1 y 1.1; Administración la 3 y la fecha de pago; nadie el N° de Orden. Después de
  autorizada, cambiar algo pide "Modificar" (y vuelve a autorización si cambia el importe o el proveedor).
  Obligatorias vacías con borde rojo y "Faltan: …" (OBLIGATORIAS: enviar a Compras = obra + detalle; enviar a
  autorización = empresa, solicitado por, obra, detalle, proveedor final, importe).
- **La plantilla** (/compras/oc/[id], components/compras/documento/): hoja A4 de 794 px con sombra de papel
  centrada sobre #F3F4F6 (a todo el ancho en celular), celdas en línea, menús flotantes para elegir (Nuevo
  proveedor / Agregar sucursal en hoja lateral). Se guarda sola por celda (800 ms, Ctrl+S) con "Guardado 17:59".
  Cabecera fija: "← Volver al tablero / a pedidos / a mis pedidos" (VolverA, restaura filtros, orden y scroll
  desde sessionStorage por usuario), número y estado, acciones. Sin "Cómo funciona" ni panel lateral.
- **Edición compartida**: versión por celda (versionesCeldas; guardar-celda.ts con SELECT … FOR UPDATE): si
  otro la cambió antes, "Alejandra cambió esto hace 10 s" y no se pisa. Cada guardado deja CambioCelda y un
  EventoCambio: las celdas que cambió otro destellan 1 s. PresenciaDocumento (avatares "Daniela está viendo") y
  panel plegable "Cambios".
- **El circuito**: se crea desde todos los roles menos CHOFER y DEPOSITO, con tres opciones (/compras/oc/nueva):
  "Pedir materiales" (rápido, sale directo a Compras), "Armar orden de compra" y "Armar pedido especial". Los
  borradores de la obra quedan en Mis pedidos con "Seguir completando". Si lo crea Compras o el dueño, empieza
  EN_COMPRAS. Bandeja de Compras (/compras): chips "Con OC cargada" / "Solo indicaciones" (conOCCargada) y
  "Faltan" por fila; abrir un documento ENVIADA_A_COMPRAS lo pasa a EN_COMPRAS. Acciones: Enviar a autorización,
  Devolver con nota, Anular. El dueño autoriza en /aprobaciones (pestañas Órdenes · Pagos): una tarjeta por orden con el detalle (compacta en
  el celular); el PDF se abre solo si toca "Ver el PDF".
  Barra fija "Marcar como encargada" / "Habilitar para retirar" (MaterialListo: sucursal, horario, contacto,
  retiros parciales); habilitada, la barra se pone verde #E2EFDA "LISTO PARA RETIRAR en … · horario" o "Entrega
  el proveedor el …", con push y "Pedir el viaje" al que pidió (tarjetas verdes en Mis pedidos).
  Un viaje RETIRO_PROVEEDOR solo se pide desde un material habilitado; el viaje mueve el estado del retiro
  (en camino, entregado; si se suelta o cancela vuelve a listo). ENTREGADA cuando todo se entregó y Compras
  marcó "con esto no falta nada".
- **Administración (Camila)**: Tablero y /compras/facturacion (falta la factura · falta el pago). Completa la 3,
  adjunta la factura y "Pide autorización" del pago; el dueño lo autoriza en Aprobaciones → Pagos. Le llega
  aviso cuando una orden se autoriza y cuando se marca Acopio.
- **PDF = la plantilla**: /compras/oc/[id]/imprimir (grupo (impresion), una hoja A4 exacta) impreso con
  Chromium (playwright-core en desarrollo, @sparticuz/chromium en Vercel) con un TokenDocumento de un solo uso;
  si no hay Chromium, @react-pdf (pdfHoja.tsx). Todo en /api/oc/[id]/pdf (GET en vivo con X-PDF-Motor; POST
  interno para guardarlo, llamado con after() al enviar a autorización y al autorizar). La factura se agrega
  como página 2 (pdf-lib). Botón "Imprimir / PDF" siempre visible. **Nunca se parsea un PDF para leer los
  datos de una OC: los datos son la fuente, el PDF sale de ellos.**
- **Adjuntos del documento**: cada archivo se engancha a la orden apenas termina de subir (DelPedido en
  plantilla.tsx → adjuntarADocumento; no hay un segundo botón "Guardar": así se perdían). Con la lista adjunta
  alcanza para enviar a Compras (el detalle queda "Ver lista adjunta (…)"). **Excel → Detalle del Pedido**: una
  planilla .xlsx adjunta (en la plantilla o en "Pedir materiales" sin renglones escritos) se lee
  (src/lib/compras/leerLista.ts, con tests: encabezado Descripción/Material + Cantidad/Unidad, o filas texto +
  número) y sus materiales pasan al Detalle del Pedido ("40 bolsas Cemento…"; vacío → reemplaza, si no se agregan
  abajo) con la misma versión y auditoría que a mano. Solo .xlsx; PDF, Word y fotos quedan solo adjuntos.
  Recorrido: scripts/recorrido-lista-excel.ts.
- **Tablero** (components/compras/tablero.tsx, pagina-tablero.tsx), calcado de su planilla: franja rosa
  "Planilla de control COMPRAS - Alejandra", tarjetas-filtro Todas · Entraron hoy (creadas hoy, hora argentina, sin importadas, la más nueva arriba; entraron=hoy) ·
  Pedir autorización · Encargado · Listas para
  retirar · Entregado este mes con la leyenda, encabezado gris fijo, Nº con el código de su leyenda, ESTADO como
  lista pintada (PLANILLA_TABLERO), columna FACTURACIÓN, HABILITADA (#D9F2E6, ícono de camión). Una fila abre
  el documento a página completa (?desde=tablero).
- **Estados del tablero** (EstadoTablero, función única src/lib/compras/estadoTablero.ts con tests): Pedir
  autorización · Autorizada · Solicitud de presupuesto · Encargado · Habilitada · Entregado · Anulada,
  derivados del estado real; Compras puede ajustarlo a mano (auditado, vale hasta el próximo cambio real). Los
  PE tienen además su semáforo.
- Razones sociales (RazonSocial) en /configuracion/razones-sociales, con la de cada obra por defecto.
  "Solicitado por": usuarios activos o SolicitanteExterno ("+ otro nombre"), nunca se crean usuarios.
  Renglones opcionales ("Pasar a renglones", src/lib/compras/renglones.ts). Importe en Decimal, con "A
  confirmar"; en USD guarda cotizacionUsd. Métodos de pago: ACOPIO, CUENTA_CORRIENTE, TRANSFERENCIA, EFECTIVO,
  ECHEQ. Dólar blue y oficial (src/lib/dolar.ts) para COMPRAS, DIRECCION y ADMINISTRACION.
- El sistema arranca VACÍO en producción. El historial se importa del Excel del tablero (/compras/importar,
  fuente IMPORTADA, sin PDF, nunca en /aprobaciones). A futuro, Lebane (ordenCompraLebaneId).
- Guía para Alejandra y Camila: docs/compras.md. Recorrido completo de punta a punta con varias sesiones:
  scripts/recorrido-documento.ts. Capturas: scripts/capturas-compras.ts. Rendimiento del tablero con 2.000
  órdenes: scripts/rendimiento-tablero.ts (solo desarrollo).

## Filtros, vistas guardadas y "Coordinar viaje"

- UNA barra de filtros para todo (src/components/ui/barra-filtros.tsx, BarraFiltros): chips combinables,
  buscador, orden y vistas guardadas por usuario (VistaGuardada: usuarioId, pantalla, nombre,
  parametros). Todo vive en la URL (se arma en el servidor). En celular los chips colapsan en "Filtros (N)"
  y una hoja inferior. La usan el tablero, la cola de Compras, Solicitudes y Órdenes.
- La barra va en UNA fila en escritorio (buscador de 320px, chips, orden, Limpiar, Vistas): los chips que no
  entran pasan a un botón "Filtros (N)".
- Cola de pedidos de material (/compras, también la vista global del dueño): pestañas por paso (segmentos con
  contador) + Obra, Arquitecto/a (con cuántos pidió cada uno), Prioridad, Estado (manda sobre la pestaña), Con
  adjuntos y buscador; orden por fecha de caducidad (paraCuando). Caducidad hoy o vencida en rojo, mañana en ámbar.
- COMPRAS coordina viajes (/compras/viajes): "Para quién" (obra y responsable) y el formulario de pedir
  viaje (2/3, con "Pedidos anteriores" a la derecha: los que coordinó, para repetirlos); el pedido sale a nombre de esa persona con PedidoViaje.coordinadoPorId = Compras. Los avisos
  del viaje les llegan a los dos (eventos.ts, pide()); el chofer ve "Pidió Daniela · coordinó …". Compras
  ve TODAS las solicitudes (pedidosVisibles) pero no acepta ni inicia viajes (permiso pedidos.coordinar).
- Solicitudes con filtros (src/lib/pedidos/solicitudes.ts, VistaSolicitudes): Compras en
  /compras/viajes/solicitudes (agrupada: tabla a todo el ancho, con filtro de Fecha, y con el filtro de lugar las
  filas se agrupan con la fila gris "Corralón San Martín · 3 retiros") y Dirección en /solicitudes (con la columna
  de lugares). Obra · Lugar de retiro · Pidió/Persona (con su historia, paginado) · Prioridad · Estado · Chofer; Editar (fecha,
  prioridad, qué) y Cancelar las pendientes, con aviso al que pidió y a los choferes.

## Órdenes de compra, proveedores y viajes con paradas

Reglas (reemplazan lo que diga otra cosa más arriba):

- **Documento de compra**: ver "Documento de compra (OC/PE)". Admite adjuntos (PDF, Excel, Word, CSV,
  fotos) y observaciones; con un adjunto alcanza. Compras suma sus adjuntos (presupuestos) y notas internas
  que el solicitante no ve.
- **Proveedores**: un proveedor tiene una o más **sucursales**; lo que se elige, se habilita y
  adonde va el chofer es la sucursal. No se habilita ni se arma una OC sin sucursal con coordenadas.
- **Direcciones**: toda dirección nueva (obra, sede, sucursal, depósito) se geocodifica al cargarla
  (src/lib/geo: Nominatim, 1 consulta por segundo, caché en GeocodeCache) y se confirma en un mapa
  con el pin arrastrable (componente SelectorDireccion). Si el buscador no responde, el pin se pone a
  mano. Una obra puede tener **sedes** (ObraSede) si tiene más de un frente; el pedido elige a cuál va.
- **Viajes con paradas** (src/lib/viajes/paradas.ts, combinar.ts, sugerencias.ts, optimizar.ts, reparto.ts):
  un viaje es una lista ordenada de PARADAS (RETIRO o ENTREGA), cada una con los pedidos que atiende
  (ViajePedido) y su lista de verificación con cantidades por obra (ItemParada: renglones de Compras
  o la descripción). Un retiro por cada lugar de origen distinto, una entrega por cada destino; un
  pedido sin retiro (sale de la base) aporta solo entrega. Un pedido simple = 2 paradas.
  - "¿Llevás algo más?": al tocar Aceptar (antes del vehículo; y con "Agregar parada" mientras no llegó a
    ninguna) UNA pantalla con tarjetas grandes, una por pedido, con "Sí, lo llevo" / "No" (sin casillas),
    agrupadas: "Para la misma obra (Darwin) también pidieron:" (mismo destino, cualquier origen), "En el mismo
    lugar (Corralón San Martín) hay para retirar:" (mismo retiro, otras obras) y "Cerca de tu camino:" (a menos
    de radioCercaM = 3 km de una parada o desvío menor que desvioMaximoM). Solo pedidos para el día del viaje o
    antes; personas y escombros no se combinan; si no entra en el vehículo más grande que se puede usar, la
    tarjeta dice "No entra en el Camión Kia (3.000 kg)" y no tiene Sí; máximo maxParadasPorViaje. A cada
    solicitante le llega su aviso normal más "Claudio lo combinó…".
  - Pedido nuevo con el viaje aceptado y sin iniciar, para una obra del viaje o del mismo lugar de retiro (o
    ya iniciado sin llegar a la primera parada, solo mismo lugar de retiro): push al chofer con "Sí, lo
    llevo" / "No" (token SUMAR) y tarjeta arriba de Hoy "Pidieron algo más para Darwin" (src/lib/viajes/
    ofrecer.ts). Lo suma src/lib/pedidos/sumar.ts (no es una Server Action). "No" queda en Viaje.descartados.
    Los solicitantes reciben "Claudio lo suma al viaje de hoy". En cualquier otro momento no se interrumpe.
  - Orden: vecino más cercano con precedencia (cada entrega después de su retiro) + 2-opt, sobre la
    matriz de OSRM table (o línea recta × 1,3), desde el vehículo o su base; nunca empeora. El chofer
    puede "Reordenar" (se valida igual). Google Maps abre con las paradas pendientes como waypoints (9).
  - Lista de verificación: el chofer tilda cada ítem; "Faltó" pide la cantidad real y avisa al que
    pidió y a Compras ("Retiraron 30 de 40 bolsas").
  - **Costo por pedido** (reparto.ts, al finalizar): km de cada tramo = km reales del viaje ×
    (distancia planeada del tramo / suma de las distancias); costo del tramo = km × costoKm. El costo
    de cada tramo va a los pedidos de la PARADA DE LLEGADA de ese tramo en partes iguales (el tramo
    hasta un retiro compartido se reparte entre los pedidos que se cargan ahí); los peajes, en partes
    iguales entre todos. Queda en ViajePedido.costoImputado/kmImputado/peajesImputado y /costos lo
    suma por obra. Centavos exactos: lo que sobra del redondeo va al último.
  Viaje.pedidoId es el pedido principal (el primero aceptado); PedidoViaje.viajeId apunta al viaje
  que lo lleva ahora. En Hoy un viaje combinado es UNA tarjeta ("3 pedidos · 4 paradas · 31 km").
- **Fechas del chofer**: no puede iniciar un viaje antes de su fecha. Recibe recordatorio el día
  anterior y el mismo día hasta que inicia (Recordatorio, clave única: nunca se duplica).
- **Ruteo**: la distancia siempre; el tiempo estimado solo si hay un proveedor con tránsito (Google,
  GOOGLE_MAPS_API_KEY). Sin eso no se muestran minutos ni horas de llegada.
- **Adjuntos**: en Vercel Blob (src/lib/archivos.ts, BLOB_READ_WRITE_TOKEN; en la máquina de
  desarrollo, sin token, se guardan en la base). Se sirven solo con sesión y permiso en
  /api/adjuntos/[id]. Tipos: pdf, xls, xlsx, doc, docx, csv, jpg, png, heic; hasta 20 MB.

## Modo conducción y notificaciones con botones

- /viaje/[id]/conducir (components/viajes/modo-conduccion.tsx): pantalla completa oscura, el viaje es una
  secuencia de deslizadores, UN paso por pantalla con "Paso 2 de 4" arriba, letra grande y solo la parada
  actual (mapa chico mientras va hacia un lugar, la lista de lo que carga o entrega, horario/contacto/OC).
  Los pasos salen de las paradas (src/lib/viajes/pasos.ts, con tests): Iniciar viaje → por cada parada menos
  la última "Llegué a X" y "En camino a Y" → "Terminar viaje". Simple = 4 pasos; sin retiro = Iniciar y
  Terminar. Nunca un "Salgo" aparte. "Iniciar viaje" (Hoy, el detalle) abre esta pantalla y el primer paso es
  el deslizador de inicio. "Terminar viaje" abre la hoja con peajes ($0 / Escribir), foto del remito y
  observaciones (todo opcional) y llega sola a la última parada. Deslizador (components/viajes/deslizador.tsx):
  cuenta desde el 90 %, un toque no hace nada, el texto nunca se corta. Wake Lock; al volver de Google Maps
  trae el estado del servidor (VolverAConducir). La pantalla del viaje (/viaje/[id]) solo tiene "Seguir el viaje".
- Push al chofer cuando el GPS detecta una llegada ([Sí, llegué] [Todavía no]) o una salida ([Sí, salí]
  [Sigo acá]), y en los recordatorios ([Abrir viaje]). Las respuestas se resuelven en el service worker con
  POST /api/viajes/[id]/accion y un token de un solo uso (TokenAccion: hash, 30 min, atado a viaje, parada y
  chofer), sin abrir la app. iPhone no muestra botones: el toque abre el modo conducción en verde.
- Una sola ruta para todo: deslizador, botón, notificación y GPS terminan en las mismas funciones del motor
  (llegarAParada, salirDeParada, responderLlegada, responderSalida, finalizarViaje), con la auditoría
  "viaje.<acción>.<origen>" (gps, manual, deslizador, notificacion), los mismos avisos y los mismos eventos
  de tiempo real. "Abrir en Google Maps": comgooglemaps:// en iPhone (web de respaldo), intent en Android
  (src/lib/viajes/navegar.ts).

## Repetir pedido e historial

- /pedir, /pedir-materiales y /compras/nuevo tienen el panel "Pedidos anteriores" (1/3 derecho, mínimo
  360 px en escritorio, hoja inferior en el celular): los últimos 20 (propios primero; Compras, de todas
  las obras), buscador (material, obra, OC), Repetir y Ver, y arriba los **favoritos** (PedidoFavorito,
  con nombre editable; quitar la estrella lo desactiva). src/lib/historial/.
- Repetir precarga todo menos la **fecha** (en blanco, obligatoria). Materiales: obra (si sigue activa y
  es suya), renglones (de un pedido viejo sin renglones se arman desde la descripción), adjuntos como
  referencia (Adjunto.referenciaDe "del pedido #123", mismo archivo, sin volver a subirlo),
  observaciones y prioridad; a Compras le queda en notas internas con quién se compró la vez anterior.
  Un retiro en proveedor no se repite como viaje: se repite el pedido de materiales (?repetir=).

## Tiempo real (la pantalla siempre al día, sin recargar)

- Cada cambio deja un **EventoCambio** por destinatario (src/lib/tiempo-real.ts). Se emite solo desde
  tres lugares: **auditar()** (toda acción audita: con la entidad auditada se resuelven los
  destinatarios: pedido de viaje → el que pidió, el chofer, todos los choferes, Dirección, el capataz,
  los responsables de la obra y Compras si retira material; pedido de material / OC / habilitación →
  Compras, Dirección, el que pidió y los responsables; herramienta → Depósito, Dirección, capataz y
  responsables), **notificar()** (AVISO) y **evaluarAlertas()** (ALERTA). Una acción nueva no tiene que
  hacer nada extra mientras audite. Se borran a las 24 h (job diario de alertas).
- UN stream por pestaña: /api/tiempo-real/stream (SSE, cada 2 s, corta a los 50 s y el navegador
  reconecta con Last-Event-ID; ventana hacia atrás para los que confirman tarde; ?modo=json = polling
  cada 8 s si no hay SSE). Proveedor en el layout de (app) (components/layout/tiempo-real.tsx).
- Qué refresca cada pantalla: tabla POR_RUTA en components/layout/actualizar.tsx (los formularios, no).
  router.refresh() directo (no dentro de una transición propia: eso lo demoraba segundos), debounce
  500 ms, y si hay un campo con foco espera a que lo suelte. Las filas con data-vivo-id se resaltan 2 s.
- Header: botón **Actualizar** (refresco + reconexión + Cusat en pantallas con mapa) con el punto de
  conexión (verde en vivo, gris reconectando, rojo sin conexión); en celular, deslizar hacia abajo.

## Flota real (datos de Cusat, confirmar con el dueño)

| Cusat | Patente | En la app | Tipo | Cola |
|---|---|---|---|---|
| MERCEDES 710 | HFD336 | Camión Mercedes 710 | Camión, 5 tn // confirmar | Sí |
| KIA | AH282PU | Camión Kia | Camión chico (nuevo), 3 tn // confirmar | Sí |
| ZANELLA | AG149BJ | Zanella | Tipo a confirmar | No |
| OROCH | AC689NR | Oroch | Camioneta | No |
| KANGOO | AF399OO | Kangoo | Utilitario (interior, Cusat la mostró en Lincoln) | No |
| KANGOO LL | AF399OP | Kangoo LL | Utilitario | No |
| — | a confirmar (HILUX-1) | Toyota Hilux 1 | Camioneta del dueño, solo documentación | No |
| — | a confirmar (HILUX-2) | Toyota Hilux 2 | Camioneta del dueño, solo documentación | No |

Las dos Toyota Hilux (Vehiculo.soloDocumentacion) están en Flota solo para cargar seguro y VTV (alertas de
vencimiento incluidas): no hacen viajes (aptitud las rechaza y no aparecen al aceptar), ni van al mapa, Cusat,
combustible, costos ni mantenimiento. Las patentes se corrigen en Flota → Editar. El formulario de vehículo
tiene "Solo para la documentación (no hace viajes)".

Documentación (DocumentoVehiculo: tipo Seguro · VTV · Cédula verde/azul · Patente/impuesto · Habilitación de
tránsito pesado · RUTA · Otro, emisor, número, vencimiento, foto o PDF obligatorio, notas): se carga en la ficha
→ Documentación ("Sacar foto" abre la cámara) o con scripts/cargar-documentacion.ts desde
docs/flota/documentacion.json (solo local: papeles reales; ejemplo en documentacion.ejemplo.json). No hay
documentación inventada: sin papeles, Flota dice "Sin documentación" en rojo, sale la alerta "Vehículo sin
seguro cargado" (ADMINISTRACION y DIRECCION) y el vehículo no puede salir de viaje. Vencimientos: alerta a 30
y 15 días y vencido. La de ejemplo existe solo con MODO_DEMO. La Zanella queda "Tipo a confirmar"
(Vehiculo.tipoAConfirmar) hasta que se confirme.

Base: Martínez (Triunfo Argentino / Granada y Maestro). Depósitos: Depósito Florida (galpón) y
Terreno Humboldt 2417 (Villa Crespo). Terreno 1 y Terreno 2 eran provisorios: quedan inactivos. Los vehículos viejos que no estén en esta lista quedan con activo=false, no se
borran. Vehiculo.cusatNombre guarda el nombre tal cual aparece en Cusat.

## Rastreo (Cusat View, plataforma de Suartec)

- El rastreo satelital es Cusat View (cusatglobal.com), de Suartec. No tiene API pública:
  el adaptador (lib/cusat/cusatView.ts) reproduce las llamadas internas de la web con un
  usuario de la cuenta, CUSAT_WEB_USER / CUSAT_WEB_PASS en .env (nunca en el código ni en
  los docs). Lo que se descubrió está en docs/cusat/.
- Fuente de posición: CUSAT primero; si no hay dato reciente, TELEFONO (el celular del
  chofer); si no hay ninguna, los botones manuales del chofer.

## Integraciones (puntos de extensión)

- Lebane: lib/lebane, interfaz para obras y proveedores. Mock hasta tener la API. Obra.idLebane.
  La OC se arma en este sistema; cuando exista la API, se le enviará a Lebane y el número que
  asigne Lebane queda en OrdenCompra.ordenCompraLebaneId.
- Cusat: lib/cusat (ver "Rastreo" y docs/cusat/). CUSAT_MODO=cusatview usa la web real;
  mock, el simulador. Vehiculo.idCusat se completa al emparejar (patente o cusatNombre).
  Sincroniza cada minuto (/api/cusat/sincronizar) y cada 20 s mientras alguien mira el mapa.

## Datos base (lo único fijo)

src/lib/base/ define lo que queda siempre (datos.ts): usuarios con su rol, base Martínez, Depósito
Florida y Terreno Humboldt 2417, las nueve obras reales con sus responsables (obras.ts, ubicadas con
el geocodificador; las marcadas "confirmar" quedan con coordenadas aproximadas), los seis vehículos
reales y el inventario de herramientas (todo en el depósito). scripts/cargar-base.ts y el botón
"Dejar solo los datos base" cargan eso y borran el resto. prisma/seed.ts (solo desarrollo) suma los
datos de prueba (prueba.ts: proveedores con sucursales, pedidos de material con adjunto, OC, un viaje
combinable). En producción nunca se siembra: scripts/obras-reales.ts agrega las obras reales sin
borrar ni duplicar. Proveedores se cargan desde la app mientras no haya API de Lebane.

## Forma de trabajar

- Una tarea por vez. Leer el código existente antes de tocarlo; adaptar, no duplicar.
- Al terminar: lint, build, recorrido en navegador a 380px y en escritorio, un usuario
  por rol. Cerrar con qué se hizo y qué probar.
- Nombres de dominio en español. Nada hardcodeado en componentes.
