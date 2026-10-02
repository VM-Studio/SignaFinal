# Signa · Guion de demo (8 minutos)

Para mostrarle al dueño, siguiendo el problema que él mismo contó: **seis personas le piden viajes a dos choferes, cada una sin saber qué pidieron las otras**. Se duplican pedidos, los choferes responden de memoria y los responsables terminan yendo ellos con su camioneta.

## Antes de empezar (5 minutos antes)

1. `MODO_DEMO="true"` y `SIMULADOR_ACELERAR="10"` en el entorno (los viajes en el mapa avanzan 10 veces más rápido).
2. Entrar como **Dirección** → *Mi cuenta* → **Reiniciar datos de demo**. Deja todo como en este guion.
3. Tener abiertas tres pestañas (o tres teléfonos), cada una con un usuario de la lista *Usuarios de demo* del login (contraseña `signa2026`):
   - **A: Dirección** (el dueño, en la compu, en `/inicio`).
   - **B: Daniela** (en el celular).
   - **C: Claudio** (en el celular).

> Si el cron de posiciones no está corriendo, no pasa nada: el mapa pide posiciones nuevas cada vez que se actualiza (cada 30 s).

---

## 0:00 — El problema (30 s)

En la pestaña **A** (Dirección). *"Hoy cada uno le pide a Claudio y a Cristian por WhatsApp. Nadie sabe qué pidió el otro."* Mostrar la **cola única** (`/pedidos`): todos los pedidos, en orden, urgentes arriba, con el estado en palabras ("Tomado por Claudio · sale 10:30").

## 0:30 — Lolo y Daniela piden lo mismo (1 min 30 s)

1. En **A**, abrir la campana → **Alertas**: *"¿Pedido repetido para Obra Darwin? Pedido de Lolo y pedido de Daniela parecen lo mismo: Hierro del 10."* Tocar **Ver el primero** y **Ver el segundo**: es el mismo hierro, el mismo día.
2. En **B** (Daniela): **Pedir un viaje** → *Retirar en un proveedor* → Proveedor **Hierros Martínez**, qué: **Hierro del 10, 40 barras**, peso **Hasta 3 tn**, obra **Darwin** → Siguiente → Pedir el viaje.
3. Aparece: **"Lolo ya pidió esto hoy a las 9:00: Retiro · Hierro del 10, 40 barras · de Hierros Martínez · para Obra Darwin. ¿Es lo mismo?"** Tocar **Sí, es lo mismo** → la lleva al pedido existente. *No se creó un pedido duplicado.*

## 2:00 — Claudio toma el pedido y el dueño lo ve en el mapa (2 min 30 s)

1. En **C** (Claudio): *Pedidos* → en el pedido del hierro de Lolo tocar **Tomar** → elegir **Camión 3 tn** (los que no sirven aparecen en gris con el motivo: "Hace falta camión", "Seguro vencido") → hora → **Confirmar**.
2. *Mis viajes*: la ruta en tres líneas: **Desde** Base de camiones Martínez / **Retirar en** Hierros Martínez / **Entregar en** Obra Darwin, con **Abrir en Maps**.
3. **Iniciar viaje** → el km ya viene cargado → **Salir ahora**.
4. En **A** (Dirección): el inicio muestra el mapa. Abrir **Mapa**, tocar el **Camión 3 tn** (verde = en viaje): chofer, viaje, obra destino, velocidad. **Ver recorrido de hoy**: la ruta planificada punteada con paradas numeradas (1 Base · 2 Hierros Martínez · 3 Obra Darwin) y el rastro real en verde.
5. Cada 30 s el mapa se actualiza solo: el camión llega al corralón (≈ 20 s), se queda cargando (≈ 2 min) y sigue hacia Darwin (≈ 3 min). Al entrar en la geocerca punteada de la obra, la tarjeta dice **"ya llegó (GPS)"**. Mientras tanto se puede seguir con el punto siguiente y volver al mapa al final.

## 4:30 — El costo aparece en la obra (1 min)

1. En **C** (Claudio): **Finalizar viaje** → km de llegada (por ejemplo 20 km más que los de salida: Martínez → Hierros Martínez → Villa Crespo), peajes (opcional), foto del remito (opcional) → **Terminar viaje**.
2. Mensaje: **"Viaje terminado. 20 km, $ 16.800 imputados a Obra Darwin."** (20 km × $ 840 por km del Camión 3 tn) y **Siguiente:** el próximo pedido de su ruta.
3. En **A**: **Costos** → *Por obra*: Obra Darwin con sus viajes, km y costo. Botón **CSV por obra (para Lebane)** con la columna *Código de obra Lebane*.

## 5:30 — Una hormigonera pedida desde la obra entra en la cola (1 min 30 s)

1. En **B** (Daniela): **Herramientas** → *Maquinaria* → **Hormigonera 130 l** (está en el depósito) → **La necesito en…** → Obra Darwin, mañana → confirmar.
2. Mensaje: *"Pedido en la cola. Lo ven Claudio y Cristian."*
3. En **C** (Claudio) o en **A**: la **cola** muestra *Trasladar maquinaria · Hormigonera 130 l (SIG-0011)*, con **Necesita camión**. Herramientas y viajes quedan unidos: cuando el viaje termine, la hormigonera queda registrada en Darwin a cargo de Daniela.

## 7:00 — La VTV que vence en 5 días (40 s)

En **A**: la campana tiene el contador. **Alertas** → *Avisos*: **"Camión 4 tn: VTV vence en 5 días"** → **Renovar documento** lleva a la ficha del camión, pestaña Documentación. Mostrar también la crítica **"Interior 1: Seguro venció hace 1 día"**: ese vehículo no aparece para tomar viajes.

## 7:40 — Cierre (20 s)

*"Una sola cola, que todos ven; el sistema avisa si piden lo mismo; los choferes toman en orden; usted ve el camión en el mapa y el costo queda en la obra. Las alertas se resuelven solas cuando se arregla el problema."*

---

### Si algo no sale

- **El camión no se mueve**: revisar `SIMULADOR_ACELERAR` y esperar 30 s (el mapa se refresca solo).
- **Ya no aparece el aviso de duplicado**: alguien canceló o tomó el pedido de Lolo. Reiniciar datos de demo.
- **Hay que volver a empezar**: *Mi cuenta* → *Reiniciar datos de demo* (cierra la sesión de todos).
