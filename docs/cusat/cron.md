# Cron de Cusat: sincronizar cada minuto

La ruta `/api/cusat/sincronizar` pide las posiciones a Cusat y las guarda. Tiene que correr cada
minuto. Está protegida con `CRON_SECRET`: sin el header correcto responde 401.

## Opción 1 · Vercel Cron (ya configurado)

`vercel.json` tiene `{ "path": "/api/cusat/sincronizar", "schedule": "* * * * *" }`. Vercel la llama
con `Authorization: Bearer <CRON_SECRET>` automáticamente. Cada minuto requiere el plan **Pro** de
Vercel. El cron de `/api/jobs/eta`, que también corre cada minuto, ya se verificó en producción.
Para ver que corre: Vercel → proyecto → Settings → Cron Jobs → `/api/cusat/sincronizar` → View Logs.

## Opción 2 · cron-job.org (gratis, si el plan de Vercel no permite cada minuto)

1. Crear una cuenta en https://cron-job.org.
2. **Create cronjob**:
   - Title: `SIGNA · Cusat`
   - URL: `https://signa-final.vercel.app/api/cusat/sincronizar`
   - Execution schedule: **Every minute**.
3. **Advanced**:
   - Request method: **POST**
   - Headers → Add: `Authorization` = `Bearer <CRON_SECRET>` (el valor está en Vercel → Settings →
     Environment Variables → `CRON_SECRET`).
   - Timeout: 30 s.
   - Treat redirects with HTTP 3xx as success: no.
4. Guardar y tocar **Test run**: tiene que responder `200` con `{"ok":true, "recibidas": 15, ...}`.
   Un `401` es el header mal copiado; un `502` es Cusat que no respondió (el detalle viene en el JSON).
5. Si se usa cron-job.org, sacar la línea de `/api/cusat/sincronizar` de `vercel.json` para no
   sincronizar dos veces (no rompe nada, pero duplica llamadas a Cusat).

## Cómo se ve que funciona

`/configuracion/rastreo` muestra "Última sincronización: hace 40 seg". Si pasan más de 5 minutos,
aparece un aviso amarillo arriba: el cron dejó de correr.

Aunque el cron no corra, mientras alguien mira el mapa o sigue un viaje la app sincroniza cada 20 s.
