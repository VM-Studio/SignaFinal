import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth/sesion";
import { buscarDireccion } from "@/lib/geo/buscar";

/** Sugerencias de direcciones para SelectorDireccion (con sesión; caché y 1 consulta por segundo a Nominatim). */
export async function GET(req: Request) {
  if (!(await obtenerSesion())) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.slice(0, 200) ?? "";
  const candidatos = await buscarDireccion(q);
  return NextResponse.json({ candidatos });
}
