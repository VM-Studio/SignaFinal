# Signa · Primeros pasos

La app arranca **vacía**: no hay datos de demostración. Lo único fijo (los **datos base**, en
`src/lib/base/`) es:

- **Usuarios con su rol** (contraseña inicial `signa2026`; aparecen en el login para entrar de un toque).
- **Base de camiones Martínez**, **Depósito Florida** (Galpón, Av. Bartolomé Mitre 1254, la del
  inventario) y **Terreno Humboldt 2417** (Terreno, Villa Crespo). Se editan en *Configuración → Ubicaciones*.
- **Las obras reales** (Darwin 1299, Chubut 550, Gaspar Campos 275, Pinares II, Bayres Connect, Álvarez Thomas 1545, Blaspareda,
  Hotel Medit, Edén…) con su dirección aproximada y sus responsables (los que faltan confirmar, en
  docs/cambios-2026-10-10.md).
- **Los seis vehículos reales** (Mercedes 710, Kia, Zanella, Oroch, Kangoo, Kangoo LL). Cusat los enlaza
  solo por patente en el primer minuto y desde ahí el mapa muestra dónde está cada uno.
- **Compras**: las cuatro razones sociales de la planilla de Compras (Signa Desarrollos, Darwin 1299,
  Álvarez Thomas, Remedios de Escalada 2329), los "Solicitado por" sin usuario (Romina, Hernán) y la
  numeración de OC y PE en cero (el dueño fija el próximo número en *Más → Configuración → Numeración y
  solicitantes*).
- **El inventario de herramientas** (planilla "Inventario SIGNA", hoja Herramientas): 117 herramientas,
  1.108 unidades, **todas en el depósito**.

Todo lo demás se carga desde la app. Para volver a este punto: *Mi cuenta* → **Dejar solo los datos
base** (con `MODO_DEMO=true`; borra todo lo cargado y no se puede deshacer).

## Dónde está cada cosa (barra de cada rol)

| Rol | Barra (celular) | En "Más" |
|---|---|---|
| Dirección | Aprobaciones · Pedidos · Pedir un viaje · Más | Viajes (Mapa, Viajes en curso, Solicitudes, Pedir, Mis pedidos), Compras, Flota, Depósito, Actividad, Alertas, Obras, Proveedores, Configuración |
| Compras | Tablero · Pedidos · Viajes · Más | Habilitados, Proveedores, Mis avisos, Cuenta (sin inicio: entra al Tablero) |
| Responsable / Capataz | Pedir · Mis pedidos · Viajes · Más | Herramientas, Obras, Avisos |
| Chofer (entra a Hoy) | Hoy · Solicitudes · Avisos · Más | Combustible |
| Depósito (entra a Herramientas) | Herramientas · Entregas · Sobrantes · Más | Alta masiva, Avisos |
| Administración | Facturación · Costos · Tablero · Más | Flota, Alertas, Obras, Proveedores, Razones sociales, Usuarios |

En escritorio, la barra lateral tiene los mismos tres arriba y el resto en "Más" (plegado). Mi cuenta y
Cerrar sesión, en el avatar y al pie de "Más".

## Orden para empezar a probar

1. **Dirección** → *Más → Obras*: revisar cada obra real (dirección y pin en el mapa, responsables,
   sedes si tiene varios frentes). **Nueva obra** para las que falten.
2. **Dirección o Compras** → *Proveedores* → **Nuevo proveedor** (corralones, ferreterías), con su
   primera sucursal; **Agregar sucursal** para las demás (cada una con horario y contacto de retiro).
3. **Administración** → *Más → Flota* → cada vehículo → *Documentación* → **Cargar documento**: tipo, compañía,
   número, vencimiento y la **foto o el PDF** del papel (obligatorio). Sin seguro y VTV cargados un vehículo no
   se puede usar en un viaje ("Sin documentación" en rojo y la alerta "Vehículo sin seguro cargado"). Todos de
   una vez: `npx tsx scripts/cargar-documentacion.ts` con docs/flota/documentacion.json. También el **costo por
   km** (los km los suma la app con el GPS de cada viaje).
4. **Administración** → *Usuarios*: teléfonos, licencia de cada chofer (categoría y vencimiento: sin
   licencia vigente no puede aceptar viajes) y las obras de cada responsable.
5. Cada persona en su celular: *Mi cuenta* → **Avisos en este dispositivo** → **Activar avisos** →
   **Enviarme una prueba**. La lista de arriba dice qué falta si no llega (app instalada, permiso,
   suscripción a su nombre, claves del servidor).

