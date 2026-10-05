# Signa · Guion de demo (8 minutos)

Para mostrarle al dueño, siguiendo el problema que él mismo contó: **seis personas le piden viajes
a dos choferes, cada una sin saber qué pidieron las otras**. Se duplican pedidos, los choferes
responden de memoria y los responsables terminan yendo ellos con su camioneta.

## Antes de empezar (5 minutos antes)

1. En el entorno: `MODO_DEMO="true"`.
2. Entrar como **Dirección** → *Mi cuenta* → **Reiniciar datos de demo**. Deja todo como en este guion.
3. Tener abiertas cuatro pestañas (o teléfonos), cada una con un usuario de *Usuarios de demo*
   en el login (contraseña `signa2026`; la lista muestra el rol y las obras de cada uno):
   - **A: Dirección** (el dueño, en la compu, en `/inicio`).
   - **B: Daniela** (celular). Responsable de Darwin y Pinares II.
   - **C: Lolo** (celular). Capataz general.
   - **D: Claudio** (celular). Chofer. Si es un teléfono real, permitir la ubicación.
4. Opcional: en el celular de Daniela, *Mi cuenta* → **Activar avisos en este celular** (en
   iPhone, solo con la app instalada en la pantalla de inicio).

---

## 0:00 — Cada uno ve su app (30 s)

Mostrar las barras de abajo: Daniela tiene **Obras · Pedir · Viajes · Herramientas**; Claudio,
**Hoy · Solicitudes · Combustible**; el dueño, **Mapa · Solicitudes · Viajes · Más**.
*"Cada uno ve solo lo suyo. Daniela no ve la flota ni los costos; usted ve todo."*

## 0:30 — Daniela pide (1 min)

En **B**: **Pedir un viaje** → *Retirar en un proveedor* → **Corralón El Ceibo**, qué: **Cal
hidratada, 40 bolsas**, peso **Hasta 1 tn**, obra **Pinares II** → Siguiente → *Hoy* → **Pedir el viaje**.
Mensaje: **"Pedido enviado. Lo van a ver Claudio, Cristian y David. Te avisamos cuando lo acepten."**
(Con 10 segundos para deshacer.)

## 1:30 — Lolo intenta pedir lo mismo (1 min)

En **C** (Lolo): el mismo pedido (Corralón El Ceibo, cal hidratada 40 bolsas, Pinares II).
Aparece: **"Daniela ya pidió esto hoy a las 10:05 para Obra Pinares II. Estado: pendiente, lo ven
los choferes."** con **Ver ese pedido** y **Es otro pedido**. *No bloquea: avisa con nombre y hora,
y decide la persona.* Tocar **Ver ese pedido** y cerrar.

## 2:30 — Claudio acepta y el dueño lo ve en el mapa (2 min)

1. En **D** (Claudio): **Solicitudes** → la de la cal → **Aceptar** → **Camión 5 tn** (los que no
   sirven aparecen en gris con el motivo) → **Ahora** → **Confirmar**.
2. **Hoy** → la tarjeta destacada → **Iniciar viaje** (el km viene cargado) → **Salir ahora**.
   La pantalla del viaje muestra el mapa al corralón, la distancia, los minutos y **Abrir en Google Maps**.
3. En **A** (Dirección): **Solicitudes** → *En curso* → el pedido de la cal. Arriba, el seguimiento:
   el camión en el mapa y **"Claudio va a Corralón El Ceibo, está a 3 km…"**. Si no hay nadie
   manejando, tocar **Demo: avanzar 1 km** un par de veces: el camión avanza en el mapa.

## 4:30 — Daniela se entera sin llamar a nadie (1 min)

En **B** (Daniela): la campana tiene **3** avisos nuevos:
- **"Claudio aceptó tu pedido de cal hidratada para Obra Pinares II. Sale 10:10 aprox con el Camión 5 tn."**
- **"Claudio salió a buscar tu pedido. Está a 3,2 km de Corralón El Ceibo, llega al retiro 10:16 y a Obra Pinares II 11:05 aprox."**
- **"Claudio llegó a Corralón El Ceibo y está cargando tu pedido…"** (cuando Claudio toca
  **Llegué al punto de retiro**).

Tocar el último: **Mis pedidos** con los cuatro pasos (Pedido · Aceptado · Retiro · Entregado), el
mapa y la frase grande. Botón **Llamar a Claudio**.

## 5:30 — Llega el pedido y aparece el costo en la obra (1 min)

1. En **D** (Claudio): **Llegué al destino** → km de llegada (20 más que los de salida) → **Terminar viaje**.
   Mensaje: **"Viaje terminado. 20 km. Daniela ya sabe que llegó."** y el siguiente de hoy.
2. En **B**: **"Tu pedido de cal hidratada llegó a Obra Pinares II a las 10:42."**
3. En **A**: **Costos** → *Por obra*: Obra Pinares II con el viaje, los km y el costo
   (km × costo por km del Camión 5 tn). Botón **CSV para Lebane**.

## 6:30 — La hormigonera que ya estaba pedida (1 min)

En **B** (Daniela): **Herramientas** → *Disponibles para pedir* → **Hormigonera 130 l** → **Pedir**
→ *Hoy* → **La necesito en Obra Darwin**. Aparece:
**"Vos ya pediste Hormigonera 130 l para Obra Darwin para hoy. Lo pediste hoy a las 7:00 y ya lo
aceptó Claudio."** con **Ver ese pedido** y **Pedir igual** (pide un motivo y le avisa al otro).

## 7:30 — Lo que el dueño ve (30 s)

En **A**: **Más → Actividad**: todo lo que pasó, en palabras: *"Daniela pidió Cal hidratada…"*,
*"Claudio aceptó el pedido #30… con Camión 5 tn"*, *"Claudio entregó…: 20 km"*. Filtros por persona,
obra y fecha, y exportación a CSV. Tocar un nombre: su ficha del mes.

*"Una sola lista de solicitudes; el sistema avisa si piden lo mismo; los choferes aceptan en orden;
el que pidió sigue el camión como en PedidosYa; usted ve todo y el costo queda en la obra."*

---

### Si algo no sale

- **No aparece el aviso de duplicado**: alguien ya aceptó o canceló el pedido de Daniela, o se usó
  otro proveedor u obra. Reiniciar datos de demo.
- **El camión no se mueve en el mapa**: el teléfono de Claudio no dio permiso de ubicación. Usar
  **Demo: avanzar 1 km** desde la pestaña de Dirección.
- **Sin señal en la reunión**: Daniela y Claudio pueden seguir: lo que hacen queda guardado en el
  teléfono ("Pendiente de envío") y se manda solo, en orden y con su hora real, cuando vuelve la señal.
- **Hay que volver a empezar**: *Mi cuenta* → *Reiniciar datos de demo*.
