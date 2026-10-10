import "server-only";
import type { EntidadAdjunto } from "@prisma/client";
import { db } from "@/lib/db";
import type { UsuarioSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { esObraDelUsuario, viajesVisibles } from "@/lib/alcance";

/** Quién puede subir archivos a cada tipo de cosa. */
export function puedeSubir(u: UsuarioSesion, entidad: EntidadAdjunto, interno = false) {
  if (interno) return puede(u.rol, "materiales.gestionar");
  switch (entidad) {
    case "PEDIDO_MATERIAL":
      return puede(u.rol, "materiales.pedir") || puede(u.rol, "materiales.gestionar");
    case "ORDEN_COMPRA":
      return puede(u.rol, "materiales.gestionar");
    case "VIAJE":
      return puede(u.rol, "viajes.ejecutar") || puede(u.rol, "pedidos.reasignar");
    case "HERRAMIENTA":
      return puede(u.rol, "herramientas.editar");
    case "VEHICULO":
      return puede(u.rol, "flota.documentacion");
  }
}

/**
 * ¿Puede ver este adjunto? El que lo subió siempre; los internos de Compras solo Compras y Dirección;
 * del resto, quien ve la cosa a la que pertenece (su obra, su viaje, la flota, el depósito).
 */
export async function puedeVer(u: UsuarioSesion, a: { entidadTipo: EntidadAdjunto; entidadId: string | null; subidoPorId: string; interno: boolean }) {
  if (a.subidoPorId === u.id) return true;
  if (a.interno) return puede(u.rol, "materiales.gestionar") || puede(u.rol, "materiales.aprobar");
  if (!a.entidadId) return false;
  if (u.rol === "DIRECCION") return true;
  switch (a.entidadTipo) {
    case "PEDIDO_MATERIAL": {
      if (puede(u.rol, "materiales.gestionar")) return true;
      const p = await db.pedidoMaterial.findUnique({ where: { id: a.entidadId }, select: { obraId: true } });
      return !!p && puede(u.rol, "materiales.pedir") && (await esObraDelUsuario(u, p.obraId));
    }
    case "ORDEN_COMPRA": {
      if (puede(u.rol, "materiales.gestionar")) return true;
      const oc = await db.ordenCompra.findUnique({ where: { id: a.entidadId }, select: { obraId: true } });
      return !!oc && puede(u.rol, "materiales.pedir") && (await esObraDelUsuario(u, oc.obraId));
    }
    case "VIAJE":
      return (await db.viaje.count({ where: { id: a.entidadId, ...viajesVisibles(u) } })) > 0;
    case "HERRAMIENTA":
      return puede(u.rol, "herramientas.ver");
    case "VEHICULO":
      return puede(u.rol, "flota.ver");
  }
}
