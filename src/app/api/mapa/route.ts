import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { datosMapa } from "@/lib/mapa/consultas";

export const dynamic = "force-dynamic";

/** Lo pide el mapa cada 30 segundos. */
export async function GET() {
  const u = await obtenerSesion();
  if (!u) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (!puede(u.rol, "mapa.ver")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  return NextResponse.json(await datosMapa(), { headers: { "Cache-Control": "no-store" } });
}
