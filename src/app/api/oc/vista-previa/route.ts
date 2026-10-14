import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { esquemaOC } from "@/lib/compras/esquema";
import { pdfVistaPrevia } from "@/lib/compras/servicio";

/** "Vista previa PDF": lo genera con lo que hay en la plantilla, con marca BORRADOR y sin número. */
export async function POST(req: Request) {
  const u = await obtenerSesion();
  if (!u || !puede(u.rol, "materiales.gestionar")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const d = esquemaOC.safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json({ error: d.error.issues[0]?.message ?? "Datos incompletos" }, { status: 400 });
  const pdf = await pdfVistaPrevia(d.data, u.nombre);
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" } });
}
