# Auditoría de usabilidad · Etapa 1 (solo lectura)

15/10/2026. Nada de esto cambió la app: es el mapa de cómo se navega hoy, cuántos toques cuestan las tareas
de todos los días y la propuesta para la etapa 2, que espera el ok.

- Toques medidos con `scripts/medir-toques.ts` (celular 390 px, base de desarrollo; resultado en
  tmp/toques.json). Cuenta cada toque (botón, enlace, opción de una lista, pestaña; una lista nativa son 2:
  abrirla y elegir). Escribir no cuenta. Se mide desde la pantalla en la que cae cada uno al entrar y hasta el
  toque que hace la acción (o abre su hoja). Meta: **3 toques o menos**.
- Pantallas: `scripts/auditar-responsive.ts` (560 pantallas, 7 roles, 360/390/430/1440/1920): **0 desbordes en
  celular y 0 pantallas de escritorio por debajo del 90 % del ancho**.

## Resultado en una línea

**27 de 30 tareas en 3 toques o menos.** Las tres que no: pedir un viaje (10), pedir el viaje de un material
listo (5) y registrar una devolución en el depósito (5). El resto del problema no son los toques sino lo que
sobra: el "Más" del dueño tiene 32 entradas (8 de viajes), "Pedir materiales" está en cuatro lugares, la
vuelta atrás funciona distinto en cada detalle y en el celular varios detalles no tienen "Volver".

## Toques por tarea

| Rol | Tarea | Toques | Recorrido |
|---|---|---|---|
| Dirección | Autorizar una orden de compra | 2 ✓ | Aprobaciones → Aprobar |
| Dirección | Autorizar un pago | 3 ✓ | Aprobaciones → Pagos → Autorizar pago |
| Dirección | Ver dónde está cada camión | 2 ✓ | Más → Mapa |
| Dirección | Ver en qué quedó un pedido de material | 2 ✓ | Pedidos → fila |
| Dirección | Ver los costos del mes por obra | 2 ✓ | Más → Costos |
| Obra (Daniela) | **Pedir un viaje** (llevar algo a la obra) | **10** ▲ | Pedir → Llevar algo a la obra → (escribe qué) → Desde dónde (2) → Obra destino (2) → Siguiente → Hoy → Mañana → Pedir el viaje |
| Obra | Pedir materiales a Compras | 2 ✓ | Pedir → Pedir materiales |
| Obra | Ver cómo viene mi viaje | 2 ✓ | Mis pedidos → fila |
| Obra | **Pedir el viaje de un material listo** | **5** ▲ | tarjeta verde "Pedir el viaje" → Siguiente → Día → Hora → Pedir el viaje |
| Obra | Buscar dónde está una herramienta | 2 ✓ | Más → Herramientas → (escribe) |
| Chofer | Aceptar una solicitud | 3 ✓ | Solicitudes → solicitud → Aceptar |
| Chofer | Iniciar el viaje de hoy | 2 ✓ | Hoy → Iniciar viaje |
| Chofer | Ver los viajes de mañana | 2 ✓ | Hoy → Próximos |
| Chofer | Cargar combustible | 2 ✓ | Más → Combustible |
| Chofer | Ver las paradas de un viaje | 2 ✓ | Hoy → viaje |
| Depósito | Buscar una herramienta | 1 ✓ | Buscar → (escribe) |
| Depósito | Entregar una herramienta a una obra | 3 ✓ | Herramientas → herramienta → Entregar |
| Depósito | **Registrar una devolución** | **5** ▲ | Herramientas → Ubicación: Obra Darwin (2) → herramienta → Registrar devolución |
| Depósito | Cargar un sobrante | 3 ✓ | Más → Sobrantes → Agregar |
| Depósito | Ver qué hay en una obra | 3 ✓ | Herramientas → Ubicación: la obra (2) |
| Compras | Tomar un pedido nuevo | 2 ✓ | franja "Ver pedidos" → pedido (se toma al abrirlo) |
| Compras | Enviar una orden a autorización | 3 ✓ | Pedidos → pedido → Enviar a autorización |
| Compras | Habilitar un retiro | 3 ✓ | Listas para retirar → orden → Habilitar |
| Compras | Coordinar un viaje para una arquitecta | 1 ✓ | Viajes |
| Compras | Armar una orden de compra nueva | 2 ✓ | Nueva → Armar orden de compra |
| Administración | Cargar la factura de una orden | 3 ✓ | Más → Facturación → orden |
| Administración | Ver vencimientos de seguro y VTV | 1 ✓ | Flota |
| Administración | Ver costos por obra | 1 ✓ | Costos |
| Administración | Dar de alta un usuario | 3 ✓ | Más → Usuarios → Agregar persona |
| Administración | Exportar costos para Lebane | 2 ✓ | Costos → CSV por obra |

