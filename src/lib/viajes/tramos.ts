import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { calcularRuta, rutaEstimada, type Ruta } from "@/lib/rutas";
import { auditar } from "@/lib/auditoria";
import { conEtapa } from "./etapas";
import type { Punto } from "@/lib/geo";

/** Lo que se tarda en cargar en el punto de retiro (para estimar la llegada a la obra). */
export const CARGA_S = 20 * 60;
/** El GPS da por salido del retiro cuando se aleja más que esto. */
export const SALIDA_RETIRO_M = 300;

export const origenDe = (p: { origenLat: number; origenLng: number }): Punto => ({ lat: p.origenLat, lng: p.origenLng });
export const destinoDe = (p: { destinoLat: number; destinoLng: number }): Punto => ({ lat: p.destinoLat, lng: p.destinoLng });

/** De dónde sale el vehículo si no hay GPS: su base, o la base general. */
export async function baseDe(vehiculo: { baseId: string | null }): Promise<Punto | null> {
  const b = vehiculo.baseId ? await db.ubicacion.findUnique({ where: { id: vehiculo.baseId } }) : await db.ubicacion.findFirst({ where: { tipo: "BASE_VEHICULOS" } });
  return b ? { lat: b.latitud, lng: b.longitud } : null;
}

/** Ruta sin que nada la pueda trabar: si el ruteo falla, la estimada. */
export async function rutaSegura(desde: Punto, hasta: Punto): Promise<Ruta> {
  try {
    return await calcularRuta(desde, hasta);
  } catch {
    return rutaEstimada(desde, hasta);
  }
}

const sumar = (d: Date, s: number) => new Date(d.getTime() + s * 1000);

/** Pasa el viaje de "cargando" a "en camino a la obra" (botón "Salgo" o el GPS al alejarse). */
export async function salirDelRetiro(cliente: Prisma.TransactionClient, viajeId: string, cuando: Date, porGps: boolean, usuarioId: string | null) {
  const v = await cliente.viaje.findUnique({ where: { id: viajeId }, include: { chofer: { select: { nombre: true } }, pedido: { select: { id: true, numero: true, origenNombre: true } } } });
  if (!v || v.etapa !== "EN_RETIRO") return false;
  await cliente.viaje.update({
    where: { id: viajeId },
    data: { ...conEtapa("HACIA_DESTINO"), salidaRetiroEn: cuando, etaDestino: v.duracionDestinoS ? sumar(cuando, v.duracionDestinoS) : v.etaDestino },
  });
  await auditar(cliente, {
    usuarioId, accion: porGps ? "viaje.salidaRetiro.gps" : "viaje.salidaRetiro", entidad: "PedidoViaje", entidadId: v.pedido.id,
    resumen: `${porGps ? "GPS: " : ""}${v.chofer.nombre} salió de ${v.pedido.origenNombre} hacia la obra (pedido #${v.pedido.numero})`,
  });
  return true;
}
