import QRCode from "qrcode";
import { NextResponse, type NextRequest } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth/usuario-actual";

/** QR de un ítem del depósito. Apunta a /d/<código>: con cualquier cámara abre su ficha. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  if (!(await obtenerUsuarioActual())) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const { codigo } = await params;
  const url = `${req.nextUrl.origin}/d/${encodeURIComponent(codigo)}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0a0a0a", light: "#ffffff" } });
  return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=86400" } });
}
