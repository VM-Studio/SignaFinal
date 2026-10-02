# Signa · Lo que falta para producción

La app funciona completa con datos de demostración y simuladores. Para usarla de verdad faltan estas piezas. Cada una tiene un único punto de entrada en el código, así que conectarla no cambia el resto.

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
- **Cron cada minuto**: el plan gratuito de Vercel solo permite crons diarios. Opciones:
  - Vercel Pro (cron `* * * * *` en `vercel.json`), o
  - un cron externo (cron-job.org, GitHub Actions) que llame cada minuto a
    `POST https://<dominio>/api/posiciones` con `Authorization: Bearer <CRON_SECRET>`.
  - Mientras tanto, el mapa pide posiciones nuevas al abrirse (como máximo una vez por minuto).
- Revisar con datos reales: radio de las geocercas (`radioGeocercaM`, 200 m por defecto), horario laboral de la alerta "fuera de horario" (L–V 7 a 19, S 7 a 13).

## 3. Almacenamiento de fotos

- **Qué hay hoy**: remitos, tickets, documentos y fotos de herramientas se comprimen en el teléfono (~200 KB) y se guardan en Postgres (tabla `Archivo`), servidos con sesión en `/api/archivos/[id]`.
- **Para producción**: con el volumen real, pasar a almacenamiento de objetos (Vercel Blob privado, S3 o R2). El cambio está en un solo lugar: `src/lib/archivos.ts` (`guardarArchivo`) y la ruta que los sirve. Migrar los existentes con un script.

## 4. Canal de avisos por WhatsApp

- **Qué hay hoy**: las alertas viven en la app (bandeja `/alertas` y campana con contador), por rol.
- **Qué falta**: elegir proveedor (WhatsApp Business API vía Meta, Twilio o similar), número de la empresa aprobado y plantillas de mensaje aprobadas por Meta.
- **Dónde va**: al crear o reabrir una alerta crítica en `src/lib/alertas/index.ts` (`evaluarAlertas`), avisar a quien corresponda (el mismo alcance que la bandeja). También: "Tu pedido lo tomó Claudio", "Claudio llegó a la obra".
- Cuidar no repetir avisos: la `claveUnica` de la alerta ya evita duplicados.

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
