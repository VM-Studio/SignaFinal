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
- **El inventario de herramientas** (planilla "Inventario SIGNA", hoja Herramientas): 117 herramientas,
  1.108 unidades, **todas en el depósito**.

Todo lo demás se carga desde la app. Para volver a este punto: *Mi cuenta* → **Dejar solo los datos
base** (con `MODO_DEMO=true`; borra todo lo cargado y no se puede deshacer).

## Orden para empezar a probar

1. **Dirección** → *Más → Obras*: revisar cada obra real (dirección y pin en el mapa, responsables,
   sedes si tiene varios frentes). **Nueva obra** para las que falten.
2. **Dirección o Compras** → *Proveedores* → **Nuevo proveedor** (corralones, ferreterías), con su
   primera sucursal; **Agregar sucursal** para las demás (cada una con horario y contacto de retiro).
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

## Recorrido para probar el circuito (guion de demo)

Con datos de prueba (solo en desarrollo: `npx prisma db seed`; **nunca** contra producción) o con los
datos reales cargados:

1. **Daniela** → *Pedir* → **Pedir materiales a Compras**: elige Obra Darwin, **adjunta la planilla de
   Excel** (o una foto) en lugar de escribir renglón por renglón, escribe observaciones ("el cemento que
   sea Loma Negra") y pide.
2. **Compras** ve el pedido con el clip y la nota, abre el adjunto en la app, **Tomar** → **Armar orden
   de compra**: **Importar desde planilla-darwin.xlsx** (los renglones aparecen solos), precios,
   proveedor **Corralón San Martín** y su **sucursal**, método de pago, **Vista previa del PDF** →
   **Enviar a aprobación**: recibe el número **OC-2026-000N**.
3. **El dueño** recibe el push y en *Aprobaciones* ve la OC **con todos los datos escritos** (renglones,
   precios, IVA, total, método de pago, lo que pidió la obra) y el PDF → **Aprobar**. (Para probar el
   rechazo: **Rechazar** con motivo → Compras **Corregir y reenviar** → número nuevo.)
4. **Compras** → **Habilitar para retirar**: viene todo precargado de la OC; tilda lo que se retira.
   **Daniela** ve en su pedido la OC aprobada con su PDF.
5. **Daniela** (o César, Lolo) → *Pedir* → **Retiro en proveedor** → marca lo listo → pide el viaje.
6. **Claudio** → *Solicitudes* → **Aceptar** el cemento para Darwin: **Aprovechá el viaje** le ofrece el
   hierro para Chubut en el mismo corralón y la hormigonera de Humboldt a 1,2 km. Prueba: con Pinares
   (4.000 kg) y el Kia (3.000) no deja confirmar. Combina los tres con el Mercedes: un viaje de 4 paradas
   ordenado (corralón → Humboldt → Darwin → Chubut).
7. **Claudio** → **Iniciar viaje** → en el corralón tilda la carga por obra (si falta algo: **Faltó**,
   "30 de 40") → **Cargué todo, salgo** → Humboldt → Darwin (**Entregado acá**) → Chubut → **Viaje
   terminado** con km y peajes. Daniela y César reciben cada uno los avisos de **su** parada; en
   *Costos* el viaje aparece repartido por obra.
8. **Fechas**: el viaje aceptado para pasado mañana aparece en *Hoy → Próximos* con la fecha grande y el
   botón **Iniciar** deshabilitado; **Pedir que lo adelanten** → el dueño lo **Reprograma** para hoy →
   Claudio recibe el aviso y los recordatorios.
9. **Depósito**: buscar una herramienta (filtro Maquinaria / Herramientas) y entregarla a una obra. En
   *Sobrantes*, cargar lo que sobró de una obra.

Cada paso le llega a quien corresponde al instante (campana y celular). Lo que pasó queda en
*Más → Actividad*.

### Modo demo

`MODO_DEMO=true` muestra los usuarios en el login, el botón *Dejar solo los datos base* y, en un viaje
en curso, los botones **Simular: llegó al retiro / salió / llegó a destino** para mostrar el viaje
automático sin salir a la calle.
