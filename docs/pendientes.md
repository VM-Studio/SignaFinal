# Signa · Lo que falta para producción

La app funciona completa con datos de demostración y simuladores. Para usarla de verdad faltan estas piezas. Cada una tiene un único punto de entrada en el código, así que conectarla no cambia el resto.

## Resumen (al 6/10/2026)

| Pieza | Estado hoy | Qué falta |
|---|---|---|
| **Claves VAPID (avisos push)** | Generadas para la demo y cargadas en Vercel (`VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). | Generar un par nuevo para producción (`npx web-push generate-vapid-keys`), cargarlo en Vercel y poner como `VAPID_SUBJECT` un mail o URL de la empresa. Al cambiar las claves, cada persona vuelve a tocar "Activar avisos en este celular". |
| **Dominio** | `signa-final.vercel.app`. | Dominio propio (ej. `logistica.signa.com.ar`) en Vercel, `APP_URL` con ese dominio y volver a activar los avisos en los celulares (la suscripción es por dominio). |
| **Cron de Vercel** | `vercel.json`: alertas y posiciones (diarios), resumen a choferes 7:00 (`0 10 * * *` UTC) y ETA cada minuto (`* * * * *`). | Confirmar que el plan de Vercel admite cron por minuto (Pro). Si no: cron externo cada minuto a `POST /api/jobs/eta` con `Authorization: Bearer <CRON_SECRET>`. Sin él, la hora estimada igual se recalcula con cada posición del teléfono; solo el aviso de demora depende de la próxima posición. |
| **API de Lebane** | Mock con los datos de demo. | Ver punto 1. |
| **API de Cusat** | Simulador (`MOCK`) + posiciones del teléfono del chofer (`TELEFONO`). | Ver punto 2. Cusat entra como otra fuente de `PosicionVehiculo` por `registrarPosicion()`. |
| **Fotos** | Comprimidas en el teléfono y guardadas en Postgres. | Ver punto 3 (almacenamiento de objetos). |
| **Push en celulares reales** | Probada contra el servicio real de push (las suscripciones muertas se desactivan solas). | Probar en un Android con la app instalada y en un iPhone instalado (iOS 16.4+). |

## 1. API real de Lebane (obras, proveedores, órdenes de compra)

- **Qué hay hoy**: las obras y proveedores se cargan con la demo (`src/lib/demo/datos.ts`), con `idLebane` como clave. La orden de compra es un texto libre en el pedido.
- **Qué falta**: documentación y credenciales de la API de Lebane.
- **Dónde va**:
  - Un adaptador `src/lib/lebane/` con `listarObras()`, `listarProveedores()`, `listarOrdenesCompra(obraId)` (mismo patrón que `src/lib/cusat`).
  - Una sincronización (cron diario + botón "Traer de Lebane") que haga *upsert* por `idLebane`. Lo que no venga de Lebane se marca inactivo, nunca se borra.
  - En "Pedir un viaje", elegir la orden de compra de una lista en vez de escribirla.
- **Regla**: obras y proveedores **no se editan** en Signa; se leen de Lebane.

## 2. API real de Cusat (rastreo satelital)

- **Qué hay hoy**: `src/lib/cusat/mock.ts` simula posiciones (los vehículos en viaje avanzan por su ruta; el resto queda en su base).
- **Qué falta**: documentación, URL y clave de la API; el `idCusat` real de cada vehículo (se carga en la ficha del vehículo).
- **Dónde va**: `src/lib/cusat/api.ts`, marcado con *"ACÁ VA LA LLAMADA REAL A LA API DE CUSAT"*. Con `CUSAT_API_URL` y `CUSAT_API_KEY` configuradas, la app deja de usar el simulador sola.
- **Cron**: para traer posiciones de Cusat cada minuto, el mismo criterio que el job de ETA (cron por
  minuto en Vercel Pro o un cron externo a `POST /api/posiciones` con `Authorization: Bearer <CRON_SECRET>`).
- Revisar con datos reales: radio de las geocercas (`radioGeocercaM`, 200 m por defecto), horario laboral de la alerta "fuera de horario" (L–V 7 a 19, S 7 a 13).

## 3. Almacenamiento de fotos

- **Qué hay hoy**: remitos, tickets, documentos y fotos de herramientas se comprimen en el teléfono (~200 KB) y se guardan en Postgres (tabla `Archivo`), servidos con sesión en `/api/archivos/[id]`.
- **Para producción**: con el volumen real, pasar a almacenamiento de objetos (Vercel Blob privado, S3 o R2). El cambio está en un solo lugar: `src/lib/archivos.ts` (`guardarArchivo`) y la ruta que los sirve. Migrar los existentes con un script.

## 4. Avisos

- **Hecho**: avisos en la app (bandeja `/avisos` y campana) y **push en el celular** (web-push con VAPID) para los momentos del viaje, solicitudes urgentes, demoras y el resumen diario del chofer. Todo pasa por `notificar()` en `src/lib/notificaciones`.
- **Opcional más adelante**: WhatsApp (Meta Business API o Twilio) como segundo canal para quien no instala la app. Se engancha en el mismo `notificar()`, con plantillas aprobadas por Meta.

## 5. Carga real de flota y herramientas

- **Flota**: patentes, marca/modelo/año, capacidad, **costo por km real** (combustible + mantenimiento + seguro + amortización), km actuales, base, asignado, `idCusat`, y **toda la documentación con vencimientos** (seguro, VTV, RUTA, cédula). Alta desde *Flota → Agregar*.
- **Herramientas**: alta masiva desde *Herramientas → Importar CSV* (plantilla incluida), después **imprimir las etiquetas QR** (*Etiquetas*, hoja A4) y pegarlas. Para las que ya están en obra, registrar la entrega a la obra y persona correcta.
- **Personas**: emails reales, contraseñas iniciales, licencias de los choferes con categoría y vencimiento, obras a cargo de cada responsable.
- **Datos marcados `// confirmar`** en `src/lib/demo/datos.ts`: direcciones, coordenadas, precios y nombres a validar con la empresa.

## 6. Otros puntos antes de salir

- **Dominio y entorno**: proyecto de Vercel nuevo para esta versión (o reemplazar la actual), Postgres administrado (Neon), variables `DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, `APP_URL` y `MODO_DEMO="false"`.
- **Primera carga**: `prisma migrate deploy` (lo hace el build) y crear los usuarios reales; **no** correr el seed de demo en producción.
- **Copias de seguridad** de la base (Neon tiene restauración a un punto en el tiempo; definir retención).
- **Prueba en celulares reales** de los choferes y responsables: ver `docs/verificacion-celular.md`.