**Avisos y usuarios**: los avisos de un celular son del usuario que tiene la sesión abierta. Al entrar con
otro usuario, el celular pasa solo a ese usuario; al cerrar sesión, deja de recibir. Para probar todo
desde un solo celular viendo los avisos de todos: `AVISOS_A_TODOS=true` en Vercel (cada push dice para
quién es). Para revisar un usuario desde la terminal: `npx tsx scripts/push-probar.ts <email>`.

## Recorrido para probar el circuito (guion de demo)

Con datos de prueba (solo en desarrollo: `npx prisma db seed`; **nunca** contra producción) o con los
datos reales cargados:

1. **Daniela** → *Pedir* → **Armar orden de compra**: la plantilla de Compras, en blanco. Elige Obra Darwin,
   escribe el Detalle del Pedido ("40 - bolsas de cemento"), el Proveedor Sugerido y adjunta la planilla →
   **Enviar a Compras**. (El rápido: **Pedir materiales**, solo obra y qué hace falta.)
2. **Compras** (con la misma hoja abierta ve aparecer lo que escribe Daniela) la tiene en *Pedidos* como
   **Con OC cargada**; al abrirla pasa a **En Compras**. Completa Proveedor Final, Importe y Forma de Pago (se
   guarda solo) → **Enviar a autorización**: recibe el número **OC-000N**. Daniela ve el Proveedor Final en
   gris (no lo puede tocar).
3. **El dueño** recibe el push y en *Aprobaciones* ve la hoja con todos los datos y el PDF → **Autorizar**.
   (Para probar el rechazo: **Rechazar** con motivo → vuelve a Compras con el motivo arriba.)
4. **Compras** → **Marcar como encargada** → **Habilitar para retirar** (sucursal, horario): la barra se pone
   verde. **Daniela** ve la tarjeta verde en *Mis pedidos* con **Pedir el viaje**.
5. **Daniela** → **Pedir el viaje** en la tarjeta verde (llega con el material marcado y "mañana a la mañana") → **Pedir el viaje**.
   (O **Compras** → *Viajes* → **Coordinar viaje**: para Daniela, obra Darwin → el pedido sale a nombre de
   Daniela y Claudio ve "Pidió Daniela · coordinó …".)
6. **Claudio** → *Solicitudes* → **Aceptar** el cemento para Darwin: **¿Llevás algo más?** le muestra "Para la
   misma obra (Darwin) también pidieron: Hormigonera · retirar en Terreno Humboldt" y "En el mismo lugar
   (Corralón San Martín) hay para retirar: Hierro del 12 para Chubut", cada uno con **Sí, lo llevo** / **No**.
   Pinares (4 tn) dice "No entra en el Camión Mercedes 710 (5.000 kg)" con lo que ya lleva y no tiene Sí.
7. **Claudio** → **Iniciar viaje** → el modo conducción, un paso por pantalla, sin escribir ningún número:
   Iniciar viaje → Llegué al Corralón (tilda la carga; si falta algo, **Faltó**) → En camino a Terreno Humboldt
   → Llegué a Terreno Humboldt → En camino a Obra Darwin → Terminar viaje (peajes $0). Los km salen del GPS;
   en *Costos* el viaje aparece repartido por obra. Si mientras tanto Daniela pide algo más para Darwin,
   Claudio recibe "Pidieron algo más para Darwin" con **Sí, lo llevo** / **No**.
8. **Fechas**: el viaje aceptado para pasado mañana aparece en *Hoy → Próximos* con la fecha grande y el
   botón **Iniciar** deshabilitado; **Pedir que lo adelanten** → el dueño lo **Reprograma** para hoy →
   Claudio recibe el aviso y los recordatorios.
9. **Camila** (Administración) → *Facturación* → abre la orden → completa **3. Facturación**, adjunta la
   factura → **Pedir autorización** del pago → el dueño la autoriza en *Aprobaciones → Pagos*. **Imprimir /
   PDF** sale con dos páginas: la hoja y la factura.
   **Lolo**, desde el celular → *Pedir* → **Armar pedido especial**: solo obra y detalle → **Enviar a
   Compras**; a Alejandra le llega como **Solo indicaciones**. *Exportar a Excel* baja el tablero con sus
   colores; la planilla vieja la carga el dueño en *Más → Compras → Importar Excel*.
10. **Depósito**: buscar una herramienta (filtro Maquinaria / Herramientas) y entregarla a una obra. En
   *Sobrantes*, cargar lo que sobró de una obra.

Cada paso le llega a quien corresponde al instante (campana y celular). Lo que pasó queda en
*Más → Actividad*.

### Modo demo

`MODO_DEMO=true` muestra los usuarios en el login, el botón *Dejar solo los datos base* y, en un viaje
en curso, los botones **Simular: llegó al retiro / salió / llegó a destino** para mostrar el viaje
automático sin salir a la calle.
