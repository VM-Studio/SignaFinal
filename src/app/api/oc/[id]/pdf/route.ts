import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { obtenerSesion } from "@/lib/auth/sesion";
import { eliminar, subir } from "@/lib/archivos";
import { puedeVerDocumento } from "@/lib/compras/acceso";
import { generarPDF } from "@/lib/compras/pdf-generar";
import { baseURL } from "@/lib/compras/pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * "Imprimir / PDF": el documento tal cual está ahora (la plantilla impresa; con la factura como segunda
 * página si hay). Lo ve todo el que ve el documento. La cabecera X-PDF-Motor dice con qué se generó.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await obtenerSesion();
  if (!u) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const id = (await params).id;
  const d = await db.ordenCompra.findUnique({ where: { id }, select: { creadaPorId: true, solicitanteId: true, obraId: true } });
  if (!d || !(await puedeVerDocumento(u, d))) return NextResponse.json({ error: "No existe" }, { status: 404 });
  const { pdf, motor, nombre } = await generarPDF(id, await baseURL());
  const url = new URL(req.url);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf", "Cache-Control": "private, no-store", "X-PDF-Motor": motor,
      "Content-Disposition": `${url.searchParams.get("descargar") === "1" ? "attachment" : "inline"}; filename="${nombre}"`,
    },
  });
}

/** Interno (lo llama guardarPDF después de enviar o autorizar): genera y guarda el PDF del momento. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const secreto = process.env.CRON_SECRET ?? process.env.AUTH_SECRET;
  if (!secreto || req.headers.get("x-interno") !== secreto) return NextResponse.json({ error: "No" }, { status: 403 });
  const id = (await params).id;
  const { autorizada } = (await req.json().catch(() => ({}))) as { autorizada?: boolean };
  const d = await db.ordenCompra.findUnique({ where: { id }, select: { creadaPorId: true, pdfUrl: true, pdfAprobadaUrl: true } });
  if (!d) return NextResponse.json({ error: "No existe" }, { status: 404 });
  const { pdf, motor, nombre } = await generarPDF(id, await baseURL());
  const r = await subir({ nombre: autorizada ? nombre.replace(/\.pdf$/, "-autorizada.pdf") : nombre, tipo: "application/pdf", datos: Buffer.from(pdf) }, "ordenes-compra", d.creadaPorId);
  const anterior = autorizada ? d.pdfAprobadaUrl : d.pdfUrl;
  await db.ordenCompra.update({ where: { id }, data: autorizada ? { pdfAprobadaUrl: r.url } : { pdfUrl: r.url } });
  if (anterior && anterior !== r.url) await eliminar(anterior).catch(() => {});
  return NextResponse.json({ ok: true, motor });
}
