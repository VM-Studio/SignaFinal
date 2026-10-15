# Signa · Guía de uso por rol

Cada persona tiene **su versión** de la app y ve solo lo que le sirve. Si entra a una pantalla que no es
suya, la app la lleva a la suya (todo se controla en el servidor). Abajo, para cada rol: dónde cae al
entrar, qué tiene a mano y **cómo se hace cada cosa de todos los días, con los toques que lleva** (medidos
con `scripts/medir-toques.ts`; ninguna pasa de 3).

Reglas para todos:
- **Volver**: todo detalle (pedido, viaje, herramienta, vehículo, obra, proveedor, persona, orden) tiene
  "← Volver" arriba, también en el celular, y vuelve a la lista **como estaba**: filtros, pestaña, orden y
  la misma altura.
- **Inicio** es el logo de arriba a la izquierda. En "Más" está el resto; Mi cuenta y Cerrar sesión, en el
  avatar y al pie de "Más".
- Las acciones se abren en una **hoja** (de abajo en el celular, al costado en la computadora); se confirma
  con un toque y casi todo tiene **Deshacer** durante 10 segundos.
- Cada dato vive en un solo sistema: stock, cajas y contabilidad en Lebane; viajes, flota, herramientas y
  el documento de compra (OC/PE) acá. Guía de Compras y Facturación: **docs/compras.md**.

---

## Dirección (el dueño)

**Cae en** su inicio: órdenes que esperan su autorización, viajes de hoy, alertas críticas y el mapa chico.
**Barra**: Aprobaciones · Pedidos · Avisos · Más.
**Más**: Viajes (Mapa, Viajes en curso, Solicitudes, Pedir un viaje, Mis pedidos) · Compras (Tablero,
Habilitados, Facturación, Importar Excel) · Flota (Flota, Costos, Combustible) · Depósito (Herramientas,
Sobrantes, Entregas) · Seguimiento (Actividad, Alertas) · Obras, Proveedores · Configuración (Rastreo,
Razones sociales, Numeración y solicitantes, Depósitos y base, Usuarios, Alta masiva). Agenda y
Mantenimiento están como botones dentro de Flota; los recorridos del día, como "Historial" en el Mapa.

| Para… | Toques |
|---|---|
| Autorizar una orden de compra (ve los datos y el PDF) | 2 · Aprobaciones → Aprobar |
| Autorizar un pago que pidió Camila | 3 · Aprobaciones → Pagos → Autorizar pago |
| Ver dónde está cada camión | 2 · Más → Mapa |
| Ver en qué quedó un pedido de material | 2 · Pedidos → la fila |
| Ver los costos del mes por obra | 2 · Más → Costos |

También: asignar una solicitud a un chofer, reprogramar un viaje (detalle del pedido), la Actividad de cada
persona con filtros y CSV, alta de usuarios, obras y proveedores, y la configuración de Cusat. En modo demo,
los botones "Simular" en un viaje en curso.

---

## Responsable de obra (Leandro, Daniela, César, Vicky) y Capataz (Lolo)

Trabajan **solo con sus obras** (Lolo, con todas).
**Cae en** su inicio: la tarjeta grande **Pedir**, las tarjetas verdes **Listo para retirar** (cada una con
**Pedir el viaje**), lo que viene en camino hoy y lo que espera a Compras.
**Barra**: Pedir · Mis pedidos · Viajes · Más. **Más**: Herramientas, Obras, Mis avisos.

| Para… | Toques |
|---|---|
| Pedir un viaje (llevar algo a la obra) | 3 · Pedir → Llevar algo a la obra → (escribís qué) → Pedir el viaje |
| Pedir el viaje de un material que habilitó Compras | 2 · tarjeta verde "Pedir el viaje" → Pedir el viaje |
| Pedir materiales a Compras | 2 · Pedir → Pedir materiales |
| Ver cómo viene mi viaje | 2 · Mis pedidos → el pedido |
| Buscar dónde está una herramienta | 2 · Más → Herramientas → (escribís) |

- **Pedir un viaje** viene todo puesto: sale del **Depósito Florida**, va a la obra (la única, o la del
  último pedido), **hoy a la mañana**, normal. Se cambia lo que haga falta en la misma pantalla. Si alguien
  pidió algo parecido para la misma obra en 48 h, la app avisa con nombre y fecha.
- **Pedir el viaje de un material listo**: llega con el material marcado y "mañana a la mañana" puesto.
- **Pedir** es la única entrada para pedir: viaje, materiales (el rápido), orden de compra o pedido especial
  (la plantilla de Compras), y "Repetir un pedido anterior".
- **Mis pedidos**: Viajes (pendientes, aceptados, entregados, con el seguimiento en vivo: pasos, mapa, "está
  a 6 km", llamar al chofer) y Materiales (cada documento con su estado y lo que falta; los borradores con
  "Seguir completando").
- No ve el tablero de Compras ni importes de otras obras, ni flota, costos, mapa general ni las solicitudes
  de otros.

