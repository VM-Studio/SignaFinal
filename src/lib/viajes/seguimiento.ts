import "server-only";
import type { EtapaViaje } from "@prisma/client";
import { db } from "@/lib/db";
import type { UsuarioSesion } from "@/lib/auth/sesion";
import { conAlcance } from "@/lib/alcance";
import { hora } from "@/lib/formato";
import { metros } from "@/lib/rutas";
import { destinoDe, origenDe, rutaSegura } from "./tramos";

export type DatosSeguimiento = {
  etapa: EtapaViaje | null;
  estado: string;
  chofer: { nombre: string; telefono: string | null } | null;
  vehiculo: string | null;
  pasos: { pedido: string; aceptado: string | null; retiro: string | null; entregado: string | null };
  retiro: { nombre: string; lat: number; lng: number };
  destino: { nombre: string; lat: number; lng: number };
  /** Última posición del vehículo en este viaje (sin posiciones: sin mapa, solo el texto). */
  posicion: { lat: number; lng: number; fecha: string } | null;
  ruta: [number, number][] | null;
  distanciaM: number | null;
  eta: string | null;
  /** UNA frase grande: "Claudio está a 6 km, llega 9:40 aprox." */
  frase: string;
};

/**
 * Seguimiento en vivo de un pedido para quien lo puede ver: etapa, dónde está el vehículo,
 * cuánto le falta y a qué hora llega. Null si no existe o no le corresponde.
 */
export async function seguimiento(u: Pick<UsuarioSesion, "id" | "rol">, pedidoId: string): Promise<DatosSeguimiento | null> {
  const p = await db.pedidoViaje.findFirst({
    where: conAlcance(u, { id: pedidoId }),
    include: {
      tomadoPor: { select: { nombre: true, telefono: true } },
      viaje: { include: { vehiculo: { select: { nombre: true } }, posiciones: { orderBy: { fecha: "desc" }, take: 1 } } },
    },
  });
  if (!p) return null;
  const v = p.viaje && p.viaje.estado !== "CANCELADO" && p.estado !== "PENDIENTE" ? p.viaje : null;
  const etapa = v?.etapa ?? null;
  const pos = v?.posiciones[0] ?? null;
  const aqui = pos ? { lat: pos.latitud, lng: pos.longitud } : null;
  const enCamino = etapa === "HACIA_RETIRO" || etapa === "HACIA_DESTINO";
  const hacia = etapa === "HACIA_RETIRO" ? origenDe(p) : destinoDe(p);
  const ruta = aqui && enCamino ? await rutaSegura(aqui, hacia) : null;
  const eta = etapa === "HACIA_RETIRO" ? v?.etaRetiro : etapa === "EN_RETIRO" || etapa === "HACIA_DESTINO" ? v?.etaDestino : null;
  const chofer = p.tomadoPor?.nombre ?? "El chofer";
  const llego = v?.llegadaDestinoEn ?? v?.llegadaReal ?? null;

  let frase: string;
  if (p.estado === "CANCELADO") frase = "Pedido cancelado.";
  else if (p.estado === "PENDIENTE") frase = "Pendiente, lo ven los choferes.";
  else if (p.estado === "ENTREGADO" || etapa === "FINALIZADO") frase = llego ? `Entregado ${hora(llego)}.` : "Entregado.";
  else if (etapa === "PROGRAMADO") frase = v?.salidaEstimada ? `${chofer} lo aceptó. Sale ${hora(v.salidaEstimada)} aprox.` : `${chofer} lo aceptó.`;
  else if (etapa === "EN_RETIRO") frase = `${chofer} está cargando en ${p.origenNombre}.`;
  else if (etapa === "HACIA_RETIRO") frase = `${chofer} va a ${p.origenNombre}${ruta ? `, está a ${metros(ruta.distanciaM)}` : ""}${eta ? `. Llega a ${p.destinoNombre} ${hora(v!.etaDestino ?? eta)} aprox.` : "."}`;
  else if (ruta && ruta.distanciaM < 200) frase = `${chofer} está llegando a ${p.destinoNombre}.`;
  else frase = `${chofer} está ${ruta ? `a ${metros(ruta.distanciaM)}` : "en camino"}${eta ? `, llega ${hora(eta)} aprox.` : "."}`;

  return {
    etapa, estado: p.estado,
    chofer: p.tomadoPor ? { nombre: p.tomadoPor.nombre, telefono: p.tomadoPor.telefono } : null,
    vehiculo: v?.vehiculo.nombre ?? null,
    pasos: {
      pedido: p.creadoEn.toISOString(),
      aceptado: p.tomadoEn?.toISOString() ?? null,
      retiro: (v?.llegadaRetiroEn ?? v?.salidaRetiroEn)?.toISOString() ?? null,
      entregado: p.estado === "ENTREGADO" && llego ? llego.toISOString() : null,
    },
    retiro: { nombre: p.origenNombre, ...origenDe(p) },
    destino: { nombre: p.destinoNombre, ...destinoDe(p) },
    posicion: pos && aqui ? { ...aqui, fecha: pos.fecha.toISOString() } : null,
    ruta: ruta?.geometria ?? null,
    distanciaM: ruta?.distanciaM ?? null,
    eta: eta?.toISOString() ?? null,
    frase,
  };
}
