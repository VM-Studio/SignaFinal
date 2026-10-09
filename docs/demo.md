# Signa · Guion de demo (12 minutos)

Para mostrarle al dueño, siguiendo los dos problemas que él mismo contó:
1. **Seis personas le piden viajes a dos choferes**, cada una sin saber qué pidieron las otras.
2. **Los pedidos de material van por WhatsApp a Compras** y nadie sabe en qué quedaron.

## Antes de empezar (5 minutos antes)

1. En Vercel: `MODO_DEMO="true"` y Cusat conectado (`CUSAT_MODO="cusatview"`, ver `docs/cusat/`).
2. Entrar como **Dirección** → *Mi cuenta* → **Reiniciar datos de demo**. Deja la flota real, los
   pedidos de material de ejemplo y los viajes de este guion. Al minuto, Cusat enlaza los seis
   vehículos por patente (se ve en *Más → Rastreo (Cusat)*: "6 de 6").
3. Cuatro pestañas o teléfonos (contraseña `signa2026`, los usuarios están en el login):
   - **A: Dirección** (el dueño, en la compu, en `/inicio`).
   - **B: Daniela** (celular). Responsable de Darwin y Pinares II.
   - **C: Compras** (compu o celular).
   - **D: Claudio** (celular). Chofer. Si es un teléfono real, permitir la ubicación.
4. Opcional: en el celular de Daniela, *Mi cuenta* → **Activar avisos en este celular**.

---

## 0:00 — Cada uno ve su app (30 s)

Las barras de abajo: Daniela **Obras · Pedir · Viajes · Herramientas**; Claudio **Hoy · Solicitudes
· Combustible**; Compras **Pedidos · Habilitados · Proveedores**; el dueño **Mapa · Solicitudes ·
Viajes · Más**. *"Cada uno ve solo lo suyo; usted ve todo."*

## 0:30 — El mapa con los seis vehículos reales (1 min)

En **A**: el inicio es el mapa. Arriba dice **Cusat en vivo**. Tocar **Camión Mercedes 710**:
dónde está (Granada y Maestro, Martínez), "hace 40 seg", velocidad y chofer. La Kangoo aparece en
Lincoln. Un vehículo que no reporta hace más de 10 minutos se ve **gris**.
*"Es lo mismo que ve en la app de Cusat, pero junto con los pedidos y los viajes."*

## 1:30 — Daniela pide material a Compras (1 min)

En **B**: **Pedir** → arriba **Pedir materiales a Compras** → Obra **Darwin** → *Cemento Portland,
30 bolsas* → **+ Otro material** → *Cal hidratada, 20 bolsas* → **Mañana** → **Pedir a Compras**.
Mensaje: **"Pedido enviado a Compras. Te avisamos en cada paso."**

## 2:30 — Compras lo toma y arma la OC (1 min)

En **C**: el inicio dice **Pedidos nuevos: 3**. **Pedidos** → *Nuevos* → el cemento → **Tomar**.
Después **OC armada, pedir aprobación** → OC `3150`, monto `4030000` → **Pedir aprobación**.
*"En rojo aparece lo que lleva más de 2 días hábiles sin comprar."*

## 3:30 — El dueño aprueba con un toque (30 s)

En **A**: arriba del mapa, en amarillo, **"1 orden de compra espera tu aprobación"** → **Aprobar**
(10 segundos para deshacer). Si no, **Rechazar** con motivo y vuelve a Compras.

## 4:00 — Compras lo habilita para retirar (1 min)

En **C**: el pedido → **Habilitar para retirar** → proveedor **Corralón San Martín**, horario
*Lun a vie 8 a 12*, contacto *Sergio 11 4797-6601*, peso **Hasta 3 tn**, *Lo retira un chofer*,
✓ *Con esto no falta nada del pedido* → **Habilitar**.

## 5:00 — Daniela pide el viaje desde la lista (1 min)

En **B**: aviso **"Tu cemento Portland para Obra Darwin está listo para retirar en Corralón San
Martín (Lun a vie 8 a 12). Pedí el viaje cuando lo necesites."** → **Mis pedidos → Materiales**: el
cemento en verde → **Pedir el viaje**. Ya viene marcado; marcar también la **Malla sima** (Hierros
Martínez). Aparece **"Son 2 proveedores, se van a crear 2 viajes."** → Siguiente → *Hoy* → **Pedir
los 2 viajes**. *"Daniela no escribe ni la dirección ni el horario: los puso Compras."*

