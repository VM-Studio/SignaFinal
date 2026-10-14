import "server-only";
import type { UsuarioSesion } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { puede } from "@/lib/permisos";
import { materialesVisibles } from "@/lib/materiales/consultas";
import type { ClaveContador } from "@/lib/navegacion";

/**
 * CONTADORES DE LA NAVEGACIÓN (punto rojo con número): Aprobaciones (órdenes esperando al dueño),
 * Pedidos (nuevos sin tomar, para Compras), Solicitudes (pendientes, para los choferes) y Mis pedidos
 * (materiales listos para retirar, para la obra). Los avisos sin leer los lleva la campana.
 * Cada rol solo calcula los suyos.
 */
export async function contadoresNav(u: Pick<UsuarioSesion, "id" | "rol">): Promise<Partial<Record<ClaveContador, number>>> {
  const [aprobaciones, pedidosNuevos, solicitudesNuevas, listosRetirar] = await Promise.all([
    puede(u.rol, "materiales.aprobar") ? db.ordenCompra.count({ where: { estado: "ESPERANDO_APROBACION", fuente: "SISTEMA", pedidoMaterialId: { not: null } } }) : null,
    u.rol === "COMPRAS" ? db.pedidoMaterial.count({ where: { estado: "SOLICITADO" } }) : null,
    u.rol === "CHOFER" ? db.pedidoViaje.count({ where: { estado: "PENDIENTE" } }) : null,
    u.rol === "RESPONSABLE_OBRA" || u.rol === "CAPATAZ"
      ? db.materialListo.count({ where: { estado: "LISTO", modoEntrega: "RETIRA_CHOFER", pedidoMaterial: materialesVisibles(u) } })
      : null,
  ]);
  const r: Partial<Record<ClaveContador, number>> = {};
  if (aprobaciones != null) r.aprobaciones = aprobaciones;
  if (pedidosNuevos != null) r.pedidosNuevos = pedidosNuevos;
  if (solicitudesNuevas != null) r.solicitudesNuevas = solicitudesNuevas;
  if (listosRetirar != null) r.listosRetirar = listosRetirar;
  return r;
}
