# Signa · Primeros pasos

La app arranca **vacía**: no hay datos de demostración. Lo único fijo (los **datos base**, en
`src/lib/base/`) es:

- **Usuarios con su rol** (contraseña inicial `signa2026`; aparecen en el login para entrar de un toque).
- **Base de camiones Martínez** y **Depósito Florida** (Av. Bartolomé Mitre 1254, la del inventario).
- **Los seis vehículos reales** (Mercedes 710, Kia, Zanella, Oroch, Kangoo, Kangoo LL). Cusat los enlaza
  solo por patente en el primer minuto y desde ahí el mapa muestra dónde está cada uno.
- **El inventario de herramientas** (planilla "Inventario SIGNA", hoja Herramientas): 117 herramientas,
  1.108 unidades, **todas en el depósito**.

Todo lo demás se carga desde la app. Para volver a este punto: *Mi cuenta* → **Dejar solo los datos
base** (con `MODO_DEMO=true`; borra todo lo cargado y no se puede deshacer).

## Orden para empezar a probar

1. **Dirección** → *Más → Obras* → **Nueva obra**: nombre, dirección y localidad (se ubica sola en el
   mapa) y los responsables. Repetir con cada obra.
2. **Dirección o Compras** → *Proveedores* → **Nuevo proveedor** (corralones, ferreterías).
3. **Administración** → *Flota* → cada vehículo → **seguro y VTV** con su vencimiento. Sin seguro y VTV
   cargados un vehículo no se puede usar en un viaje. También el **costo por km** y los km del tablero.
4. **Administración** → *Usuarios*: teléfonos, licencia de cada chofer (categoría y vencimiento: sin
   licencia vigente no puede aceptar viajes) y las obras de cada responsable.
5. Cada persona en su celular: *Mi cuenta* → **Avisos en este dispositivo** → **Activar avisos** →
   **Enviarme una prueba**. La lista de arriba dice qué falta si no llega (app instalada, permiso,
   suscripción a su nombre, claves del servidor).

**Avisos y usuarios**: los avisos de un celular son del usuario que tiene la sesión abierta. Al entrar con
otro usuario, el celular pasa solo a ese usuario; al cerrar sesión, deja de recibir. Para probar todo
desde un solo celular viendo los avisos de todos: `AVISOS_A_TODOS=true` en Vercel (cada push dice para
quién es). Para revisar un usuario desde la terminal: `npx tsx scripts/push-probar.ts <email>`.

## Recorrido para probar el circuito

1. **Daniela** pide materiales a Compras para su obra.
2. **Compras** lo toma, carga la OC y pide aprobación → el **dueño** aprueba en *Aprobaciones*.
3. **Compras** lo habilita para retirar en un proveedor.
4. **Daniela** → *Pedir* → **Retiro en proveedor** → marca el material → pide el viaje.
5. **Claudio** acepta, toca **Iniciar viaje** y va. El GPS (Cusat o su teléfono) marca la llegada al
   retiro, la salida y la llegada a la obra; al final, **Viaje terminado**.
6. **Depósito**: escanear o buscar una herramienta y entregarla a una obra.

Cada paso le llega a quien corresponde al instante (campana y celular). Lo que pasó queda en
*Más → Actividad*.

### Modo demo

`MODO_DEMO=true` muestra los usuarios en el login, el botón *Dejar solo los datos base* y, en un viaje
en curso, los botones **Simular: llegó al retiro / salió / llegó a destino** para mostrar el viaje
automático sin salir a la calle.