## 6:00 — Claudio acepta y sale: solo dos botones (1 min)

En **D**: **Solicitudes** → el de Corralón San Martín. La tarjeta muestra **horario, contacto y OC**.
**Aceptar** → **Camión Mercedes 710** → **Ahora** → **Confirmar**. **Hoy** → **Abrir el viaje** →
**Iniciar viaje** (km precargado) → **Salir ahora**. La pantalla: *"Vas a Corralón San Martín"*,
mapa, distancia, minutos, **Abrir en Google Maps**. Al pie: *"GPS Cusat hace 30 seg"*.
*"Claudio no toca nada más hasta llegar a la obra: el GPS se da cuenta solo."*

## 7:00 — El viaje se mueve solo (modo demo, 2 min)

En **A**: **Solicitudes** → *En curso* → el pedido de Claudio. En el seguimiento, **Demo · simular GPS**:
1. **Simular: llegó al retiro** → en **D** aparece **"Llegaste a Corralón San Martín"** con *Sí, estoy
   acá / No, todavía no* (tocar **Sí**). En **B**: *"Claudio llegó a Corralón San Martín y está
   cargando tu pedido…"*.
2. **Simular: salió** → **B**: *"Claudio salió hacia Obra Darwin con tu pedido, llega 10:40 aprox"*.
3. **Simular: llegó a destino** → **B**: *"Tu pedido llegó a Obra Darwin"*. En **D**: **"Llegaste a
   Obra Darwin"** con el botón **Viaje terminado** → km (14 más) → **Terminar viaje**.

En **B**, el pedido muestra los cinco pasos: **Aceptado · Salió · En el retiro · En camino · Entregado**.

## 9:00 — Compras ve que llegó (30 s)

En **C**: aviso **"Entregado: cemento Portland. Llegó a Obra Darwin. El pedido está completo."** →
**Habilitados** → *Entregados*. En *Sin retiro pedido* queda en rojo la arena que nadie pidió hace 4 días.

## 9:30 — El recorrido de hoy del Mercedes 710 (1 min)

En **A**: **Más → Recorridos del día** → **Camión Mercedes 710** → hoy → **Ver**. El recorrido real de
Cusat, **km del día**, las **paradas** numeradas (más de 5 minutos quieto, con hora y lugar) y los
viajes del sistema en color. **▶** con **×10**.

## 10:30 — El costo y la actividad (1 min)

En **A**: **Más → Costos** → *Por obra*: Obra Darwin con el viaje, los km y el costo. **Más →
Actividad**: *"Daniela pidió a Compras cemento…"*, *"Compras armó la OC 3150…"*, *"Dirección aprobó…"*,
*"GPS: Camión Mercedes 710 llegó a Corralón San Martín (a 0 m, 0 km/h, simulador)"*.

*"Una sola lista de pedidos de viaje y de material; Compras y el dueño se enteran sin WhatsApp; el
chofer toca dos botones; el GPS hace el resto; usted ve todo y el costo queda en la obra."*

---

### Si algo no sale

- **El mapa dice "Simulado"**: falta `CUSAT_MODO`, `CUSAT_WEB_USER` o `CUSAT_WEB_PASS` en Vercel.
  *Más → Rastreo (Cusat) → Probar conexión* dice qué falla.
- **"6 de 6" no aparece**: los vehículos de la base no tienen las patentes reales. *Reiniciar datos
  de demo* y esperar un minuto (o *Sincronizar ahora*).
- **No aparecen los botones "Simular"**: `MODO_DEMO` no está en `true`, o no se tocó *Iniciar viaje*.
- **El viaje avanzó solo antes de simular**: el GPS real del camión se movió. Es lo esperado; para la
  demo usar un viaje con un vehículo que esté quieto en la base.
- **Sin señal en la reunión**: Daniela y Claudio pueden seguir; lo que hacen queda guardado en el
  teléfono ("Pendiente de envío") y se manda solo al volver la señal.
- **Volver a empezar**: *Mi cuenta* → *Reiniciar datos de demo*.
