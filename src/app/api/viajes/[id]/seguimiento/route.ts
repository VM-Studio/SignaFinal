import { NextResponse, type NextRequest } from "next/server";
import { obtenerSesion } from "@/lib/auth/sesion";
import { seguimiento } from "@/lib/viajes/seguimiento";

export const dynamic = "force-dynamic";

/** Seguimiento en vivo (polling cada 20 s): etapa, última posición, distancia restante y hora estimada. [id] = pedido. */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await obtenerSesion();
  if (!u) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const d = await seguimiento(u, (await params).id);
  if (!d) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(d, { headers: { "Cache-Control": "no-store" } });
}