Los toques del chofer no cuentan "Hoy": cae en /inicio y su pantalla de todos los días es Hoy (un toque más
en cada tarea de las que empiezan ahí).

## Mapa de navegación por rol

Profundidad: 0 = donde cae al entrar, 1 = barra o "Más", 2 = un detalle o subpantalla de algo de nivel 1,
3 = algo que se abre desde un nivel 2.

| Rol | Cae en | Barra | En "Más" | Más profundo |
|---|---|---|---|---|
| Dirección | /inicio | Aprobaciones · Pedidos · Avisos | **32**: Viajes (Mapa, Viajes en curso, Solicitudes, Recorridos del día, Pedir un viaje, Mis pedidos, Viajes hacia obras, Vista del chofer) · Compras (Tablero, Habilitados, Facturación, Importar Excel, Pedir materiales) · Flota (Flota, Costos, Agenda, Mantenimiento, Combustible) · Depósito (Herramientas, Sobrantes, Entregas) · Seguimiento (Actividad, Alertas) · Obras, Proveedores · Configuración (Rastreo, Razones sociales, Numeración, Depósitos y base, Usuarios, Alta masiva) · Inicio | 3 (Más → Obras → obra → pedido; Más → Actividad → persona) |
| Obra / Capataz | /inicio | Pedir · Mis pedidos · Viajes | 5: Herramientas, Obras, Pedir materiales, Mis avisos, Inicio | 3 (Más → Obras → obra → pedido) |
| Chofer | /inicio | Hoy · Solicitudes · Avisos | 2: Combustible, Inicio | 3 (Hoy → viaje → modo conducción) |
| Depósito | /inicio | Buscar · Herramientas · Entregas | 4: Sobrantes, Alta masiva, Mis avisos, Inicio | 2 |
| Compras | /compras/tablero | Tablero · Pedidos · Viajes | 4: Habilitados, Proveedores, Mis avisos, Cuenta | 2 (Volver a la lista con filtros) |
| Administración | /inicio | Flota · Costos · Alertas | 11: Obras, Proveedores, Razones sociales, Agenda, Mantenimiento, Tablero, Facturación, Depósitos y base, Usuarios, Mis avisos, Inicio | 3 (Más → Obras → obra → pedido) |

"Inicio" está en "Más" en seis roles: es donde caen al entrar y además es el logo.

## Volver

| Cómo | Dónde | Problema |
|---|---|---|
| **VolverA** (vuelve con filtros, orden y scroll) | Documento de compra (/compras/oc/[id]) | — (el modelo a copiar) |
| Flecha a una dirección fija | Herramienta, vehículo, obra, persona de Actividad, proveedor, viaje | Vuelve a la lista **sin** los filtros ni el scroll |
| Flecha solo en pantallas anchas (`@2xl:`) | Detalle de pedido de viaje (Solicitudes, Mis pedidos, Viajes en curso) | **En el celular no hay Volver**: queda solo el gesto del teléfono |
| Flecha de paso ("Paso 2 de 3") | Pedir un viaje, Pedir el viaje de un material, Coordinar viaje, Pedir materiales | Bien |
| Nada (se vuelve con la barra) | Agenda, Mantenimiento, Importar (herramientas y Excel), Solicitudes de Compras, Nueva, Usuarios | Bien si son nivel 1; Agenda y Mantenimiento son subpantallas de Flota |

## Ventanas (hojas y menús)

Las acciones ya se abren en **hojas** (de abajo en el celular, al costado en la computadora) y no hay
`confirm()` del navegador en ninguna parte. Hojas actuales: Más, Mi cuenta, filtros, dólar, Pedidos
anteriores; herramienta (Pedir, Entregar, Devolución, Transferir, Reparación, Volvió de reparación,
Mantenimiento, Extraviada / Apareció, Dar de baja); viaje (Llegada / Viaje terminado, paradas, acciones);
pedido de viaje (Tomar, Reprogramar, acciones de la solicitud); Coordinar viaje; documento de compra
(Nuevo proveedor, Agregar sucursal, menús de cada celda, aprobación, PDF); usuarios (Nueva persona);
obras (formulario), depósitos y base, adjuntos, configuración de Compras, reiniciar demo, conexión.

## Duplicados

