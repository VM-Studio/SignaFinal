import { quitarDelViaje } from "@/lib/viajes/paradas";
import "server-only";
import type { Condicion, Prisma, TipoMovimiento } from "@prisma/client";
import { ErrorNegocio } from "@/lib/resultado";
import { auditar as auditarBase } from "@/lib/auditoria";

/**
 * Operaciones del depósito dentro de una transacción. Cada una crea el movimiento y
 * actualiza ubicación, estado y responsable en el mismo paso. Las usan las Server Actions
 * y el cierre de viajes (una máquina que viaja en camión cambia de lugar al llegar).
 */

type Tx = Prisma.TransactionClient;
type Lugar = { ubicacionId?: string | null; obraId?: string | null };

/** El depósito principal (el galpón): adonde vuelven las herramientas si no se dice otro. */
export async function depositoId(tx: Tx) {
  const d = await tx.ubicacion.findFirst({ where: { tipo: "DEPOSITO", activa: true }, orderBy: [{ etiqueta: "asc" }, { nombre: "asc" }], select: { id: true } });
  if (!d) throw new ErrorNegocio("No hay un depósito cargado.");
  return d.id;
}

/**
 * De qué depósito sale: la unitaria, del que está; la de cantidad, del que tenga stock suficiente
 * (primero el principal). Null si no hay en ningún depósito.
 */
export async function depositoCon(tx: Tx, herramientaId: string, cantidad = 1) {
  const h = await tx.herramienta.findUniqueOrThrow({ where: { id: herramientaId }, select: { tipoControl: true, ubicacionId: true } });
  if (h.tipoControl === "UNITARIA") return h.ubicacionId;
  const principal = await depositoId(tx);
  const conStock = await tx.existenciaHerramienta.findMany({ where: { herramientaId, ubicacionId: { not: null }, cantidad: { gte: cantidad } }, select: { ubicacionId: true } });
  return conStock.find((e) => e.ubicacionId === principal)?.ubicacionId ?? conStock[0]?.ubicacionId ?? null;
}

export async function auditar(tx: Tx, usuarioId: string, accion: string, entidadId: string, resumen: string, antes?: Prisma.InputJsonValue, despues?: Prisma.InputJsonValue) {
  await auditarBase(tx, { usuarioId, accion, entidad: "Herramienta", entidadId, resumen, antes, despues });
}

/** Cómo se cuenta cada movimiento en la Actividad. */
const VERBO: Record<TipoMovimiento, (h: string, obra: string | null) => string> = {
  ENTREGA: (h, o) => `entregó ${h} en Obra ${o}`,
  DEVOLUCION: (h) => `recibió ${h} de vuelta en el depósito`,
  TRANSFERENCIA: (h, o) => `pasó ${h} a Obra ${o}`,
  A_REPARACION: (h) => `mandó ${h} a reparar`,
  DE_REPARACION: (h) => `recibió ${h} del taller`,
  EXTRAVIO: (h) => `marcó ${h} como extraviada`,
  BAJA: (h) => `dio de baja ${h}`,
};

// ─────────────────────────── Existencias (por cantidad) ───────────────────────────

async function filaExistencia(tx: Tx, herramientaId: string, l: Lugar) {
  return tx.existenciaHerramienta.findFirst({ where: { herramientaId, ubicacionId: l.ubicacionId ?? null, obraId: l.obraId ?? null } });
}

export async function stockEn(tx: Tx, herramientaId: string, l: Lugar) {
  return (await filaExistencia(tx, herramientaId, l))?.cantidad ?? 0;
}

/** Descuenta sin permitir negativos: la condición "cantidad >= n" hace de cerrojo. */
export async function restar(tx: Tx, herramientaId: string, l: Lugar, n: number, donde: string) {
  const r = await tx.existenciaHerramienta.updateMany({
    where: { herramientaId, ubicacionId: l.ubicacionId ?? null, obraId: l.obraId ?? null, cantidad: { gte: n } },
    data: { cantidad: { decrement: n } },
  });
  if (!r.count) throw new ErrorNegocio(`En ${donde} hay ${await stockEn(tx, herramientaId, l)}. No alcanza para mover ${n}.`);
}

