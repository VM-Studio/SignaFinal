import "server-only";
import type { UsuarioSesion } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { puede } from "@/lib/permisos";
import { documentosVisibles } from "@/lib/materiales/consultas";
import type { ClaveContador } from "@/lib/navegacion";

/**
 * CONTADORES DE LA NAVEGACIÓN (punto rojo con número): Aprobaciones (órdenes esperando al dueño),
 * Pedidos (nuevos sin tomar, para Compras), Solicitudes (pendientes, para los choferes) y Mis pedidos
 * (materiales listos para retirar, para la obra). Los avisos sin leer los lleva la campana.
 * Cada rol solo calcula los suyos.
 */
export async function contadoresNav(u: Pick<UsuarioSesion, "id" | "rol">): Promise<Partial<Record<ClaveContador, number>>> {
  const [aprobaciones, pedidosNuevos, solicitudesNuevas, listosRetirar] = await Promise.all([
    // Al dueño: órdenes y pagos que esperan su autorización.
    puede(u.rol, "materiales.aprobar")
      ? Promise.all([
          db.ordenCompra.count({ where: { estado: "ESPERANDO_AUTORIZACION", fuente: { not: "IMPORTADA" } } }),
          db.ordenCompra.count({ where: { pagoSolicitadoEn: { not: null }, ordenPagoAutorizadaEn: null, estado: { not: "ANULADA" } } }),
        ]).then(([a, b]) => a + b)
      : null,
    u.rol === "COMPRAS" ? db.ordenCompra.count({ where: { estado: "ENVIADA_A_COMPRAS" } }) : null,
    u.rol === "CHOFER" ? db.pedidoViaje.count({ where: { estado: "PENDIENTE" } }) : null,
    u.rol === "RESPONSABLE_OBRA" || u.rol === "CAPATAZ"
      ? db.materialListo.count({ where: { estado: "LISTO", modoEntrega: "RETIRA_CHOFER", ordenCompra: documentosVisibles(u) } })
      : null,
  ]);
  const r: Partial<Record<ClaveContador, number>> = {};
  if (aprobaciones != null) r.aprobaciones = aprobaciones;
  if (pedidosNuevos != null) r.pedidosNuevos = pedidosNuevos;
  if (solicitudesNuevas != null) r.solicitudesNuevas = solicitudesNuevas;
  if (listosRetirar != null) r.listosRetirar = listosRetirar;
  return r;
}
