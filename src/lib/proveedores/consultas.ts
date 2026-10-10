import "server-only";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import type { ProveedorConSucursales } from "./acciones";

/** Proveedores activos con sus sucursales activas (para SelectorProveedorSucursal). */
export async function proveedoresConSucursales(): Promise<ProveedorConSucursales[]> {
  await exigirPermiso("proveedores.ver");
  const ps = await db.proveedor.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    include: { sucursales: { where: { activa: true }, orderBy: [{ principal: "desc" }, { nombre: "asc" }] } },
  });
  return ps.map((p) => ({
    id: p.id, nombre: p.nombre, cuit: p.cuit, telefono: p.telefono,
    sucursales: p.sucursales.map((s) => ({ id: s.id, nombre: s.nombre, direccion: s.direccion, localidad: s.localidad, lat: s.latitud, lng: s.longitud, horarioRetiro: s.horarioRetiro, contacto: s.contacto, telefono: s.telefono, principal: s.principal })),
  }));
}
