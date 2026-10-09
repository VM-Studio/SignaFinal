# Signa · Lo que falta

La app funciona completa. Lo que sigue son datos a confirmar con el dueño y piezas externas.
Cada pieza externa tiene un único punto de entrada en el código, así que conectarla no cambia el resto.

## Resumen (al 9/10/2026)

| Pieza | Estado hoy | Qué falta |
|---|---|---|
| **Cusat (rastreo)** | **Conectado** a Cusat View con el usuario de la cuenta (adaptador que reproduce la web, `docs/cusat/`). Los seis vehículos con posición real, historial y dirección. Sincroniza cada minuto (cron de Vercel, verificado: 200 cada minuto). | API oficial de Cusat (punto 2). Confirmar la Hilux y la retro (punto 1). |
| **Cron** | Vercel Cron cada minuto: `/api/cusat/sincronizar` (Cusat) y `/api/jobs/eta` (horas estimadas y "sin señal"). | Nada mientras el plan de Vercel admita cron por minuto. Si no, cron-job.org (`docs/cusat/cron.md`). `/configuracion/rastreo` avisa si pasan 5 minutos sin sincronizar. |
| **Lebane** | Obras y proveedores cargados a mano (demo); la OC se escribe en Compras. | API de Lebane (punto 3). |
| **Datos del dueño** | Marcados `// confirmar` en `src/lib/demo/datos.ts`. | Punto 1. |
| **Claves VAPID (push)** | Cargadas en Vercel, sirven para producción. | Solo si se pasa a dominio propio: `VAPID_SUBJECT`. |
| **Dominio** | `signa-final.vercel.app`. | Dominio propio en Vercel, `APP_URL`, y volver a activar los avisos en los celulares. |
| **Fotos** | Comprimidas en el teléfono y guardadas en Postgres. | Almacenamiento de objetos con el volumen real (punto 4). |

## 1. Confirmar con el dueño

**Flota** (hoy cargada con lo que muestra Cusat):

| Vehículo | Patente | A confirmar |
|---|---|---|
| Camión Mercedes 710 | HFD336 | Año, km del tablero, **capacidad (5 tn?)**, **costo por km**, documentación con vencimientos |
| Camión Kia | AH282PU | Modelo exacto (K2500?), **capacidad (3 tn?)**, costo por km, documentación |
| Zanella | AG149BJ | **Tipo**: ¿es una moto o un auto? ¿Entra en las solicitudes? ¿Quién la usa? |
| Oroch | AC689NR | **Quién la usa** (asignada a alguien o de uso general), km, documentación |
| Kangoo | AF399OO | Está en el interior (Lincoln): ¿de qué obra?, quién la usa |
| Kangoo LL | AF399OP | Quién la usa, si entra en las solicitudes |

- **En la cuenta de Cusat hay 15 unidades**: además de las seis, una **Hilux** (Lincoln), una
  **retroexcavadora** ("Retro - Cukurova") y siete vehículos particulares. ¿La Hilux y la retro se
  suman a la flota? (Se enlazan en *Más → Rastreo (Cusat)*).
- **Costo por km** de cada vehículo (combustible + mantenimiento + seguro + amortización): es lo que
  se imputa a cada obra.
- **Depósito**: dirección de **Terreno 1** y **Terreno 2**, y en cuál se guardan las herramientas.
- **Base de camiones**: Triunfo Argentino / Granada y Maestro, Martínez (coordenadas tomadas de Cusat).
- **Compras**: nombre, email y teléfono de la persona de compras (hoy "Compras", `compras@signa.demo`).
- **Dueño**: nombre para el usuario de Dirección.
- **Personas**: emails reales, contraseñas iniciales, licencias de los choferes (categoría y
  vencimiento), obras a cargo de cada responsable.
- **Radios de llegada**: 150 m al retiro, la geocerca de cada obra (200 m por defecto). Ajustables
  en `src/lib/viajes/parametros.ts` y en cada obra.

## 2. Cusat: API oficial

- **Hoy**: el adaptador (`src/lib/cusat/cusatView.ts`) reproduce las llamadas internas de la web de
  Cusat con el usuario de la cuenta. Funciona, pero puede romperse si Cusat cambia su web (qué hacer:
  `docs/cusat/README.md`, "Si Cusat cambia su web").
- **Pedirles**: una API oficial con token (texto listo en `docs/cusat/README.md`). Además, avisarles
  que sus llamadas internas no llevan token de sesión.
- **Contraseña**: cambiar la contraseña del usuario de Cusat por una más fuerte y actualizarla en
  `.env` y en Vercel (`CUSAT_WEB_PASS`).
- Con una API oficial solo cambia `cusatView.ts`.

## 3. Lebane (obras, proveedores, órdenes de compra)

- **Hoy**: obras y proveedores cargados a mano con `idLebane` como clave. En Compras, el número de OC
  y el monto se escriben al pedir la aprobación.
- **Falta**: documentación y credenciales de la API de Lebane.
- **Dónde va**: un adaptador `src/lib/lebane/` (mismo patrón que `src/lib/cusat`) con obras,
  proveedores y **órdenes de compra**. Con eso: Compras elige la OC de una lista (con monto y
  proveedor ya cargados) en vez de escribirla, y los pedidos de material pueden nacer en Lebane
  (`fuente = LEBANE`, `ordenCompraLebaneId`).
- **Regla**: obras y proveedores no se editan en Signa; se leen de Lebane.

## 4. Almacenamiento de fotos

- **Qué hay hoy**: remitos, tickets, documentos y fotos de herramientas se comprimen en el teléfono (~200 KB) y se guardan en Postgres (tabla `Archivo`), servidos con sesión en `/api/archivos/[id]`.
- **Para producción**: con el volumen real, pasar a almacenamiento de objetos (Vercel Blob privado, S3 o R2). El cambio está en un solo lugar: `src/lib/archivos.ts` (`guardarArchivo`) y la ruta que los sirve. Migrar los existentes con un script.

## 5. Avisos

- **Hecho**: avisos en la app (bandeja `/avisos` y campana) y **push en el celular** (web-push con VAPID) para los momentos del viaje, solicitudes urgentes, demoras y el resumen diario del chofer. Todo pasa por `notificar()` en `src/lib/notificaciones`.
- **Opcional más adelante**: WhatsApp (Meta Business API o Twilio) como segundo canal para quien no instala la app. Se engancha en el mismo `notificar()`, con plantillas aprobadas por Meta.

## 6. Carga real de herramientas y personas

- **Herramientas**: alta masiva desde *Herramientas → Importar CSV* (plantilla incluida), después revisar en *Depósito* que estén todas. Para las que ya están en obra, registrar la entrega a la obra y persona correcta.
- **Personas**: emails reales, contraseñas iniciales, licencias de los choferes con categoría y vencimiento, obras a cargo de cada responsable.
- **Datos marcados `// confirmar`** en `src/lib/demo/datos.ts`: direcciones, coordenadas, precios y nombres a validar con la empresa.

## 7. Otros puntos antes de salir

- **Dominio y entorno**: proyecto de Vercel nuevo para esta versión (o reemplazar la actual), Postgres administrado (Neon), variables `DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, `APP_URL` y `MODO_DEMO="false"`.
- **Primera carga**: `prisma migrate deploy` (lo hace el build) y crear los usuarios reales; **no** correr el seed de demo en producción.
- **Copias de seguridad** de la base (Neon tiene restauración a un punto en el tiempo; definir retención).
- **Prueba en celulares reales** de los choferes y responsables: ver `docs/verificacion-celular.md`.
