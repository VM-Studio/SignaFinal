import { NextResponse, type NextRequest } from "next/server";
import { revalidar } from "@/lib/revalidar";
import { z } from "zod";
import { db } from "@/lib/db";
import { obtenerSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { ETAPAS_EN_CURSO } from "@/lib/viajes/etapas";
import { registrarPosicion } from "@/lib/viajes/tramos";

export const dynamic = "force-dynamic";

const esquema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  precisionM: z.number().min(0).optional(),
  velocidadMs: z.number().min(0).nullable().optional(),
  rumbo: z.number().nullable().optional(),
});

/**
 * Posición del teléfono del chofer durante el viaje (cada 30 s o 200 m).
 * Guarda la posición, recalcula la hora estimada del tramo y, si se alejó del punto de retiro,
 * pasa el viaje a "en camino a la obra".
 */
export async function POST(req: NextRequest) {
  const u = await obtenerSesion();
  if (!u || !puede(u.rol, "viajes.ejecutar")) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const d = esquema.safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json({ error: "Posición inválida" }, { status: 400 });

  const v = await db.viaje.findFirst({ where: { choferId: u.id, etapa: { in: ETAPAS_EN_CURSO } }, select: { id: true } });
  if (!v) return NextResponse.json({ enViaje: false });
  const r = await registrarPosicion(v.id, { lat: d.data.lat, lng: d.data.lng }, {
    fuente: "TELEFONO", usuarioId: u.id, precisionM: d.data.precisionM, velocidadKmh: d.data.velocidadMs ? d.data.velocidadMs * 3.6 : 0, rumbo: d.data.rumbo ?? 0,
  });
  if (r?.cambioDeEtapa) revalidar("pedidos");
  return NextResponse.json({ enViaje: true, etapa: r?.etapa ?? null, eta: r?.eta?.toISOString() ?? null, cambioDeEtapa: r?.cambioDeEtapa ?? false });
}
