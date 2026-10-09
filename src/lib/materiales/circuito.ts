import "server-only";
import type { EstadoMaterial, EstadoMaterialListo, Prisma } from "@prisma/client";
import { notificar } from "@/lib/notificaciones";
import { TEXTO_MATERIAL } from "@/lib/notificaciones/textos";
import { responsablePrincipal } from "@/lib/alcance";

type Tx = Prisma.TransactionClient;

/** Enlace neutro: cada rol lo abre en su pantalla (permisos.ts, rutaNueva). */
export const enlaceMaterial = (id: string) => `/materiales/${id}`;

/** Cambia el estado del pedido de material y deja la historia (CambioEstadoMaterial). */
export async function cambiarEstado(tx: Tx, pm: { id: string; estado: EstadoMaterial }, a: EstadoMaterial, usuarioId: string | null, nota?: string, datos: Prisma.PedidoMaterialUncheckedUpdateInput = {}) {
  // Cerrojo: si otro lo cambió en el medio, no se pisa.
  const r = await tx.pedidoMaterial.updateMany({ where: { id: pm.id, estado: pm.estado }, data: { ...datos, estado: a } });
  if (!r.count) return false;
  if (pm.estado !== a) await tx.cambioEstadoMaterial.create({ data: { pedidoMaterialId: pm.id, de: pm.estado, a, usuarioId, nota: nota?.slice(0, 300) } });
  return true;
}

/**
 * Estado del pedido según sus habilitaciones (retiros parciales):
 * algo en camino → EN_CAMINO; algo con retiro pedido → RETIRO_PEDIDO; algo listo → LISTO_PARA_RETIRAR;
 * todo entregado → ENTREGADO si Compras marcó "no falta nada", si no APROBADO (falta habilitar el resto).
 */
export function estadoSegunHabilitaciones(completo: boolean, habilitaciones: { estado: EstadoMaterialListo }[]): EstadoMaterial {
  const activas = habilitaciones.filter((h) => h.estado !== "CANCELADO");
  if (activas.some((h) => h.estado === "EN_CAMINO")) return "EN_CAMINO";
  if (activas.some((h) => h.estado === "RETIRO_PEDIDO")) return "RETIRO_PEDIDO";
  if (activas.some((h) => h.estado === "LISTO")) return "LISTO_PARA_RETIRAR";
  if (activas.length && completo) return "ENTREGADO";
  return "APROBADO";
}

const DESPUES_DE_APROBADO: EstadoMaterial[] = ["APROBADO", "LISTO_PARA_RETIRAR", "RETIRO_PEDIDO", "EN_CAMINO"];

/** Recalcula el estado de un pedido aprobado a partir de sus habilitaciones. Devuelve el cambio, si hubo. */
export async function recalcular(tx: Tx, pedidoMaterialId: string, usuarioId: string | null, nota?: string) {
  const pm = await tx.pedidoMaterial.findUniqueOrThrow({ where: { id: pedidoMaterialId }, select: { id: true, estado: true, completo: true, materialesListos: { select: { estado: true } } } });
  if (!DESPUES_DE_APROBADO.includes(pm.estado)) return null;
  const a = estadoSegunHabilitaciones(pm.completo, pm.materialesListos);
  if (a === pm.estado) return null;
  await cambiarEstado(tx, pm, a, usuarioId, nota);
  return { de: pm.estado, a };
}

/** Compras: todos los usuarios activos del rol. */
export async function idsCompras(tx: Tx) {
  return (await tx.usuario.findMany({ where: { rol: "COMPRAS", activo: true }, select: { id: true } })).map((u) => u.id);
}

/** El que pidió y el responsable principal de la obra (si son distintos, los dos). */
export async function idsObra(tx: Tx, pm: { solicitanteId: string; obraId: string }) {
  const principal = await responsablePrincipal(tx, pm.obraId);
  return [...new Set([pm.solicitanteId, ...(principal ? [principal.id] : [])])];
}

/** Lo que le pasa al viaje de retiro y cómo se mueve el material. */
export type EventoViaje = "TOMADO" | "EN_VIAJE" | "ENTREGADO" | "LIBERADO" | "CANCELADO";

