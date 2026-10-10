# Rutas, distancias y horas de llegada

Código: `src/lib/rutas` (proveedores), `src/lib/viajes/tramos.ts` (hora estimada de cada viaje),
`src/app/api/jobs/eta` (job de cada minuto).

## Regla: sin tránsito no hay minutos

Una hora de llegada calculada sin tránsito ("llegás 11:04") en Buenos Aires es casi siempre falsa.
Por eso la app separa **distancia** de **tiempo**:

| | Sin `GOOGLE_MAPS_API_KEY` | Con `GOOGLE_MAPS_API_KEY` |
|---|---|---|
| Pantalla del chofer | "7,2 km" | "7,2 km · 18 min · llegás 11:04 (con tránsito)" |
| Seguimiento del que pidió | "Claudio está a 7 km de Obra Darwin." | "…, llega 11:04 (con tránsito)." |
| Avisos | "Está a 7 km de la obra" (nunca una hora) | con la hora "(con tránsito)" |
| Aviso de demora (+15 min) | no existe | una vez por viaje |
| Navegación del chofer | botón "Abrir en Google Maps" | igual |

- **Distancia y recorrido** (siempre): OSRM público (gratis, sin clave). Si falla o tarda más de 4 s,
  línea recta × 1,3. Nunca traba una acción.
- **Tiempo con tránsito** (solo con clave): Google Routes API, `computeRoutes` con
  `routingPreference: TRAFFIC_AWARE_OPTIMAL` y salida "ahora". Caché de 60 s por par de puntos
  (redondeados a ~100 m). Si Google falla, la app vuelve a mostrar solo distancia, sin romper nada.
- Las horas estimadas se guardan en `Viaje.etaRetiro` / `Viaje.etaDestino`. Sin clave quedan vacías.

## Cómo crear la clave

1. Entrar a <https://console.cloud.google.com/> con la cuenta de la empresa y crear un proyecto
   ("Signa Logística").
2. **Facturación**: asociar una cuenta de facturación (Google la pide aunque el uso quede dentro de lo gratis).
3. **APIs y servicios → Biblioteca** → buscar **Routes API** → Habilitar.
4. **APIs y servicios → Credenciales → Crear credenciales → Clave de API**.
5. Editar la clave:
   - **Restricciones de API**: "Restringir clave" → marcar solo **Routes API**.
   - **Restricciones de aplicación**: "Sitios web" → agregar el dominio de la app
     (ej. `https://signa-logistica.vercel.app/*`). La app llama a Google desde el servidor y manda
     ese dominio en el encabezado `Referer`, así que hay que cargar también la variable
     `GOOGLE_MAPS_REFERER` con el mismo dominio (ej. `https://signa-logistica.vercel.app/`).
6. **Presupuesto y alertas** (Facturación → Presupuestos): crear uno de USD 5 con aviso al 50 % y al 100 %.
7. Cargar las variables en Vercel (Production). Las sube el dueño, no se commitean:

```bash
vercel env add GOOGLE_MAPS_API_KEY production
vercel env add GOOGLE_MAPS_REFERER production
```

Después de cargarlas hace falta un deploy nuevo para que las tome.

## Costo estimado

`TRAFFIC_AWARE_OPTIMAL` se cobra como **Compute Routes Pro** (precios de 2026: USD 10 cada 1.000
pedidos, con 5.000 pedidos gratis por mes). Para no gastar de más, Google se usa **solo para la
hora de llegada**:

- al iniciar el viaje (2 pedidos), en cada transición (llegó / salió, 1 pedido cada una);
- el job de cada minuto recalcula la hora como mucho **cada 5 minutos por viaje en curso**;
- las pantallas que se refrescan solas (chofer, seguimiento, mapa) usan OSRM (gratis) y leen la hora guardada.

Cuenta: unos 15 pedidos a Google por viaje × 8 viajes por día × 22 días ≈ 2.700 por mes, dentro de
los 5.000 gratis. Aun con el doble de viajes queda en **menos de USD 5 por mes**.

## Sin clave

No hay que hacer nada: la app funciona igual, mostrando solo distancias.
