import { NextResponse, type NextRequest } from "next/server";
import { obtenerSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { recorridoDelDia } from "@/lib/mapa/consultas";
import { diaISO } from "@/lib/formato";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const u = await obtenerSesion();
  if (!u) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (!puede(u.rol, "mapa.ver")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const vehiculo = req.nextUrl.searchParams.get("vehiculo");
  const dia = req.nextUrl.searchParams.get("dia") ?? diaISO();
  if (!vehiculo || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  return NextResponse.json(await recorridoDelDia(vehiculo, dia), { headers: { "Cache-Control": "no-store" } });
}
