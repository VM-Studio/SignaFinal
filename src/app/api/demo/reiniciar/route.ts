import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { obtenerSesion } from "@/lib/auth/sesion";
import { modoDemo } from "@/lib/demo";
import { cargarDatosBase } from "@/lib/base/datos";
import { tokenValido } from "@/lib/cron/token";
import { auditar } from "@/lib/auditoria";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Deja solo los datos base (usuarios, vehículos, herramientas en el depósito) y borra todo lo
 * demás. Solo con MODO_DEMO=true. Dirección o Administración (botón en Mi cuenta) o con el token.
 */
export async function POST(req: NextRequest) {
  if (!modoDemo()) return NextResponse.json({ error: "Solo en modo demo." }, { status: 403 });
  const u = await obtenerSesion();
  const autorizado = tokenValido(req) || (u && (u.rol === "DIRECCION" || u.rol === "ADMINISTRACION"));
  if (!autorizado) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const conteo = await cargarDatosBase(db);
  // Va después de recargar (la recarga vacía la auditoría): queda como primera acción.
  const quien = u ? await db.usuario.findFirst({ where: { email: u.email }, select: { id: true } }) : null;
  await auditar(db, { usuarioId: quien?.id ?? null, accion: "demo.reiniciar", entidad: "Sistema", entidadId: "demo", resumen: `${u?.nombre ?? "Alguien con el token"} dejó solo los datos base (borró obras, pedidos y todo lo cargado)` });
  return NextResponse.json({ ok: true, ...conteo });
}
