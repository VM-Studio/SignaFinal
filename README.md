# Signa · Logística

App interna de Signa Desarrollos para pedidos de viaje, choferes, flota, costos por obra, depósito de herramientas, mapa en vivo y alertas. Las reglas de diseño y de dominio están en `CLAUDE.md`.

Stack: Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Prisma 6 + Postgres · PWA.

## Correr en local

```bash
cp .env.example .env        # completar DATABASE_URL y AUTH_SECRET
npm install
npx prisma migrate deploy   # crea las tablas
npm run db:seed             # datos de demo + primera evaluación de alertas
npm run dev                 # http://localhost:3000
```

Usuarios de demo: aparecen en el login cuando `MODO_DEMO="true"` (contraseña `signa2026`).

## Variables de entorno

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Postgres |
| `AUTH_SECRET` | Firma de la sesión (32+ caracteres al azar) |
| `APP_URL` | URL pública (links de las etiquetas QR) |
| `CRON_SECRET` | Token de `/api/posiciones` y `/api/alertas/evaluar` (`Authorization: Bearer …`) |
| `MODO_DEMO` | `"true"`: franja de demo, usuarios en el login, botón *Reiniciar datos de demo* |
| `SIMULADOR_ACELERAR` | Multiplicador de velocidad del simulador de Cusat (ej. `"10"` para demos) |
| `CUSAT_API_URL`, `CUSAT_API_KEY` | API real de Cusat. Sin ellas se usa el simulador |

## Tareas programadas

- `POST /api/posiciones`: trae posiciones de Cusat, aplica geocercas (llegada y salida automáticas) y reevalúa alertas. Pensado **cada minuto**.
- `POST /api/alertas/evaluar`: evalúa todas las reglas de alertas.

`vercel.json` las agenda una vez por día (límite del plan Hobby). Para cada minuto, usar Vercel Pro o un cron externo con el token. Además, el mapa pide posiciones al abrirse (como máximo una vez por minuto) y cada acción reevalúa las alertas de su módulo.

## Scripts

`npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm run db:seed`

## Documentación

- `docs/demo.md`: guion de demo de 8 minutos.
- `docs/pendientes.md`: lo que falta para producción (Lebane, Cusat, fotos, WhatsApp, carga real).
- `docs/verificacion-celular.md`: lista de prueba en un celular real.

## Estructura

```
prisma/            schema, migraciones (con reglas CHECK y auditoría inmutable), seed
src/app/           rutas (login, splash, (app)/…, api/…)
src/components/    ui, layout, pedidos, viajes, flota, herramientas, mapa
src/lib/           acciones y consultas por módulo, permisos, alertas, cusat, offline, demo
public/            íconos, pantallas de inicio iOS, service worker
```