export async function sumar(tx: Tx, herramientaId: string, l: Lugar, n: number) {
  const fila = await filaExistencia(tx, herramientaId, l);
  if (fila) await tx.existenciaHerramienta.update({ where: { id: fila.id }, data: { cantidad: { increment: n } } });
  else await tx.existenciaHerramienta.create({ data: { herramientaId, ubicacionId: l.ubicacionId ?? null, obraId: l.obraId ?? null, cantidad: n } });
}

// ─────────────────────────── Viajes ───────────────────────────

/** Si hay un viaje programado o en curso que lleva esta herramienta a esa obra, el movimiento se vincula a él. */
export async function viajeQueLaLleva(tx: Tx, herramientaId: string, haciaObraId: string) {
  const v = await tx.viaje.findFirst({
    where: { estado: { in: ["PROGRAMADO", "EN_CURSO"] }, pedido: { herramientaId, obraId: haciaObraId, estado: { in: ["TOMADO", "EN_VIAJE"] } } },
    select: { id: true, chofer: { select: { nombre: true } } },
  });
  return v;
}

// ─────────────────────────── Movimientos de unitarias ───────────────────────────

type Mov = {
  usuarioId: string;
  herramientaId: string;
  tipo: TipoMovimiento;
  hacia: Lugar | null; // null = taller / extraviada / baja
  responsableId?: string | null;
  recibidoPorId?: string | null;
  devolucionPrevista?: Date | null;
  condicion?: Condicion | null;
  viajeId?: string | null;
  observaciones?: string | null;
  estado: "DISPONIBLE" | "EN_OBRA" | "EN_REPARACION" | "EXTRAVIADA" | "BAJA";
  /** Estados desde los que se permite el movimiento. */
  desde: ("DISPONIBLE" | "EN_OBRA" | "EN_REPARACION" | "EXTRAVIADA")[];
};

const DONDE = (h: { estado: string; obra?: { nombre: string } | null; responsable?: { nombre: string } | null }) =>
  h.estado === "EN_OBRA" ? `está en Obra ${h.obra?.nombre}${h.responsable ? ` (la tiene ${h.responsable.nombre})` : ""}` :
  h.estado === "DISPONIBLE" ? "está en el depósito" :
  h.estado === "EN_REPARACION" ? "está en reparación" :
  h.estado === "EXTRAVIADA" ? "está marcada como extraviada" : "está dada de baja";

