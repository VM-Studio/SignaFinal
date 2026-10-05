"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirSesion } from "@/lib/auth/sesion";
import { modoDemo } from "@/lib/demo";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { distancia, puntoEn } from "@/lib/geo";
import { ETAPAS_EN_CURSO } from "./etapas";
import { baseDe, destinoDe, origenDe, registrarPosicion, rutaSegura } from "./tramos";

const PASO_M = 1000;

/**
 * Modo demo (solo Dirección): mueve el vehículo 1 km por la ruta del tramo actual, para mostrar
 * el seguimiento en una reunión sin salir a la calle. Pasa por la misma lógica que el GPS real.
 */
export async function avanzarSimulado(pedidoId: string): Promise<Resultado<{ etapa: string; faltaM: number }>> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    if (!modoDemo() || yo.rol !== "DIRECCION") throw new ErrorNegocio("Solo en modo demo, para Dirección.");
    const v = await db.viaje.findFirst({
      where: { pedidoId, etapa: { in: ETAPAS_EN_CURSO } },
      include: { pedido: true, vehiculo: { select: { baseId: true } }, posiciones: { orderBy: { fecha: "desc" }, take: 1 } },
    });
    if (!v) throw new ErrorNegocio("Este viaje no está en curso.");
    const ultima = v.posiciones[0] ? { lat: v.posiciones[0].latitud, lng: v.posiciones[0].longitud } : null;
    // Cargando: arranca desde el punto de retiro hacia la obra (al alejarse, el viaje pasa solo a "en camino").
    const desde = v.etapa === "EN_RETIRO" ? origenDe(v.pedido) : ultima ?? (await baseDe(v.vehiculo)) ?? origenDe(v.pedido);
    const hasta = v.etapa === "HACIA_RETIRO" ? origenDe(v.pedido) : destinoDe(v.pedido);
    const ruta = await rutaSegura(desde, hasta);
    const linea = ruta.geometria.map(([lat, lng]) => ({ lat, lng }));
    const punto = ruta.distanciaM <= PASO_M ? hasta : puntoEn(linea, PASO_M).punto;
    const r = await registrarPosicion(v.id, punto, { fuente: "MOCK", velocidadKmh: 32 });
    revalidatePath("/", "layout");
    return { etapa: r?.etapa ?? v.etapa, faltaM: Math.round(distancia(punto, hasta)) };
  });
}
