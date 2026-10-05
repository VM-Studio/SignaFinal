import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth/sesion";
import { contarAvisos } from "@/lib/avisos/consultas";

export const dynamic = "force-dynamic";

/** Para la campana (polling cada 30 s). */
export async function GET() {
  if (!(await obtenerSesion())) return NextResponse.json({ avisos: 0 }, { status: 401 });
  return NextResponse.json({ avisos: await contarAvisos() }, { headers: { "Cache-Control": "no-store" } });
}
