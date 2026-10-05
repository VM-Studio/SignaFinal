import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { obtenerSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { distancia } from "@/lib/geo";
import { ETAPAS_EN_CURSO } from "@/lib/viajes/etapas";
import { CARGA_S, destinoDe, origenDe, rutaSegura, SALIDA_RETIRO_M, salirDelRetiro } from "@/lib/viajes/tramos";

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

  const v = await db.viaje.findFirst({ where: { choferId: u.id, etapa: { in: ETAPAS_EN_CURSO } }, include: { pedido: true } });
  if (!v) return NextResponse.json({ enViaje: false });

  const aqui = { lat: d.data.lat, lng: d.data.lng };
  const ahora = new Date();
  await db.posicionVehiculo.create({
    data: {
      vehiculoId: v.vehiculoId, viajeId: v.id, usuarioId: u.id, fuente: "TELEFONO", latitud: aqui.lat, longitud: aqui.lng,
      precisionM: d.data.precisionM ?? null, velocidad: d.data.velocidadMs ? d.data.velocidadMs * 3.6 : 0, rumbo: d.data.rumbo ?? 0, motorEncendido: true, fecha: ahora,
    },
  });

  let etapa = v.etapa;
  // Se fue del punto de retiro sin tocar "Salgo": lo hace el GPS.
  if (etapa === "EN_RETIRO" && distancia(aqui, origenDe(v.pedido)) > SALIDA_RETIRO_M) {
    await db.$transaction((tx) => salirDelRetiro(tx, v.id, ahora, true, null));
    etapa = "HACIA_DESTINO";
  }

  let eta: Date | null = null;
  if (etapa === "HACIA_RETIRO") {
    const [aRetiro, aDestino] = await Promise.all([rutaSegura(aqui, origenDe(v.pedido)), rutaSegura(origenDe(v.pedido), destinoDe(v.pedido))]);
    eta = new Date(ahora.getTime() + aRetiro.duracionS * 1000);
    await db.viaje.update({ where: { id: v.id }, data: { etaRetiro: eta, etaDestino: new Date(eta.getTime() + (CARGA_S + aDestino.duracionS) * 1000) } });
  } else if (etapa === "HACIA_DESTINO") {
    const aDestino = await rutaSegura(aqui, destinoDe(v.pedido));
    eta = new Date(ahora.getTime() + aDestino.duracionS * 1000);
    await db.viaje.update({ where: { id: v.id }, data: { etaDestino: eta } });
  }
  if (etapa !== v.etapa) revalidatePath("/", "layout");
  return NextResponse.json({ enViaje: true, etapa, eta: eta?.toISOString() ?? null, cambioDeEtapa: etapa !== v.etapa });
}
