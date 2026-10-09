import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth/sesion";
import { estadoAvisos } from "@/lib/avisos/estado";

export const dynamic = "force-dynamic";

/** Respaldo de la campana si el stream no anda (proxy, red mala): polling cada 15 s. */
export async function GET() {
  const u = await obtenerSesion();
  if (!u) return NextResponse.json({ n: 0 }, { status: 401 });
  return NextResponse.json(await estadoAvisos(u), { headers: { "Cache-Control": "no-store" } });
}
