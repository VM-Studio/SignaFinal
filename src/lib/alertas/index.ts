import { db } from "@/lib/db";
import type { AlertaCalculada, Modulo, Regla } from "./tipos";
import { personasDeRegla, rolesDeRegla } from "./destinatarios";

/* Sin "server-only" ni imports de Next: también lo usa la carga de datos de demo (prisma/seed.ts).
   Para reevaluar después de una acción, usar reevaluar() de ./reevaluar. */
import { REGLAS_PEDIDOS } from "./reglas/pedidos";
import { REGLAS_FLOTA } from "./reglas/flota";
import { REGLAS_HERRAMIENTAS } from "./reglas/herramientas";
import { REGLAS_CUSAT } from "./reglas/cusat";

export const REGLAS: Regla[] = [...REGLAS_PEDIDOS, ...REGLAS_FLOTA, ...REGLAS_HERRAMIENTAS, ...REGLAS_CUSAT];

/**
 * Corre las reglas (todas o las de algunos módulos), hace upsert por claveUnica y
 * resuelve solas las alertas de esas reglas que ya no aplican. Idempotente.
 */
export async function evaluarAlertas(modulos?: Modulo[]) {
  const reglas = modulos ? REGLAS.filter((r) => modulos.includes(r.modulo)) : REGLAS;
  const calculadas: AlertaCalculada[] = (await Promise.all(reglas.map((r) => r.evaluar()))).flat();
  const ahora = new Date();
  const claves = calculadas.map((a) => a.claveUnica);

  // Roles de todos, para filtrar las personas que puede nombrar cada regla.
  const roles = new Map((await db.usuario.findMany({ where: { activo: true }, select: { id: true, rol: true } })).map((u) => [u.id, u.rol]));
  const personas = (a: AlertaCalculada) =>
    personasDeRegla(a.regla, [a.usuarioId, ...(a.usuarios ?? [])].filter((id): id is string => !!id && roles.has(id)).map((id) => ({ id, rol: roles.get(id)! })));

  await db.$transaction(async (tx) => {
    for (const a of calculadas) {
      const datos = {
        regla: a.regla, severidad: a.severidad, titulo: a.titulo, detalle: a.detalle, entidadTipo: a.entidadTipo, entidadId: a.entidadId, enlace: a.enlace,
        obraId: a.obraId ?? null, usuarioId: a.usuarioId ?? null, rolesDestino: rolesDeRegla(a.regla), usuariosDestino: personas(a),
      };
      const previa = await tx.alerta.findUnique({ where: { claveUnica: a.claveUnica }, select: { estado: true } });
      if (!previa) await tx.alerta.create({ data: { claveUnica: a.claveUnica, ...datos } });
      // Si estaba resuelta y el problema volvió, se reabre; si estaba vista, sigue vista.
      else await tx.alerta.update({ where: { claveUnica: a.claveUnica }, data: { ...datos, ...(previa.estado === "RESUELTA" ? { estado: "ABIERTA", resueltaEn: null, creadaEn: ahora } : {}) } });
    }
    await tx.alerta.updateMany({
      where: { regla: { in: reglas.map((r) => r.nombre) }, estado: { not: "RESUELTA" }, claveUnica: { notIn: claves } },
      data: { estado: "RESUELTA", resueltaEn: ahora },
    });
  }, { timeout: 60_000 });

  return { reglas: reglas.length, activas: calculadas.length };
}

export type { Modulo };
