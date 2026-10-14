import { NextResponse } from "next/server";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { dolarActual, FUENTE_DOLAR } from "@/lib/dolar";

export const dynamic = "force-dynamic";

/** La cotización cacheada (15 min del lado del servidor; si dolarapi no responde, el último valor conocido). */
export async function GET() {
  const u = await exigirSesion();
  if (!puede(u.rol, "dolar.ver")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const d = await dolarActual();
  return NextResponse.json({ ...d, fuente: FUENTE_DOLAR }, { headers: { "Cache-Control": "private, max-age=60" } });
}