const DESDE: Record<EventoViaje, EstadoMaterialListo[]> = {
  TOMADO: ["LISTO"],
  EN_VIAJE: ["LISTO", "RETIRO_PEDIDO"],
  ENTREGADO: ["LISTO", "RETIRO_PEDIDO", "EN_CAMINO"],
  LIBERADO: ["RETIRO_PEDIDO", "EN_CAMINO"],
  CANCELADO: ["RETIRO_PEDIDO", "EN_CAMINO"],
};
const HACIA: Record<EventoViaje, EstadoMaterialListo> = {
  TOMADO: "RETIRO_PEDIDO", EN_VIAJE: "EN_CAMINO", ENTREGADO: "ENTREGADO", LIBERADO: "LISTO", CANCELADO: "LISTO",
};

/**
 * Enganche con el viaje (CLAUDE.md, "Materiales y Compras"): en viaje → EN_CAMINO; entregado → ENTREGADO
 * (y el pedido ENTREGADO si está todo y "no falta nada"); el chofer lo suelta o se cancela → vuelve a LISTO.
 * El material sigue unido al pedido de viaje: si otro chofer lo acepta, vuelve a "retiro pedido".
 * No hace nada si el viaje no es un retiro de material.
 */
export async function alCambiarElViaje(tx: Tx, pedidoViajeId: string, evento: EventoViaje, usuarioId: string | null) {
  const listos = await tx.materialListo.findMany({
    where: { pedidoViajeId, estado: { in: DESDE[evento] } },
    include: { proveedor: { select: { nombre: true } }, pedidoMaterial: { select: { id: true, descripcion: true, solicitanteId: true, obraId: true, obra: { select: { nombre: true } } } } },
  });
  if (!listos.length) return;
  const ahora = new Date();
  await tx.materialListo.updateMany({
    where: { id: { in: listos.map((m) => m.id) } },
    data: { estado: HACIA[evento], ...(evento === "ENTREGADO" ? { entregadoEn: ahora } : {}) },
  });

  const viaje = await tx.pedidoViaje.findUnique({ where: { id: pedidoViajeId }, select: { solicitanteId: true, numero: true, tomadoPor: { select: { nombre: true } } } });
  const nota = { TOMADO: `Viaje #${viaje?.numero} aceptado`, EN_VIAJE: `Viaje #${viaje?.numero} en camino`, ENTREGADO: `Viaje #${viaje?.numero} entregado`, LIBERADO: `El chofer soltó el viaje #${viaje?.numero}`, CANCELADO: `Se canceló el viaje #${viaje?.numero}` }[evento];
  const compras = await idsCompras(tx);

  for (const pm of new Map(listos.map((m) => [m.pedidoMaterial.id, m])).values()) {
    const cambio = await recalcular(tx, pm.pedidoMaterial.id, usuarioId, nota);
    const datos = { que: pm.descripcion, obra: pm.pedidoMaterial.obra.nombre };
    const enlace = enlaceMaterial(pm.pedidoMaterial.id);
    // El que pidió el viaje ya recibe los avisos del viaje: el del material es para los demás (o sin push).
    const pushObra = pm.pedidoMaterial.solicitanteId !== viaje?.solicitanteId;
    if (evento === "EN_VIAJE" && pushObra) {
      await notificar(pm.pedidoMaterial.solicitanteId, "MATERIAL", { ...TEXTO_MATERIAL.enCamino({ ...datos, chofer: viaje?.tomadoPor?.nombre ?? "El chofer", proveedor: pm.proveedor.nombre }), enlace }, { tx });
    }
    if (evento === "ENTREGADO") {
      const completo = cambio?.a === "ENTREGADO";
      const texto = { ...TEXTO_MATERIAL.entregado({ ...datos, completo }), enlace: enlaceMaterial(pm.pedidoMaterial.id) };
      for (const id of compras) await notificar(id, "MATERIAL", texto, { tx });
      await notificar(pm.pedidoMaterial.solicitanteId, "MATERIAL", texto, { tx, push: pushObra });
    }
    if (evento === "LIBERADO" || evento === "CANCELADO") {
      const texto = { ...TEXTO_MATERIAL.vuelveAListo({ ...datos, proveedor: pm.proveedor.nombre, motivo: evento === "LIBERADO" ? `${viaje?.tomadoPor?.nombre ?? "El chofer"} soltó el viaje` : "Se canceló el viaje" }), enlace };
      for (const id of compras) await notificar(id, "MATERIAL", texto, { tx, push: false });
      if (pushObra) await notificar(pm.pedidoMaterial.solicitanteId, "MATERIAL", texto, { tx });
    }
  }
}
