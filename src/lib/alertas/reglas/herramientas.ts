import { db } from "@/lib/db";
import { diasHasta, fecha } from "@/lib/formato";
import type { AlertaCalculada, Regla } from "../tipos";

/** Herramienta con devolución vencida (aviso; crítica a los 7 días). */
async function devolucionVencida(): Promise<AlertaCalculada[]> {
  const h = await db.herramienta.findMany({
    where: { activo: true, estado: "EN_OBRA", devolucionPrevista: { not: null } },
    include: { obra: { select: { nombre: true, responsables: { select: { usuarioId: true } } } }, responsable: { select: { nombre: true } } },
  });
  return h.flatMap((x): AlertaCalculada[] => {
    const n = -diasHasta(x.devolucionPrevista!);
    if (n <= 0) return [];
    return [{
      claveUnica: `DEVOLUCION_VENCIDA:${x.id}`, regla: "DEVOLUCION_VENCIDA", severidad: n >= 7 ? "CRITICA" : "AVISO",
      titulo: `${x.nombre}: devolución vencida hace ${n} día${n === 1 ? "" : "s"}`,
      detalle: `Sigue en Obra ${x.obra?.nombre}${x.responsable ? `, la tiene ${x.responsable.nombre}` : ""}. Debía volver el ${fecha(x.devolucionPrevista)}.`,
      entidadTipo: "Herramienta", entidadId: x.id, enlace: `/herramientas/${x.id}?accion=devolver`, obraId: x.obraId,
      // Quien la tiene y los responsables de esa obra.
      usuarios: [x.responsableId, ...(x.obra?.responsables.map((r) => r.usuarioId) ?? [])].filter((id): id is string => !!id),
    }];
  });
}

/** Máquina en una obra finalizada o pausada hace más de 5 días. */
async function enObraParada(): Promise<AlertaCalculada[]> {
  const h = await db.herramienta.findMany({
    where: { activo: true, esMaquina: true, estado: "EN_OBRA", obra: { estado: { in: ["FINALIZADA", "PAUSADA"] }, actualizadoEn: { lt: new Date(Date.now() - 5 * 86_400_000) } } },
    include: { obra: { select: { nombre: true, estado: true } } },
  });
  return h.map((x) => ({
    claveUnica: `MAQUINA_OBRA_PARADA:${x.id}`, regla: "MAQUINA_OBRA_PARADA", severidad: "AVISO",
    titulo: `${x.nombre} en una obra ${x.obra?.estado === "FINALIZADA" ? "terminada" : "pausada"}`,
    detalle: `Obra ${x.obra?.nombre} está ${x.obra?.estado === "FINALIZADA" ? "finalizada" : "pausada"} hace más de 5 días. Traerla al depósito o llevarla a otra obra.`,
    entidadTipo: "Herramienta", entidadId: x.id, enlace: `/herramientas/${x.id}`, obraId: x.obraId,
  }));
}

/** Mantenimiento de máquina vencido. */
async function mantenimientoVencido(): Promise<AlertaCalculada[]> {
  const h = await db.herramienta.findMany({ where: { activo: true, proximoMantenimiento: { not: null }, estado: { notIn: ["BAJA", "EXTRAVIADA"] } } });
  return h.flatMap((x): AlertaCalculada[] => {
    const n = diasHasta(x.proximoMantenimiento!);
    if (n >= 0) return [];
    return [{
      claveUnica: `MANT_MAQUINA:${x.id}`, regla: "MANT_MAQUINA", severidad: "AVISO",
      titulo: `${x.nombre}: mantenimiento vencido`, detalle: `Tocaba el ${fecha(x.proximoMantenimiento)}.`,
      entidadTipo: "Herramienta", entidadId: x.id, enlace: `/herramientas/${x.id}`, obraId: x.obraId,
    }];
  });
}

export const REGLAS_HERRAMIENTAS: Regla[] = [
  { nombre: "DEVOLUCION_VENCIDA", modulo: "herramientas", evaluar: devolucionVencida },
  { nombre: "MAQUINA_OBRA_PARADA", modulo: "herramientas", evaluar: enObraParada },
  { nombre: "MANT_MAQUINA", modulo: "herramientas", evaluar: mantenimientoVencido },
];
