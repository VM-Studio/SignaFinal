import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { obtenerSesion } from "@/lib/auth/sesion";
import { eliminar, leer } from "@/lib/archivos";
import { puedeVer } from "@/lib/adjuntos/permisos";

/** Sirve un adjunto solo a quien lo puede ver. ?descargar=1 lo baja en vez de abrirlo. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await obtenerSesion();
  if (!u) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const a = await db.adjunto.findUnique({ where: { id: (await params).id } });
  if (!a || !(await puedeVer(u, a))) return NextResponse.json({ error: "No existe" }, { status: 404 });
  const r = await leer(a.url);
  if (!r) return NextResponse.json({ error: "El archivo no está disponible." }, { status: 404 });
  const descargar = new URL(req.url).searchParams.get("descargar") === "1";
  const nombre = encodeURIComponent(a.nombre);
  return new NextResponse(r.datos as BodyInit, {
    headers: {
      "Content-Type": a.tipoMime,
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename*=UTF-8''${nombre}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Quitar un archivo recién subido que todavía no se enganchó a nada (el formulario no se confirmó). */
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await obtenerSesion();
  if (!u) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const a = await db.adjunto.findUnique({ where: { id: (await params).id } });
  if (!a || a.subidoPorId !== u.id || a.entidadId) return NextResponse.json({ error: "No se puede quitar" }, { status: 400 });
  await db.adjunto.delete({ where: { id: a.id } });
  await eliminar(a.url);
  return NextResponse.json({ ok: true });
}
