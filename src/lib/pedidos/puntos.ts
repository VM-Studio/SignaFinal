import type { OrigenTipo, Prisma, PrismaClient } from "@prisma/client";
import { ErrorNegocio } from "@/lib/resultado";

type Cliente = Prisma.TransactionClient | PrismaClient;

export type Puntos = {
  origenNombre: string;
  origenDireccion: string;
  origenLat: number;
  origenLng: number;
  destinoNombre: string;
  destinoDireccion: string;
  destinoLat: number;
  destinoLng: number;
};

/**
 * Resuelve de dónde sale y a dónde va un pedido (nombre, dirección y coordenadas) para
 * guardarlo en el pedido: así el chofer y el mapa nunca tienen que buscarlo.
 * Falla con un mensaje claro si el origen no existe o no es del tipo indicado.
 */
export async function resolverPuntos(cliente: Cliente, d: { origenTipo: OrigenTipo; origenId: string; obraId: string }): Promise<Puntos> {
  const [origen, destino] = await Promise.all([
    d.origenTipo === "PROVEEDOR"
      ? cliente.proveedor.findUnique({ where: { id: d.origenId } }).then((x) => x && { nombre: x.nombre, direccion: `${x.direccion}, ${x.localidad}`, lat: x.latitud, lng: x.longitud })
      : d.origenTipo === "OBRA"
        ? cliente.obra.findFirst({ where: { id: d.origenId, estado: "ACTIVA" } }).then((x) => x && { nombre: `Obra ${x.nombre}`, direccion: `${x.direccion}, ${x.localidad}`, lat: x.latitud, lng: x.longitud })
        : cliente.ubicacion
            .findFirst({ where: { id: d.origenId, tipo: d.origenTipo === "BASE" ? "BASE_VEHICULOS" : "DEPOSITO" } })
            .then((x) => x && { nombre: x.nombre, direccion: x.direccion, lat: x.latitud, lng: x.longitud }),
    cliente.obra.findUnique({ where: { id: d.obraId } }),
  ]);
  if (!origen) throw new ErrorNegocio("El lugar de origen no existe.");
  if (!destino) throw new ErrorNegocio("La obra de destino no existe.");
  return {
    origenNombre: origen.nombre,
    origenDireccion: origen.direccion,
    origenLat: origen.lat,
    origenLng: origen.lng,
    destinoNombre: `Obra ${destino.nombre}`,
    destinoDireccion: `${destino.direccion}, ${destino.localidad}`,
    destinoLat: destino.latitud,
    destinoLng: destino.longitud,
  };
}
