# Signa · Lista de verificación en un celular real

Probar en **un iPhone (Safari)** y **un Android (Chrome)**, con la app publicada en HTTPS (la cámara, la instalación y el modo sin señal no funcionan en `http://` salvo en `localhost`).

## Instalación (PWA)
- [ ] **Android**: menú ⋮ → *Instalar app* / *Agregar a pantalla principal*. El ícono es el logo de Signa sobre negro y el nombre es **Signa**.
- [ ] **iPhone**: Compartir → *Agregar a pantalla de inicio*. El ícono se ve bien (sin bordes blancos).
- [ ] Al abrir desde el ícono: pantalla negra con el logo (iOS) y después el **splash** negro con el logo y la barra blanca de 1,8 s. **Sin destello blanco.**
- [ ] Se abre sin barra del navegador (pantalla completa) y la barra de estado es negra.
- [ ] Cerrar y volver a abrir en el mismo día: el splash no se repite en la misma sesión.

## Entrada y navegación
- [ ] Login con un usuario de la lista *Usuarios de demo*; la sesión se mantiene al cerrar y abrir la app (dura 30 días).
- [ ] Barra inferior con **4 ítems** como máximo según el rol; *Más* abre la hoja con Alertas, Obras, Mi cuenta y Cerrar sesión.
- [ ] Todos los botones se tocan cómodo con el pulgar (52 px como mínimo); nada queda debajo de la barra inferior ni de la muesca del iPhone.
- [ ] Los campos no hacen zoom al tocarlos (iOS).

## Chofer (Claudio)
- [ ] *Pedidos* → **Tomar**: los vehículos que no sirven aparecen grises con el motivo.
- [ ] *Mis viajes*: ruta en tres líneas y **Abrir en Maps** abre Google Maps con el recorrido (base → corralón → obra).
- [ ] **Iniciar viaje** con el km precargado; **Finalizar viaje** con **foto del remito** (abre la cámara trasera) → mensaje con km y costo imputado a la obra, y *Siguiente*.
- [ ] *Combustible*: el vehículo viene elegido, la **foto del ticket** se saca y se ve la vista previa.

## Sin señal (modo avión)
- [ ] Con la app abierta en *Mis viajes*, poner **modo avión**: arriba aparece *"Sin señal"*.
- [ ] **Iniciar viaje** → queda *"Pendiente de envío"* en la tarjeta y en la franja de arriba.
- [ ] **Finalizar viaje** con km → *"Llegada guardada en el teléfono"*.
- [ ] Como responsable: **Pedir un viaje** sin señal → *"Guardado en el teléfono"*.
- [ ] Sacar el modo avión: en menos de 30 s la franja dice *"enviando…"* y desaparece; los datos aparecen en la compu (cola, costos). **Nada se duplica.**
- [ ] Abrir sin señal una pantalla que nunca se abrió: aparece la página **"Sin conexión"** de Signa.

## Responsable de obra (Daniela)
- [ ] **Pedir un viaje** en 3 pasos, sin scroll en cada paso.
- [ ] Pedir lo mismo que ya pidió otro → aparece *"¿Es lo mismo?"*.
- [ ] *Herramientas* → una máquina → **La necesito en…** → entra en la cola.
- [ ] La campana muestra solo las alertas de sus obras.

## Depósito
- [ ] **Depósito**: filtrar *Maquinaria* / *Herramientas*, buscar por nombre y abrir una ficha → *Entregar* (si está en el depósito) o *Registrar devolución* (si está en obra).
- [ ] **Sobrantes**: agregar un material que sobró de una obra (tipo, cantidad, unidad) y usar una parte.

## Dirección
- [ ] El **mapa** ocupa la pantalla; la hoja inferior se desliza con el dedo; tocar un vehículo muestra su tarjeta y **Ver recorrido de hoy**.
- [ ] El mapa se actualiza solo (sin recargar) cada 30 s.
- [ ] *Mapa → Historial*: elegir vehículo y día, **reproducir** el recorrido.
- [ ] *Alertas*: críticas arriba, cada una con su botón para resolverla.

## Al sol y con guantes
- [ ] Contraste suficiente al sol (negro/blanco), estados siempre con palabras.
- [ ] Se puede usar con una sola mano.
