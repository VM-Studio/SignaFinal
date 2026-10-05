import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { obtenerSesion } from "@/lib/auth/sesion";
import { modoDemo } from "@/lib/demo";
import { cargarDatosDemo } from "@/lib/demo/datos";
import { evaluarAlertas } from "@/lib/alertas";
import { tokenValido } from "@/lib/cron/token";
import { auditar } from "@/lib/auditoria";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Reinicia los datos de demostración. Solo con MODO_DEMO=true.
 * Pueden usarla Dirección o Administración (botón en Mi cuenta) o un cron con el token.
 */
export async function POST(req: NextRequest) {
  if (!modoDemo()) return NextResponse.json({ error: "Solo en modo demo." }, { status: 403 });
  const u = await obtenerSesion();
  const autorizado = tokenValido(req) || (u && (u.rol === "DIRECCION" || u.rol === "ADMINISTRACION"));
  if (!autorizado) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const conteo = await cargarDatosDemo(db);
  const alertas = await evaluarAlertas();
  // Va después de recargar (la recarga vacía la auditoría): queda como primera acción.
  const quien = u ? await db.usuario.findFirst({ where: { email: u.email }, select: { id: true } }) : null;
  await auditar(db, { usuarioId: quien?.id ?? null, accion: "demo.reiniciar", entidad: "Sistema", entidadId: "demo", resumen: `${u?.nombre ?? "El cron"} reinició los datos de demostración` });
  return NextResponse.json({ ok: true, ...conteo, alertas: alertas.activas });
}
