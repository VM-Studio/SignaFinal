import "server-only";
import { db } from "@/lib/db";
import { ROL } from "@/lib/etiquetas";
import { aInputFecha } from "@/lib/formato";
import type { VehiculoEditable } from "@/components/flota/formulario-vehiculo";

export async function opcionesFormularioVehiculo() {
  const [personas, lugares] = await Promise.all([
    db.usuario.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, rol: true } }),
    db.lugar.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);
  return { personas: personas.map((p) => ({ ...p, rol: ROL[p.rol] })), lugares };
}

export async function vehiculoEditable(id: string): Promise<VehiculoEditable | null> {
  const v = await db.vehiculo.findUnique({ where: { id } });
  if (!v) return null;
  return {
    id: v.id,
    nombre: v.nombre,
    tipo: v.tipo,
    patente: v.patente,
    marca: v.marca ?? "",
    modelo: v.modelo ?? "",
    anio: v.anio ? String(v.anio) : "",
    capacidadKg: String(v.capacidadKg),
    costoKm: v.costoKm.toString(),
    kmActual: String(v.kmActual),
    seguroCompania: v.seguroCompania ?? "",
    seguroPoliza: v.seguroPoliza ?? "",
    seguroVence: aInputFecha(v.seguroVence),
    vtvVence: aInputFecha(v.vtvVence),
    idCusat: v.idCusat ?? "",
    asignadoAId: v.asignadoAId ?? "",
    lugarId: v.lugarId ?? "",
    disponibleParaPedidos: v.disponibleParaPedidos,
    notas: v.notas ?? "",
  };
}
