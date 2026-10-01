import { NextResponse } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth/usuario-actual";
import { puede } from "@/lib/permisos";
import { datosMapa } from "@/lib/datos/mapa";

export const dynamic = "force-dynamic";

export async function GET() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (!puede(usuario.rol, "mapa.ver")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  return NextResponse.json(await datosMapa(), { headers: { "Cache-Control": "no-store" } });
}
