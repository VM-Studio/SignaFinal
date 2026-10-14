import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { obtenerSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { leer } from "@/lib/archivos";
import { pdfDeOC } from "@/lib/compras/servicio";

/**
 * PDF de una orden (OC o PE). ?aprobada=1: el que lleva el sello (si ya está aprobada). Lo ven Compras,
 * el dueño y Administración (lleva importes: la gente de obra no).
 * Se sirve el guardado; si no está (almacenamiento caído), se genera en el momento desde los datos.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await obtenerSesion();
  if (!u) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const oc = await db.ordenCompra.findUnique({ where: { id: (await params).id }, select: { id: true, numero: true, estado: true, fuente: true, versionAprobacion: true, pdfUrl: true, pdfAprobadaUrl: true } });
  if (!oc) return NextResponse.json({ error: "No existe" }, { status: 404 });
  const url = new URL(req.url);
  const aprobada = url.searchParams.get("aprobada") === "1" && oc.estado === "APROBADA";
  const ve = puede(u.rol, "materiales.gestionar") || puede(u.rol, "materiales.aprobar") || u.rol === "ADMINISTRACION";
  if (!ve) return NextResponse.json({ error: "No existe" }, { status: 404 });

  const guardado = aprobada ? oc.pdfAprobadaUrl : oc.pdfUrl;
  const archivo = guardado ? await leer(guardado) : null;
  const cuerpo = archivo ? (archivo.datos as BodyInit) : new Uint8Array((await pdfDeOC(oc.id, aprobada)).pdf);
  const nombre = `${oc.numero ?? "borrador"}${oc.versionAprobacion > 1 ? `-v${oc.versionAprobacion}` : ""}${aprobada ? "-aprobada" : ""}.pdf`;
  return new NextResponse(cuerpo, {
    headers: { "Content-Type": "application/pdf", "Cache-Control": "private, no-store", "Content-Disposition": `${url.searchParams.get("descargar") === "1" ? "attachment" : "inline"}; filename="${nombre}"` },
  });
}
