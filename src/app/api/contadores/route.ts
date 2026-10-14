import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth/sesion";
import { contadoresNav } from "@/lib/contadores";

export const dynamic = "force-dynamic";

/** Los contadores de la barra del usuario (los vuelve a pedir el tiempo real cuando algo cambia). */
export async function GET() {
  const u = await obtenerSesion();
  if (!u) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  return NextResponse.json(await contadoresNav(u), { headers: { "Cache-Control": "no-store" } });
}