1. **Pedir materiales** (obra): en /pedir (botón arriba), en Más ("Pedir materiales"), en el inicio ("Pedir
   materiales a Compras") y en Nueva (/compras/oc/nueva). Para el dueño, además en Más → Compras. Para
   Compras: "Nueva → Pedir materiales" y /compras/nuevo son lo mismo.
2. **Viajes del dueño**: Mapa, Viajes en curso (/viajes), Viajes hacia obras (/viajes-en-curso), Recorridos
   del día, Vista del chofer (/hoy), Solicitudes, Mis pedidos y Pedir un viaje: ocho entradas para mirar
   viajes desde distintos lados.
3. **Pedidos y Tablero del dueño**: "Pedidos" (barra, /compras) y "Tablero" (Más) muestran los mismos
   documentos en dos formatos.
4. **Habilitados** (Compras, dueño) es la tarjeta "Listas para retirar" del tablero con otra forma.
5. **Buscar y Herramientas** (Depósito): las dos abren /herramientas; Buscar solo enfoca el buscador.
6. **Pedir el viaje de un material**: tarjeta verde (inicio y Mis pedidos), "Pedir el viaje" del inicio
   (sin obra ni material: vuelve a preguntar), la tarjeta "Retirar en un proveedor" de /pedir y el documento.
7. **Avisos y Alertas** (Administración, dueño): dos bandejas.
8. **Inicio** en Más (seis roles) y en el logo.

## Textos de ayuda que quedan

- "Cómo funciona" en /pedir/retiro (tres párrafos a la derecha).
- Frases bajo campos y títulos: Pedir materiales (6), pantalla del viaje (6), Aprobaciones (4), detalle de
  obra (3), formularios de flota (3), Nueva (descripción de cada opción), "Urgente solo si la obra se para sin
  esto" (pedir viaje), Costos (2), Alertas (2), Numeración y solicitantes (2), Importar Excel (3).
- Estados vacíos con una línea de explicación ("Cuando una obra pida una máquina…"): sirven, se quedan.

## Propuesta para la etapa 2 (por rol)

### Para todos
- **VolverA en todos los detalles**: herramienta, vehículo, obra, proveedor, persona, pedido de viaje y viaje
  vuelven a la lista con los filtros, el orden y el scroll, y se ven también en el celular.
- **Profundidad máxima 2**: lo que hoy está a 3 (el pedido dentro de la obra, la persona dentro de Actividad)
  se abre en el panel/hoja del nivel 2 en lugar de otra página.
- **Sin Inicio en Más** (queda en el logo) y **sin textos de ayuda** (los de la lista de arriba, menos los
  estados vacíos). "Cómo funciona" de /pedir/retiro se va.
- docs/roles.md pasa a ser la guía de uso por rol (qué toca cada uno para cada tarea).

### Dirección (el dueño)
- Más de 32 a ~18: un solo **Viajes** (mapa + lista de en curso, con "Recorridos del día" adentro) en lugar de
  Mapa, Viajes en curso, Viajes hacia obras y Recorridos; "Vista del chofer" se va.
- **Pedidos** de la barra abre el Tablero (con la pestaña Pedidos), una sola entrada para Compras.
- Habilitados como filtro del tablero (no otra pantalla).

### Obra y Capataz
- **Pedir un viaje de 10 a 5 toques**: "¿Para cuándo?" en el mismo paso que los detalles (sin "Siguiente"),
  con valores ya puestos: desde el Depósito Florida, a la obra (la única, o la última que usó), hoy y "en el
  día". Quedan: Pedir → Llevar algo a la obra → (escribe) → Pedir el viaje, más lo que quiera cambiar.
- **Pedir el viaje de un material listo de 5 a 2**: la tarjeta verde abre el último paso con el material ya
  marcado y "mañana a la mañana" puesto; "Pedir el viaje" y listo. El "Pedir el viaje" del inicio sin
  material lleva a la primera tarjeta.
- **Un solo "Pedir"**: /pedir es la única entrada (viajes, materiales, OC, PE); "Pedir materiales" sale de
  Más y del inicio queda solo la tarjeta grande.

### Chofer
- Cae directo en **Hoy** (como Compras en el Tablero): cada tarea un toque menos.

### Depósito
- **Devolución de 5 a 2**: Entregas suma "En obras" (cada herramienta afuera con su obra) y el botón
  **Volvió** en la fila. Barra: Herramientas (con el buscador arriba, sin "Buscar" aparte) · Entregas ·
  Sobrantes · Más. Cae en Herramientas.

### Compras
- Ya hecho en la etapa del tablero. Solo: Habilitados como tarjeta del tablero (sale de Más).

### Administración (Camila)
- **Facturación en la barra** (Flota · Costos · Facturación · Más; Alertas pasa a Más junto a Avisos): su
  tarea nueva de todos los días queda a un toque. Cargar una factura: de 3 a 2.

## Preguntas para el ok

1. ¿Camila (Administración) cae en Facturación o sigue cayendo en su inicio con los vencimientos?
2. ¿El dueño quiere seguir viendo "Vista del chofer" (ver lo que ve Claudio) o se va?
3. Para la obra, ¿"desde el Depósito Florida" es el origen por defecto correcto de "Llevar algo a la obra"?
