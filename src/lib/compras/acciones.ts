"use server";

import type { EstadoTablero, Prisma, SemaforoPE } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { revalidar } from "@/lib/revalidar";
import { auditar } from "@/lib/materiales/comun";
import { nombreDoc } from "./documento";
import { ESTADO_TABLERO } from "./estadoTablero";

/**
 * ACCIONES DEL TABLERO de Compras (la planilla): las celdas que se escriben en la misma tabla (Próximos
 * pasos y Comentarios), el ajuste a mano del ESTADO y el semáforo de los PE. Lo del documento (celdas de la
 * plantilla, envíos, autorización) está en documento-acciones.ts.
 */
type Tx = Prisma.TransactionClient;
const auditarOC = (tx: Tx, oc: { id: string }, d: { usuarioId: string; accion: string; resumen: string; antes?: Prisma.InputJsonValue; despues?: Prisma.InputJsonValue }) =>
  auditar(tx, { ...d, entidadId: oc.id });
const nombreOC = (o: { tipo: "OC" | "PE"; numero: string | null; numeroInterno: number; versionAprobacion?: number }) => nombreDoc(o);

// ───────────────────────────── Tablero ─────────────────────────────

const CELDAS = { proximosPasos: "Próximos pasos", comentarios: "Comentarios" } as const;

/** Celdas editables en línea del tablero ("Observaciones en OC / Próximos pasos" y "Comentarios"). */
export async function editarCeldaTablero(ocId: string, campo: keyof typeof CELDAS, valor: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    if (!(campo in CELDAS)) throw new ErrorNegocio("Esa columna no se edita.");
    const v = valor.trim().slice(0, 2000) || null;
    await db.$transaction(async (tx) => {
      const oc = await tx.ordenCompra.findUnique({ where: { id: ocId }, select: { id: true, tipo: true, numero: true, numeroInterno: true, proximosPasos: true, comentarios: true } });
      if (!oc) throw new ErrorNegocio("No existe esa orden.");
      if ((oc[campo] ?? null) === v) return;
      await tx.ordenCompra.update({ where: { id: ocId }, data: { [campo]: v } });
      await auditarOC(tx, oc, { usuarioId: yo.id, accion: `oc.tablero.${campo}`, resumen: `${yo.nombre} anotó en ${CELDAS[campo]} de la ${nombreOC(oc)}: ${v ?? "(vacío)"}`, antes: { [campo]: oc[campo] }, despues: { [campo]: v } });
    });
    revalidar("materiales");
    return null;
  });
}

/** Ajuste a mano del ESTADO del tablero (vale hasta el próximo cambio real; ver estadoTablero.ts). */
export async function ajustarEstadoTablero(ocId: string, estado: EstadoTablero | null): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    await db.$transaction(async (tx) => {
      const oc = await tx.ordenCompra.findUnique({ where: { id: ocId }, select: { id: true, tipo: true, numero: true, numeroInterno: true, estadoTablero: true, estadoTableroAuto: true, fuente: true, comentarios: true } });
      if (!oc) throw new ErrorNegocio("No existe esa orden.");
      if (oc.estadoTablero === estado) return;
      // Un estado que no es el que sale del circuito se acepta igual, como ajuste a mano, y queda anotado en Comentarios.
      const aMano = oc.fuente !== "IMPORTADA" && estado !== oc.estadoTableroAuto;
      const nota = `(ajustado a mano por ${yo.nombre.split(" ")[0]} el ${new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit" }).format(new Date())})`;
      const comentarios = aMano ? [oc.comentarios?.trim(), nota].filter(Boolean).join("\n").slice(0, 2000) : undefined;
      await tx.ordenCompra.update({ where: { id: ocId }, data: { estadoTablero: estado, ...(comentarios ? { comentarios } : {}), ...(oc.fuente === "IMPORTADA" ? { estadoTableroAuto: estado } : {}) } });
      const t = (e: EstadoTablero | null) => (e ? ESTADO_TABLERO[e].titulo : "sin estado");
      await auditarOC(tx, oc, { usuarioId: yo.id, accion: "oc.tablero.estado", resumen: `${yo.nombre} cambió a mano el estado de la ${nombreOC(oc)} en el tablero: ${t(oc.estadoTablero)} → ${t(estado)}`, antes: { estadoTablero: oc.estadoTablero }, despues: { estadoTablero: estado } });
    });
    revalidar("materiales");
    return null;
  });
}

/** Semáforo de los pedidos especiales ("ESTADO DE LA ORDEN" arriba de cada PE). */
export async function cambiarSemaforoPE(ocId: string, semaforo: SemaforoPE): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    await db.$transaction(async (tx) => {
      const oc = await tx.ordenCompra.findUnique({ where: { id: ocId }, select: { id: true, tipo: true, numero: true, numeroInterno: true, semaforoPE: true } });
      if (!oc || oc.tipo !== "PE") throw new ErrorNegocio("El semáforo es de los pedidos especiales.");
      await tx.ordenCompra.update({ where: { id: ocId }, data: { semaforoPE: semaforo } });
      await auditarOC(tx, oc, { usuarioId: yo.id, accion: "oc.semaforo", resumen: `${yo.nombre} marcó el ${nombreOC(oc)} como ${semaforo}`, antes: { semaforoPE: oc.semaforoPE }, despues: { semaforoPE: semaforo } });
    });
    revalidar("materiales");
    return null;
  });
}
