import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { obtenerSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { esObraDelUsuario } from "@/lib/alcance";
import { leer } from "@/lib/archivos";
import { pdfDeOC } from "@/lib/compras/servicio";

/**
 * PDF de una orden de compra. ?aprobada=1: el que lleva el sello (si ya está aprobada). Compras y el
 * dueño ven cualquiera; el que pidió (y los responsables de su obra), solo el aprobado.
 * Se sirve el guardado; si no está (almacenamiento caído), se genera en el momento desde los datos.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await obtenerSesion();
  if (!u) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const oc = await db.ordenCompra.findUnique({ where: { id: (await params).id }, select: { id: true, numero: true, estado: true, obraId: true, pdfUrl: true, pdfAprobadaUrl: true } });
  if (!oc) return NextResponse.json({ error: "No existe" }, { status: 404 });
  const url = new URL(req.url);
  const aprobada = url.searchParams.get("aprobada") === "1" && oc.estado === "APROBADA";
  const gestiona = puede(u.rol, "materiales.gestionar") || puede(u.rol, "materiales.aprobar");
  const deLaObra = aprobada && puede(u.rol, "materiales.pedir") && (await esObraDelUsuario(u, oc.obraId));
  if (!gestiona && !deLaObra) return NextResponse.json({ error: "No existe" }, { status: 404 });

  const guardado = aprobada ? oc.pdfAprobadaUrl : oc.pdfUrl;
  const archivo = guardado ? await leer(guardado) : null;
  const cuerpo = archivo ? (archivo.datos as BodyInit) : new Uint8Array((await pdfDeOC(oc.id, aprobada)).pdf);
  const nombre = `${oc.numero ?? "OC-borrador"}${aprobada ? "-aprobada" : ""}.pdf`;
  return new NextResponse(cuerpo, {
    headers: { "Content-Type": "application/pdf", "Cache-Control": "private, no-store", "Content-Disposition": `${url.searchParams.get("descargar") === "1" ? "attachment" : "inline"}; filename="${nombre}"` },
  });
}
