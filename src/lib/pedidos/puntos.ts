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
/** Sucursal de un proveedor por su id (o, si llega el id del proveedor, su sucursal principal). */
export async function sucursalDe(cliente: Cliente, id: string) {
  const incluir = { proveedor: { select: { id: true, nombre: true } } } as const;
  return (
    (await cliente.sucursalProveedor.findFirst({ where: { id, activa: true }, include: incluir })) ??
    (await cliente.sucursalProveedor.findFirst({ where: { proveedorId: id, activa: true }, orderBy: [{ principal: "desc" }, { creadoEn: "asc" }], include: incluir }))
  );
}

/** Nombre que ve el chofer: "Corralón San Martín" o "Corralón San Martín · Sucursal Pilar". */
export const nombreSucursal = (s: { nombre: string; proveedor: { nombre: string } }, variasSucursales = true) =>
  variasSucursales && s.nombre && s.nombre !== "Casa central" ? `${s.proveedor.nombre} · ${s.nombre}` : s.proveedor.nombre;

export async function resolverPuntos(cliente: Cliente, d: { origenTipo: OrigenTipo; origenId: string; obraId: string; destinoSedeId?: string | null }): Promise<Puntos & { sucursalId: string | null; proveedorId: string | null }> {
  const [origen, destino, sede] = await Promise.all([
    d.origenTipo === "PROVEEDOR"
      ? sucursalDe(cliente, d.origenId).then((x) => x && { nombre: nombreSucursal(x), direccion: `${x.direccion}, ${x.localidad}`, lat: x.latitud, lng: x.longitud, sucursalId: x.id, proveedorId: x.proveedorId })
      : d.origenTipo === "OBRA"
        ? cliente.obra.findFirst({ where: { id: d.origenId, estado: "ACTIVA" } }).then((x) => x && { nombre: `Obra ${x.nombre}`, direccion: `${x.direccion}, ${x.localidad}`, lat: x.latitud, lng: x.longitud, sucursalId: null, proveedorId: null })
        : cliente.ubicacion
            .findFirst({ where: { id: d.origenId, activa: true, tipo: d.origenTipo === "BASE" ? "BASE_VEHICULOS" : "DEPOSITO" } })
            .then((x) => x && { nombre: x.nombre, direccion: x.direccion, lat: x.latitud, lng: x.longitud, sucursalId: null, proveedorId: null }),
    cliente.obra.findUnique({ where: { id: d.obraId } }),
    d.destinoSedeId ? cliente.obraSede.findFirst({ where: { id: d.destinoSedeId, obraId: d.obraId, activa: true } }) : Promise.resolve(null),
  ]);
  if (!origen) throw new ErrorNegocio("El lugar de origen no existe.");
  if (!destino) throw new ErrorNegocio("La obra de destino no existe.");
  if (d.destinoSedeId && !sede) throw new ErrorNegocio("Esa sede de la obra no existe.");
  const suc = origen.sucursalId ? origen : null;
  if (sede) {
    return {
      origenNombre: origen.nombre, origenDireccion: origen.direccion, origenLat: origen.lat, origenLng: origen.lng,
      destinoNombre: `Obra ${destino.nombre} · ${sede.nombre}`, destinoDireccion: `${sede.direccion}, ${sede.localidad}`, destinoLat: sede.latitud, destinoLng: sede.longitud,
      sucursalId: suc?.sucursalId ?? null, proveedorId: suc?.proveedorId ?? null,
    };
  }
  return {
    sucursalId: suc?.sucursalId ?? null,
    proveedorId: suc?.proveedorId ?? null,
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
