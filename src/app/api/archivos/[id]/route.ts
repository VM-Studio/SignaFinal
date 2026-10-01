import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { obtenerSesion } from "@/lib/auth/sesion";

/** Sirve fotos y documentos solo a quien tiene sesión. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await obtenerSesion())) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const a = await db.archivo.findUnique({ where: { id: (await params).id } });
  if (!a) return NextResponse.json({ error: "No existe" }, { status: 404 });
  return new NextResponse(new Uint8Array(a.datos), {
    headers: { "Content-Type": a.tipo, "Cache-Control": "private, max-age=31536000, immutable", "Content-Disposition": `inline; filename="${a.nombre ?? a.id}"` },
  });
}
