import { db } from "@/lib/db";
import { cuando } from "@/lib/formato";
import { queLleva } from "@/lib/notificaciones/textos";
import { demorado, diasDesde, LIMITES, nombreDoc } from "@/lib/compras/documento";
import { primeraLinea } from "@/lib/materiales/comun";
import type { AlertaCalculada, Regla } from "../tipos";

const DIA = 86_400_000;
const enlace = (id: string) => `/compras/oc/${id}`;

/** Material habilitado para retirar hace más de 3 días y nadie pidió el viaje (aviso). */
async function sinRetirar(): Promise<AlertaCalculada[]> {
  const m = await db.materialListo.findMany({
    where: { estado: "LISTO", modoEntrega: "RETIRA_CHOFER", habilitadoEn: { lt: new Date(Date.now() - LIMITES.sinRetirarDias * DIA) } },
    include: {
      obra: { select: { nombre: true, responsables: { where: { activo: true }, select: { usuarioId: true } } } },
      proveedor: { select: { nombre: true } },
      ordenCompra: { select: { solicitanteId: true, creadaPorId: true } },
    },
  });
  return m.map((x) => ({
    claveUnica: `MATERIAL_SIN_RETIRAR:${x.id}`, regla: "MATERIAL_SIN_RETIRAR", severidad: "AVISO",
    titulo: `Sin retirar hace ${diasDesde(x.habilitadoEn)} días: ${queLleva(x.descripcion)}`,
    detalle: `Para Obra ${x.obra.nombre}, listo en ${x.proveedor.nombre} desde ${cuando(x.habilitadoEn)}. Nadie pidió el viaje.`,
    entidadTipo: "MaterialListo", entidadId: x.id, enlace: enlace(x.ordenCompraId), obraId: x.obraId,
    usuarios: [x.ordenCompra.solicitanteId ?? x.ordenCompra.creadaPorId, ...x.obra.responsables.map((r) => r.usuarioId)],
  }));
}

/** Documento más de 2 días hábiles en manos de Compras sin enviar a autorización (aviso; urgente: crítica). */
async function comprasDemorada(): Promise<AlertaCalculada[]> {
  const p = await db.ordenCompra.findMany({
    where: { estado: { in: ["ENVIADA_A_COMPRAS", "EN_COMPRAS"] }, creadoEn: { lt: new Date(Date.now() - 2 * DIA) } },
    include: { obra: { select: { nombre: true } }, solicitante: { select: { nombre: true } }, creadaPor: { select: { nombre: true } }, cambios: { orderBy: { fecha: "desc" }, take: 1, select: { fecha: true } } },
  });
  return p
    .filter((x) => demorado(x.estado, x.cambios[0]?.fecha ?? x.creadoEn))
    .map((x) => ({
      claveUnica: `MATERIAL_DEMORADO:${x.id}`, regla: "MATERIAL_DEMORADO", severidad: x.prioridad === "URGENTE" ? "CRITICA" : "AVISO",
      titulo: `${x.estado === "ENVIADA_A_COMPRAS" ? "Nadie abrió" : "Sigue en Compras"}: ${queLleva(primeraLinea(x.detallePedido))}`,
      detalle: `${nombreDoc(x)} de ${x.solicitante?.nombre ?? x.creadaPor.nombre}${x.obra ? ` para Obra ${x.obra.nombre}` : ""}, ${x.estado === "ENVIADA_A_COMPRAS" ? "enviada" : "en Compras"} desde ${cuando(x.cambios[0]?.fecha ?? x.creadoEn)} (más de ${LIMITES.compraDiasHabiles} días hábiles).`,
      entidadTipo: "OrdenCompra", entidadId: x.id, enlace: enlace(x.id), obraId: x.obraId,
    }));
}

/** Orden esperando la autorización del dueño hace más de 1 día (aviso). */
async function aprobacionDemorada(): Promise<AlertaCalculada[]> {
  const p = await db.ordenCompra.findMany({
    where: { estado: "ESPERANDO_AUTORIZACION", fuente: { not: "IMPORTADA" } },
    include: { obra: { select: { nombre: true } }, cambios: { orderBy: { fecha: "desc" }, take: 1, select: { fecha: true } } },
  });
  return p
    .filter((x) => demorado(x.estado, x.cambios[0]?.fecha ?? x.creadoEn))
    .map((x) => ({
      claveUnica: `APROBACION_DEMORADA:${x.id}`, regla: "APROBACION_DEMORADA", severidad: "AVISO",
      titulo: `${nombreDoc(x)} para autorizar desde ${cuando(x.cambios[0]?.fecha ?? x.creadoEn)}`,
      detalle: `${nombreDoc(x)} de ${queLleva(primeraLinea(x.detallePedido))}${x.obra ? ` para Obra ${x.obra.nombre}` : ""}. Compras espera tu autorización.`,
      entidadTipo: "OrdenCompra", entidadId: x.id, enlace: "/aprobaciones", obraId: x.obraId,
    }));
}

export const REGLAS_MATERIALES: Regla[] = [
  { nombre: "MATERIAL_SIN_RETIRAR", modulo: "materiales", evaluar: sinRetirar },
  { nombre: "MATERIAL_DEMORADO", modulo: "materiales", evaluar: comprasDemorada },
  { nombre: "APROBACION_DEMORADA", modulo: "materiales", evaluar: aprobacionDemorada },
];