/** Mueve una herramienta unitaria con cerrojo: solo si sigue en el estado y lugar que leímos. */
export async function moverUnitaria(tx: Tx, m: Mov) {
  const h = await tx.herramienta.findUnique({
    where: { id: m.herramientaId },
    include: { obra: { select: { nombre: true } }, responsable: { select: { nombre: true } } },
  });
  if (!h || !h.activo) throw new ErrorNegocio("Esa herramienta no existe o está dada de baja.");
  if (h.tipoControl !== "UNITARIA") throw new ErrorNegocio(`${h.nombre} se maneja por cantidad.`);
  if (!(m.desde as string[]).includes(h.estado)) throw new ErrorNegocio(`No se puede: ${h.nombre} ${DONDE(h)}.`);
  if (m.hacia?.obraId && m.hacia.obraId === h.obraId) throw new ErrorNegocio(`${h.nombre} ya está en esa obra.`);

  const r = await tx.herramienta.updateMany({
    where: { id: h.id, estado: h.estado, obraId: h.obraId, ubicacionId: h.ubicacionId },
    data: {
      estado: m.estado,
      obraId: m.hacia?.obraId ?? null,
      ubicacionId: m.hacia?.ubicacionId ?? null,
      responsableId: m.responsableId ?? null,
      devolucionPrevista: m.devolucionPrevista ?? null,
      ...(m.condicion ? { condicion: m.condicion } : {}),
      ...(m.estado === "BAJA" ? { activo: false } : {}),
    },
  });
  if (!r.count) throw new ErrorNegocio(`${h.nombre} cambió mientras la movías. Probá de nuevo.`);

  const mov = await tx.movimientoHerramienta.create({
    data: {
      herramientaId: h.id, tipo: m.tipo, cantidad: 1, condicion: m.condicion ?? h.condicion,
      desdeObraId: h.obraId, desdeUbicacionId: h.ubicacionId,
      haciaObraId: m.hacia?.obraId ?? null, haciaUbicacionId: m.hacia?.ubicacionId ?? null,
      registradoPorId: m.usuarioId, recibidoPorId: m.recibidoPorId ?? null, viajeId: m.viajeId ?? null,
      observaciones: m.observaciones ?? null,
    },
    select: { id: true },
  });
  const [quien, haciaObra] = await Promise.all([
    tx.usuario.findUnique({ where: { id: m.usuarioId }, select: { nombre: true } }),
    m.hacia?.obraId ? tx.obra.findUnique({ where: { id: m.hacia.obraId }, select: { nombre: true } }) : null,
  ]);
  await auditar(tx, m.usuarioId, `herramienta.${m.tipo.toLowerCase()}`, h.id,
    `${quien?.nombre ?? "Alguien"} ${VERBO[m.tipo](`${h.nombre} (${h.codigo})`, haciaObra?.nombre ?? null)}${m.viajeId ? " al llegar el viaje" : ""}`,
    { estado: h.estado, obraId: h.obraId, responsableId: h.responsableId },
    { estado: m.estado, obraId: m.hacia?.obraId ?? null, movimientoId: mov.id, viajeId: m.viajeId ?? null });

  // Si se pierde o se da de baja, los pedidos para llevarla ya no tienen sentido.
  if (m.estado === "EXTRAVIADA" || m.estado === "BAJA") {
    const pedidos = await tx.pedidoViaje.findMany({ where: { herramientaId: h.id, estado: { in: ["PENDIENTE", "TOMADO"] } }, select: { id: true } });
    for (const p of pedidos) {
      await tx.pedidoViaje.update({ where: { id: p.id }, data: { estado: "CANCELADO", canceladoEn: new Date(), motivoCancelacion: `${h.nombre} ${m.estado === "BAJA" ? "fue dada de baja" : "está extraviada"}` } });
      await quitarDelViaje(tx, p.id, true); // si el viaje llevaba otros pedidos, sigue sin este
    }
  }
  return { movimientoId: mov.id, herramienta: h };
}

/**
 * Al terminar un viaje que llevaba una herramienta: si nadie registró la entrega,
 * se registra sola (entrega desde el depósito o transferencia desde otra obra).
 */
export async function alLlegarElViaje(tx: Tx, p: { usuarioId: string; viajeId: string; herramientaId: string; obraId: string; recibidoPorId: string | null }) {
  const h = await tx.herramienta.findUnique({ where: { id: p.herramientaId }, select: { estado: true, obraId: true, tipoControl: true, nombre: true } });
  if (!h || h.tipoControl !== "UNITARIA" || h.obraId === p.obraId) return null;
  if (h.estado !== "DISPONIBLE" && h.estado !== "EN_OBRA") return null;
  return moverUnitaria(tx, {
    usuarioId: p.usuarioId,
    herramientaId: p.herramientaId,
    tipo: h.estado === "EN_OBRA" ? "TRANSFERENCIA" : "ENTREGA",
    hacia: { obraId: p.obraId },
    responsableId: p.recibidoPorId,
    recibidoPorId: p.recibidoPorId,
    viajeId: p.viajeId,
    estado: "EN_OBRA",
    desde: ["DISPONIBLE", "EN_OBRA"],
    observaciones: "Registrada al terminar el viaje.",
  });
}

export async function siguienteCodigo(tx: Tx) {
  const filas = await tx.herramienta.findMany({ where: { codigo: { startsWith: "SIG-" } }, select: { codigo: true } });
  const max = filas.reduce((a, f) => Math.max(a, Number(f.codigo.slice(4)) || 0), 0);
  return (n = 1) => `SIG-${String(max + n).padStart(4, "0")}`;
}

