# SignaFinal · SIGNA Logística

App interna de Signa Desarrollos: cola única de pedidos de viaje, flota, viajes con costo por obra, mapa en vivo (Cusat), depósito de maquinaria y herramientas, y alertas. Ver `CLAUDE.md` para el contexto completo.

## Stack
Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · PostgreSQL + Prisma 6 · Zod · JWT (jose) + bcryptjs · Leaflet/OSM · PWA.

## Correr en local
```bash
cp .env.example .env   # completar DATABASE_URL, DIRECT_URL, AUTH_SECRET, CRON_SECRET, SEED_PASSWORD
npm install
npm run db:migrate     # aplica migraciones (incluye reglas de negocio en SQL)
npm run db:seed        # carga inicial (solo si la base está vacía)
npm run dev
```

Usuarios de la carga inicial (contraseña = `SEED_PASSWORD`):
`direccion`, `leandro`, `daniela`, `cesar`, `vicky`, `lolo`, `claudio`, `cristian`, `david`, `deposito`, `administracion`.

## Base de datos
- Reglas garantizadas por Postgres (`prisma/migrations/*_reglas_de_negocio`): un solo viaje en curso por chofer y por vehículo, km de llegada ≥ salida, herramienta unitaria en un solo lugar, stock no negativo, auditoría inmodificable.
- Montos en `Decimal`. Envíos sin señal idempotentes por `clientId`.

## Integraciones
- `lib/lebane/`: interfaz + mock (obras, proveedores, órdenes de compra).
- `lib/cusat/`: interfaz + mock que simula movimiento.

## Deploy
Vercel + Neon Postgres. `vercel-build` corre `prisma migrate deploy` antes del build. Cron diario `/api/cron/alertas`.
