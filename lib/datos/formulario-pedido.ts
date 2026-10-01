import "server-only";
import { db } from "@/lib/db";
import type { UsuarioActual } from "@/lib/auth/usuario-actual";
import type { DatosFormularioPedido } from "@/components/pedidos/formulario-pedido";
import { obrasDe } from "./obras";

/** Todo lo que se elige de una lista al pedir un viaje, sacado de la base. */
export async function datosFormularioPedido(usuario: UsuarioActual): Promise<DatosFormularioPedido> {
  const obras = await obrasDe(usuario);
  const [proveedores, ordenes, lugares, vehiculos] = await Promise.all([
    db.proveedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, rubro: true, direccion: true } }),
    db.ordenCompra.findMany({
      where: { abierta: true, obraId: { in: obras.map((o) => o.id) } },
      orderBy: { fecha: "desc" },
      select: { id: true, numero: true, descripcion: true, pesoEstimadoKg: true, obraId: true, proveedorId: true, proveedor: { select: { nombre: true } } },
    }),
    db.lugar.findMany({ where: { activo: true }, orderBy: { tipo: "desc" }, select: { nombre: true } }),
    db.vehiculo.findMany({ where: { activo: true, disponibleParaPedidos: true }, select: { nombre: true, capacidadKg: true, tipo: true } }),
  ]);

  // Tramos de peso = capacidades reales de la flota.
  const porCapacidad = new Map<number, string[]>();
  for (const v of vehiculos) porCapacidad.set(v.capacidadKg, [...(porCapacidad.get(v.capacidadKg) ?? []), v.tipo === "CAMION" ? v.nombre : v.tipo === "AUTO" ? "Auto" : "Camioneta"]);
  const capacidades = [...porCapacidad.entries()]
    .filter(([kg]) => kg > 0)
    .sort((a, b) => a[0] - b[0])
    .map(([kg, nombres]) => ({ kg, vehiculos: [...new Set(nombres)].join(", ") }));

  return {
    obras: obras.map((o) => ({ id: o.id, nombre: o.nombre, direccion: [o.direccion, o.localidad].filter(Boolean).join(", ") })),
    proveedores,
    ordenes: ordenes.map((o) => ({ ...o, proveedor: o.proveedor.nombre })),
    lugares: lugares.map((l) => l.nombre),
    capacidades,
  };
}
