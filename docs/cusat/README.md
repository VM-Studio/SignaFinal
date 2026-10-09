# Cusat View · cómo está conectado

El rastreo satelital de la flota es **Cusat View** (cusatglobal.com), de Suartec. Cusat no tiene
API pública: el adaptador reproduce las llamadas internas que hace su propia web, con un usuario
de la cuenta de Signa. Lo descubierto está en [api-descubierta.md](api-descubierta.md).

## Piezas

| Archivo | Qué hace |
|---|---|
| `src/lib/cusat/cusatView.ts` | Adaptador real: login, posiciones actuales, dirección, historial. Timeout 8 s, nunca lanza. |
| `src/lib/cusat/mock.ts` | Simulador con el mismo contrato (desarrollo y demo). |
| `src/lib/cusat/index.ts` | Elige uno u otro con `CUSAT_MODO`. |
| `src/lib/cusat/emparejar.ts` | Enlaza cada unidad de Cusat con un vehículo: por patente, si no por `cusatNombre`. Guarda `idCusat`. |
| `src/lib/cusat/sincronizar.ts` | Pide posiciones, guarda `PosicionVehiculo` (fuente CUSAT) si son nuevas, actualiza la última posición del vehículo, geocercas y alertas. |
| `src/lib/cusat/historial.ts` | Recorrido de un día, paradas, km. Los días pasados se guardan y no se vuelven a pedir. |
| `src/app/api/cusat/sincronizar/route.ts` | Ruta del cron (protegida con `CRON_SECRET`). |
| `/configuracion/rastreo` | Estado, "Probar conexión", "Sincronizar ahora" y enlaces a mano. |
| `scripts/cusat-descubrir.ts` | Vuelve a descubrir las llamadas de la web (ver abajo). |
| `scripts/cusat-probar.ts` | Prueba el adaptador contra Cusat sin tocar la base. |

## Variables de entorno

| Variable | Valor |
|---|---|
| `CUSAT_MODO` | `cusatview` para la web real; `mock` (o sin definir) para el simulador |
| `CUSAT_WEB_USER` / `CUSAT_WEB_PASS` | Usuario y contraseña de Cusat View. Solo en `.env` y en Vercel; nunca en el código. |
| `CRON_SECRET` | Protege `/api/cusat/sincronizar` |

## Llamadas que usa

Todas son `POST https://cusatglobal.com/webApi` con JSON (`Content-Type: text/plain`) y `iq` = operación:

- `3387061` login (`us`, `ps`) → `user_id`. Se guarda en memoria 6 h; si una llamada viene vacía o
  con 401/403, se reingresa una vez.
- `338100` vehículos con posición actual (`uid`). Campos: `unit_id`, `plate`, `ali`, `lat`, `lon`,
  `speed`, `direction`, `load_date` (hora argentina), `ev` (contacto: "EN CTO" / "SIN CTO").
- `90100` dirección en texto de una unidad (`iu`, `un`). Se pide solo si el vehículo se movió más de 80 m.
- `3381030` historial de un día (`iduser`, `idunit`, `report_date` AAAA-MM-DD) → puntos `{ lt, ln, e, s }`.

## De dónde sale la posición

1. **Cusat** (cada minuto por el cron, y cada 20 s mientras alguien mira el mapa o un viaje).
2. **Teléfono del chofer** durante un viaje, si Cusat no reportó en los últimos 2 minutos.
3. **Botones del chofer** (Iniciar, Llegué al retiro, Llegué al destino) si no hay ninguna de las dos.

## Si Cusat cambia su web

Síntoma: en `/configuracion/rastreo` aparece un error ("no devolvió la lista", "no es JSON", login
rechazado) y los vehículos quedan grises en el mapa.

1. Correr `npx tsx scripts/cusat-descubrir.ts` (abre el navegador; tarda 2 minutos).
2. Comparar `docs/cusat/api-descubierta.md` con lo que hace `cusatView.ts` (constante `OP` y los
   nombres de campo en `aPosicion`).
3. Ajustar, correr `npx tsx scripts/cusat-probar.ts` y desplegar.

Mientras tanto la app sigue funcionando: el mapa muestra la última posición conocida (en gris) y
los viajes siguen con el teléfono del chofer y sus botones.

## Pedirle a Cusat una API oficial

Texto para mandarle a Suartec / Cusat:

> Hola. Somos Signa Desarrollos S.A., clientes de Cusat View con 6 vehículos de flota. Estamos
> integrando las posiciones en nuestro sistema interno de logística y necesitaríamos una API
> oficial (REST o similar) con autenticación por token o clave de API, para:
> 1. Consultar la última posición de cada unidad (patente, latitud, longitud, velocidad, rumbo,
>    contacto, fecha del GPS y dirección).
> 2. Consultar el recorrido de una unidad entre dos fechas.
> 3. Opcionalmente, recibir eventos (encendido, apagado, entrada y salida de geocercas) por webhook.
> Consultamos cada 1 minuto como máximo. ¿Tienen documentación, un entorno de prueba o un costo
> para esto? Hoy lo hacemos replicando las llamadas de la web, que puede romperse con cualquier
> cambio suyo.
> Además, notamos que las llamadas internas de la web, después del login, solo llevan el número
> de usuario y no un token de sesión. Les sugerimos revisarlo.

Con una API oficial solo cambia `cusatView.ts`; el resto de la app no se toca.