**Avisos**: aceptaron su pedido, el chofer salió / llegó / viene con demora, sin señal del camión; cada paso
de su pedido de material (Compras lo tomó, autorizado, listo para retirar, entregado).

---

## Chofer (Claudio, Cristian, David)

**Cae en Hoy**: los viajes de hoy (atrasados arriba, en rojo), con la fecha grande en cada tarjeta ("HOY ·
8:30", "MAÑANA · por la tarde"). **Barra**: Hoy · Solicitudes · Avisos · Más. **Más**: Combustible.

| Para… | Toques |
|---|---|
| Iniciar el viaje de hoy | 1 · Iniciar viaje (abre el modo conducción) |
| Ver los viajes de mañana | 1 · Próximos |
| Ver las paradas de un viaje | 1 · el viaje |
| Aceptar una solicitud | 3 · Solicitudes → la solicitud → Aceptar ("Aprovechá el viaje" sugiere lo que está en el mismo lugar o en el camino) |
| Cargar combustible | 2 · Más → Combustible |

- En el **modo conducción**, un deslizador para llegar / salir / terminar (un toque no hace nada) y "Abrir
  en Google Maps" con las paradas que faltan. El GPS detecta llegadas y salidas; sin GPS, el botón manual
  ("Llegué al proveedor / a la obra…").
- Un viaje de otro día no se puede iniciar: "Este viaje es para el lunes 13/10" y **Pedir que lo adelanten**.
- Sin señal, cada botón se guarda en el teléfono y se manda solo al volver.

**Avisos**: recordatorios el día anterior a las 18:00, el mismo día a las 7:00 y, si no salió, a la hora y
cada 60 minutos (hasta 4); solicitud urgente nueva; le reprogramaron o cancelaron un viaje.

---

## Depósito (encargado)

**Cae en Herramientas**, con el buscador arriba (por nombre o código; sin escaneo ni QR) y el filtro
Maquinaria / Herramientas y de ubicación. **Barra**: Herramientas · Entregas · Sobrantes · Más. **Más**:
Alta masiva, Mis avisos.

| Para… | Toques |
|---|---|
| Buscar una herramienta | 0 · (escribís en el buscador) |
| Entregar una herramienta a una obra | 2 · la herramienta → Entregar |
| Registrar una devolución | 3 · Entregas → Volvió → Registrar devolución |
| Ver qué hay en una obra | 2 · Ubicación: la obra |
| Cargar un sobrante | 2 · Sobrantes → Agregar |

- **Entregas**: lo que pidieron las obras (para entregar), **En obras** (cada herramienta afuera con su obra,
  las vencidas marcadas y el botón **Volvió**) y los movimientos de hoy.

**Alertas**: devoluciones vencidas, máquinas en obras pausadas, mantenimiento de máquinas vencido.

---

## Compras (Alejandra)

**Cae en el Tablero** (su planilla de control), con la franja negra "N pedidos nuevos esperan que los tomes".
**Barra**: Tablero · Pedidos · Viajes · Más. **Más**: Habilitados, Proveedores, Mis avisos, Cuenta.

| Para… | Toques |
|---|---|
| Tomar un pedido nuevo | 2 · Ver pedidos → el pedido (se toma al abrirlo) |
| Enviar una orden a autorización | 3 · Pedidos → el pedido → Enviar a autorización |
| Habilitar un retiro | 3 · Listas para retirar → la orden → Habilitar |
| Coordinar un viaje para una arquitecta | 1 · Viajes |
| Armar una orden de compra nueva | 2 · Nueva → Armar orden de compra |

Todo el detalle en **docs/compras.md**. No acepta ni inicia viajes; no ve flota, costos ni mapa.

---

## Administración (Camila)

**Cae en** su inicio: vencimientos de documentación de los próximos 30 días y el costo del mes por obra.
**Barra**: Flota · Costos · Facturación · Más. **Más**: Alertas, Tablero, Obras, Proveedores, Razones
sociales, Depósitos y base, Usuarios, Mis avisos. Agenda y Mantenimiento, dentro de Flota.

| Para… | Toques |
|---|---|
| Cargar la factura de una orden | 2 · Facturación → la orden (completa la sección 3 y adjunta la factura) |
| Ver vencimientos de seguro y VTV | 1 · Flota |
| Ver costos por obra | 1 · Costos |
| Exportar costos para Lebane | 2 · Costos → CSV por obra |
| Dar de alta un usuario | 3 · Más → Usuarios → Agregar persona |

En el documento de compra solo edita las secciones 3 (Facturación) y 4 (pide la autorización del pago y pone
la fecha de pago). **Avisos**: una orden se autorizó, se marcó Acopio. **Alertas**: documentos y licencias
por vencer, service próximo, consumo de combustible anómalo, vehículos fuera de horario o parados en viaje.
No ve solicitudes de viaje, el mapa en vivo, el depósito ni la actividad de los demás.
