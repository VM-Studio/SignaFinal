/**
 * Prueba de avisos push de un usuario, sin pasar por la app:
 *   npx tsx scripts/push-probar.ts daniela@signa.demo
 *   DATABASE_URL="..." VAPID_...="..." npx tsx scripts/push-probar.ts daniela@signa.demo   (contra otra base)
 *
 * Lista sus suscripciones (activas e inactivas) con fecha, navegador y servicio de push (Apple,
 * Google o Mozilla), le manda una push de prueba a cada una ACTIVA y muestra el código de
 * respuesta. Cada intento queda en EnvioPush, como los de la app.
 */
import { PrismaClient } from "@prisma/client";
import webpush from "web-push";

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {}
}

const email = process.argv[2];
if (!email) {
  console.error("Uso: npx tsx scripts/push-probar.ts <email>");
  process.exit(1);
}

const servicio = (e: string) => (/apple\.com/.test(e) ? "Apple" : /googleapis|google\.com/.test(e) ? "Google" : /mozilla|mozaws/.test(e) ? "Mozilla" : new URL(e).host);
function equipo(ua: string | null) {
  if (!ua) return "?";
  const so = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Otro";
  const nav = /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "";
  return nav ? `${so} · ${nav}` : so;
}
const fecha = (d: Date | null) => (d ? d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : "—");

async function main() {
  const faltan = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"].filter((k) => !process.env[k]);
  if (faltan.length) throw new Error(`Faltan ${faltan.join(", ")} en el entorno.`);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const db = new PrismaClient();
  try {
    const u = await db.usuario.findUnique({ where: { email }, select: { id: true, nombre: true } });
    if (!u) throw new Error(`No existe el usuario ${email}.`);
    const subs = await db.suscripcionPush.findMany({ where: { usuarioId: u.id }, orderBy: { creadaEn: "desc" } });
    console.log(`\n${u.nombre} (${email}): ${subs.length} suscripción(es)\n`);
    if (!subs.length) console.log("  Ninguna. En el celular: Mi cuenta → Activar avisos.");
    for (const s of subs) {
      console.log(`  ${s.activa ? "ACTIVA  " : "inactiva"} ${equipo(s.userAgent).padEnd(16)} ${servicio(s.endpoint).padEnd(8)} creada ${fecha(s.creadaEn)} · último envío ${fecha(s.ultimoEnvioEn)} (${s.ultimoEnvioEstado ?? "—"}) · recibida ${fecha(s.ultimaRecepcionEn)}`);
    }
    const hora = new Date().toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
    for (const s of subs.filter((x) => x.activa)) {
      const t = Date.now();
      try {
        const r = await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ titulo: "Prueba de SIGNA", cuerpo: `Para ${u.nombre}, enviada a las ${hora} desde el script.`, url: "/cuenta", enlace: "/cuenta", tag: `prueba-${t}` }),
          { TTL: 3600, urgency: "high", timeout: 5000 },
        );
        console.log(`\n  → ${equipo(s.userAgent)} (${servicio(s.endpoint)}): ${r.statusCode} aceptada en ${Date.now() - t} ms`);
        await db.envioPush.create({ data: { usuarioId: u.id, suscripcionId: s.id, tipo: "PRUEBA", estado: "ENVIADA", codigoRespuesta: r.statusCode } });
        await db.suscripcionPush.update({ where: { id: s.id }, data: { ultimoEnvioEn: new Date(), ultimoEnvioEstado: `aceptada (${r.statusCode})` } });
      } catch (e) {
        const x = e as { statusCode?: number; body?: string; message?: string };
        console.log(`\n  → ${equipo(s.userAgent)} (${servicio(s.endpoint)}): FALLÓ ${x.statusCode ?? "sin respuesta"} ${x.body ?? x.message ?? ""}`);
        await db.envioPush.create({ data: { usuarioId: u.id, suscripcionId: s.id, tipo: "PRUEBA", estado: "FALLIDA", codigoRespuesta: x.statusCode ?? null, error: String(x.body ?? x.message ?? "").slice(0, 200) } });
        if (x.statusCode === 404 || x.statusCode === 410) {
          await db.suscripcionPush.update({ where: { id: s.id }, data: { activa: false } });
          console.log("    La suscripción venció: se desactivó. En el celular: Mi cuenta → Activar avisos.");
        }
      }
    }
    console.log("");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
