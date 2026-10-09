import { db } from "@/lib/db";
import { cuando } from "@/lib/formato";
import { queLleva } from "@/lib/notificaciones/textos";
import { demorado, diasDesde, LIMITES } from "@/lib/materiales/presentacion";
import type { AlertaCalculada, Regla } from "../tipos";

const DIA = 86_400_000;
const enlace = (id: string) => `/materiales/${id}`;

/** Material habilitado para retirar hace más de 3 días y nadie pidió el viaje (aviso). */
async function sinRetirar(): Promise<AlertaCalculada[]> {
  const m = await db.materialListo.findMany({
    where: { estado: "LISTO", modoEntrega: "RETIRA_CHOFER", habilitadoEn: { lt: new Date(Date.now() - LIMITES.sinRetirarDias * DIA) } },
    include: {
      obra: { select: { nombre: true, responsables: { where: { activo: true }, select: { usuarioId: true } } } },
      proveedor: { select: { nombre: true } },
      pedidoMaterial: { select: { solicitanteId: true } },
    },
  });
  return m.map((x) => ({
    claveUnica: `MATERIAL_SIN_RETIRAR:${x.id}`, regla: "MATERIAL_SIN_RETIRAR", severidad: "AVISO",
    titulo: `Sin retirar hace ${diasDesde(x.habilitadoEn)} días: ${queLleva(x.descripcion)}`,
    detalle: `Para Obra ${x.obra.nombre}, listo en ${x.proveedor.nombre} desde ${cuando(x.habilitadoEn)}. Nadie pidió el viaje.`,
    entidadTipo: "MaterialListo", entidadId: x.id, enlace: enlace(x.pedidoMaterialId), obraId: x.obraId,
    usuarios: [x.pedidoMaterial.solicitanteId, ...x.obra.responsables.map((r) => r.usuarioId)],
  }));
}

/** Pedido de material más de 2 días hábiles sin comprar (SOLICITADO o EN_COMPRA) (aviso). */
async function comprasDemorada(): Promise<AlertaCalculada[]> {
  const p = await db.pedidoMaterial.findMany({
    where: { estado: { in: ["SOLICITADO", "EN_COMPRA"] }, creadoEn: { lt: new Date(Date.now() - 2 * DIA) } },
    include: { obra: { select: { nombre: true } }, solicitante: { select: { nombre: true } }, cambios: { orderBy: { fecha: "desc" }, take: 1, select: { fecha: true } } },
  });
  return p
    .filter((x) => demorado(x.estado, x.cambios[0]?.fecha ?? x.creadoEn))
    .map((x) => ({
      claveUnica: `MATERIAL_DEMORADO:${x.id}`, regla: "MATERIAL_DEMORADO", severidad: x.prioridad === "URGENTE" ? "CRITICA" : "AVISO",
      titulo: `${x.estado === "SOLICITADO" ? "Nadie tomó" : "Sigue en compra"}: ${queLleva(x.descripcion)}`,
      detalle: `Pedido #${x.numero} de ${x.solicitante.nombre} para Obra ${x.obra.nombre}, ${x.estado === "SOLICITADO" ? "pedido" : "en compra"} desde ${cuando(x.cambios[0]?.fecha ?? x.creadoEn)} (más de ${LIMITES.compraDiasHabiles} días hábiles).`,
      entidadTipo: "PedidoMaterial", entidadId: x.id, enlace: enlace(x.id), obraId: x.obraId,
    }));
}

/** Orden de compra esperando la aprobación del dueño hace más de 1 día (aviso). */
async function aprobacionDemorada(): Promise<AlertaCalculada[]> {
  const p = await db.pedidoMaterial.findMany({
    where: { estado: "ESPERANDO_APROBACION" },
    include: { obra: { select: { nombre: true } }, cambios: { orderBy: { fecha: "desc" }, take: 1, select: { fecha: true } } },
  });
  return p
    .filter((x) => demorado(x.estado, x.cambios[0]?.fecha ?? x.creadoEn))
    .map((x) => ({
      claveUnica: `APROBACION_DEMORADA:${x.id}`, regla: "APROBACION_DEMORADA", severidad: "AVISO",
      titulo: `OC para aprobar desde ${cuando(x.cambios[0]?.fecha ?? x.creadoEn)}`,
      detalle: `${x.ordenCompraNumero ?? "Orden de compra"} de ${queLleva(x.descripcion)} para Obra ${x.obra.nombre}. Compras espera tu aprobación.`,
      entidadTipo: "PedidoMaterial", entidadId: x.id, enlace: "/aprobaciones", obraId: x.obraId,
    }));
}

export const REGLAS_MATERIALES: Regla[] = [
  { nombre: "MATERIAL_SIN_RETIRAR", modulo: "materiales", evaluar: sinRetirar },
  { nombre: "MATERIAL_DEMORADO", modulo: "materiales", evaluar: comprasDemorada },
  { nombre: "APROBACION_DEMORADA", modulo: "materiales", evaluar: aprobacionDemorada },
];
