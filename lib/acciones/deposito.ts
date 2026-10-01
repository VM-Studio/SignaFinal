"use server";

import { z } from "zod";
import type { Prisma, TipoMovimiento } from "@prisma/client";
import { db } from "@/lib/db";
import { autorizar } from "@/lib/auth/usuario-actual";
import { auditar } from "@/lib/auditoria";
import { ejecutar, ErrorNegocio, type Resultado } from "./resultado";
import { despuesDeCambiar } from "./comun";

type Tx = Prisma.TransactionClient;
const vacioAUndef = (v: unknown) => (v === "" || v === null ? undefined : v);
const textoOpcional = (max = 120) => z.preprocess(vacioAUndef, z.string().trim().max(max).optional());

// ───────────────────────────── Stock por cantidad ─────────────────────────────

async function sumarStock(tx: Tx, itemId: string, obraId: string | null, cantidad: number) {
  const fila = await tx.stockItem.findFirst({ where: { itemId, obraId } });
  if (fila) await tx.stockItem.update({ where: { id: fila.id }, data: { cantidad: { increment: cantidad } } });
  else await tx.stockItem.create({ data: { itemId, obraId, cantidad } });
}

async function restarStock(tx: Tx, itemId: string, obraId: string | null, cantidad: number, donde: string) {
  const r = await tx.stockItem.updateMany({
    where: { itemId, obraId, cantidad: { gte: cantidad } },
    data: { cantidad: { decrement: cantidad } },
  });
  if (r.count === 0) {
    const fila = await tx.stockItem.findFirst({ where: { itemId, obraId }, select: { cantidad: true } });
    throw new ErrorNegocio(`En ${donde} hay ${fila?.cantidad ?? 0}. No alcanza para mover ${cantidad}.`);
  }
}

// ─────────────────────────────── Movimientos ───────────────────────────────

type Movimiento = {
  itemId: string;
  tipo: Extract<TipoMovimiento, "ENTREGA" | "DEVOLUCION" | "TRANSFERENCIA">;
  cantidad: number;
  desdeObraId: string | null;
  haciaObraId: string | null;
  recibidoPorId: string | null;
  solicitudId?: string | null;
  observaciones?: string | null;
};

async function aplicarMovimiento(tx: Tx, usuarioId: string, m: Movimiento) {
  const item = await tx.item.findUnique({ where: { id: m.itemId } });
  if (!item || !item.activo) throw new ErrorNegocio("Ese ítem no existe o está dado de baja.");

  const nombresObras = new Map(
    (await tx.obra.findMany({ where: { id: { in: [m.desdeObraId, m.haciaObraId].filter(Boolean) as string[] } }, select: { id: true, nombre: true } }))
      .map((o) => [o.id, o.nombre]),
  );
  const nombre = (id: string | null) => (id ? `la obra ${nombresObras.get(id)}` : "el depósito");

  if (m.tipo === "ENTREGA" && (m.desdeObraId !== null || !m.haciaObraId)) throw new ErrorNegocio("Una entrega va del depósito a una obra.");
  if (m.tipo === "DEVOLUCION" && (!m.desdeObraId || m.haciaObraId !== null)) throw new ErrorNegocio("Una devolución va de una obra al depósito.");
  if (m.tipo === "TRANSFERENCIA" && (!m.desdeObraId || !m.haciaObraId || m.desdeObraId === m.haciaObraId)) {
    throw new ErrorNegocio("Elegí dos obras distintas.");
  }

  if (item.control === "UNITARIA") {
    if (m.tipo !== "DEVOLUCION" && item.estado !== "OPERATIVO") {
      throw new ErrorNegocio(`${item.nombre} no está operativa. No se puede mandar a obra.`);
    }
    // Cerrojo: solo se mueve si está donde decimos que está.
    const r = await tx.item.updateMany({
      where: { id: item.id, obraId: m.desdeObraId },
      data: { obraId: m.haciaObraId, tenedorId: m.haciaObraId ? m.recibidoPorId : null, ubicadoDesde: new Date() },
    });
    if (r.count === 0) {
      const actual = await tx.item.findUniqueOrThrow({ where: { id: item.id }, select: { obra: { select: { nombre: true } } } });
      throw new ErrorNegocio(`${item.nombre} no está en ${nombre(m.desdeObraId)}: está en ${actual.obra ? `la obra ${actual.obra.nombre}` : "el depósito"}.`);
    }
    m.cantidad = 1;
  } else {
    if (m.cantidad < 1) throw new ErrorNegocio("Poné una cantidad.");
    await restarStock(tx, item.id, m.desdeObraId, m.cantidad, nombre(m.desdeObraId));
    await sumarStock(tx, item.id, m.haciaObraId, m.cantidad);
  }

  const mov = await tx.movimientoItem.create({
    data: {
      itemId: item.id, tipo: m.tipo, cantidad: m.cantidad, desdeObraId: m.desdeObraId, haciaObraId: m.haciaObraId,
      recibidoPorId: m.recibidoPorId, registradoPorId: usuarioId, solicitudId: m.solicitudId ?? null, observaciones: m.observaciones ?? null,
    },
    select: { id: true },
  });
  await auditar(tx, { usuarioId, accion: `deposito.${m.tipo.toLowerCase()}`, entidad: "Item", entidadId: item.id, detalle: { movimientoId: mov.id } });
  return mov;
}

const esquemaMovimiento = z.object({
  itemId: z.string().min(1),
  tipo: z.enum(["ENTREGA", "DEVOLUCION", "TRANSFERENCIA"]),
  cantidad: z.preprocess((v) => (v === "" || v == null ? 1 : v), z.coerce.number().int().min(1, "La cantidad tiene que ser al menos 1.")),
  desdeObraId: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().nullable()),
  haciaObraId: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().nullable()),
  recibidoPorId: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().nullable()),
  observaciones: textoOpcional(300),
});

export type DatosMovimiento = z.input<typeof esquemaMovimiento>;

export async function moverItem(entrada: DatosMovimiento): Promise<Resultado<{ movimientoId: string }>> {
  return ejecutar(async () => {
    const yo = await autorizar("deposito.mover");
    const d = esquemaMovimiento.parse(entrada);
    const mov = await db.$transaction((tx) => aplicarMovimiento(tx, yo.id, { ...d, observaciones: d.observaciones ?? null }));
    despuesDeCambiar();
    return { movimientoId: mov.id };
  });
}

/** Deshacer: registra el movimiento inverso (nada se borra). */
export async function deshacerMovimiento(movimientoId: string): Promise<Resultado<null>> {
  return ejecutar(async () => {
    const yo = await autorizar("deposito.mover");
    const m = await db.movimientoItem.findUniqueOrThrow({ where: { id: movimientoId } });
    if (m.registradoPorId !== yo.id || Date.now() - m.fecha.getTime() > 2 * 60 * 1000) throw new ErrorNegocio("Ya no se puede deshacer.");
    if (m.tipo === "ALTA" || m.tipo === "AJUSTE") throw new ErrorNegocio("Este movimiento no se puede deshacer.");
    const inverso: Movimiento["tipo"] = m.tipo === "ENTREGA" ? "DEVOLUCION" : m.tipo === "DEVOLUCION" ? "ENTREGA" : "TRANSFERENCIA";
    await db.$transaction(async (tx) => {
      await aplicarMovimiento(tx, yo.id, {
        itemId: m.itemId, tipo: inverso, cantidad: m.cantidad, desdeObraId: m.haciaObraId, haciaObraId: m.desdeObraId,
        recibidoPorId: null, observaciones: "Se deshizo el movimiento anterior.",
      });
      if (m.solicitudId) {
        await tx.solicitudHerramienta.update({ where: { id: m.solicitudId }, data: { estado: "PENDIENTE", resueltaEn: null, resueltaPorId: null } });
      }
    });
    despuesDeCambiar();
    return null;
  });
}

// ────────────────────────────────── Ítems ──────────────────────────────────

const esquemaItem = z.object({
  id: z.preprocess(vacioAUndef, z.string().optional()),
  nombre: z.string().trim().min(2, "Poné un nombre.").max(80),
  categoria: z.enum(["MAQUINARIA", "HERRAMIENTA", "SOBRANTE"], { error: "Elegí la categoría." }),
  control: z.enum(["UNITARIA", "CANTIDAD"], { error: "Elegí cómo se controla." }),
  marca: textoOpcional(40),
  modelo: textoOpcional(40),
  numeroSerie: textoOpcional(60),
  unidad: textoOpcional(20),
  cantidadInicial: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().int().min(0)),
  notas: textoOpcional(500),
});

export type DatosItem = z.input<typeof esquemaItem>;

async function siguienteCodigo(tx: Tx, categoria: string, control: string) {
  const prefijo = control === "CANTIDAD" ? (categoria === "SOBRANTE" ? "SO" : "CA") : categoria === "MAQUINARIA" ? "MQ" : "HE";
  const ultimo = await tx.item.findFirst({ where: { codigo: { startsWith: `${prefijo}-` } }, orderBy: { codigo: "desc" }, select: { codigo: true } });
  const n = ultimo ? Number(ultimo.codigo.split("-")[1]) + 1 : 1;
  return `${prefijo}-${String(n).padStart(4, "0")}`;
}

export async function guardarItem(entrada: DatosItem): Promise<Resultado<{ id: string }>> {
  return ejecutar(async () => {
    const yo = await autorizar("deposito.editar");
    const { id, cantidadInicial, ...d } = esquemaItem.parse(entrada);
    const datos = {
      nombre: d.nombre, categoria: d.categoria, marca: d.marca ?? null, modelo: d.modelo ?? null,
      numeroSerie: d.numeroSerie ?? null, unidad: d.control === "CANTIDAD" ? d.unidad ?? "unidades" : null, notas: d.notas ?? null,
    };
    const r = await db.$transaction(async (tx) => {
      if (id) {
        const it = await tx.item.update({ where: { id }, data: datos, select: { id: true } });
        await auditar(tx, { usuarioId: yo.id, accion: "item.editar", entidad: "Item", entidadId: id });
        return it;
      }
      const codigo = await siguienteCodigo(tx, d.categoria, d.control);
      const it = await tx.item.create({ data: { ...datos, codigo, control: d.control }, select: { id: true } });
      if (d.control === "CANTIDAD" && cantidadInicial > 0) {
        await tx.stockItem.create({ data: { itemId: it.id, obraId: null, cantidad: cantidadInicial } });
      }
      await tx.movimientoItem.create({
        data: { itemId: it.id, tipo: "ALTA", cantidad: d.control === "CANTIDAD" ? Math.max(cantidadInicial, 1) : 1, registradoPorId: yo.id },
      });
      await auditar(tx, { usuarioId: yo.id, accion: "item.crear", entidad: "Item", entidadId: it.id });
      return it;
    });
    despuesDeCambiar();
    return r;
  });
}

export async function cambiarEstadoItem(id: string, estado: "OPERATIVO" | "EN_REPARACION" | "FUERA_DE_SERVICIO"): Promise<Resultado<null>> {
  return ejecutar(async () => {
    const yo = await autorizar("deposito.editar");
    await db.item.update({ where: { id }, data: { estado } });
    await auditar(db, { usuarioId: yo.id, accion: "item.estado", entidad: "Item", entidadId: id, detalle: { estado } });
    despuesDeCambiar();
    return null;
  });
}

export async function ajustarStock(itemId: string, obraId: string | null, cantidadReal: number, motivo: string): Promise<Resultado<null>> {
  return ejecutar(async () => {
    const yo = await autorizar("deposito.editar");
    if (!Number.isInteger(cantidadReal) || cantidadReal < 0) throw new ErrorNegocio("La cantidad tiene que ser un número entero.");
    if (motivo.trim().length < 3) throw new ErrorNegocio("Contá por qué se ajusta.");
    await db.$transaction(async (tx) => {
      const fila = await tx.stockItem.findFirst({ where: { itemId, obraId } });
      const previa = fila?.cantidad ?? 0;
      if (previa === cantidadReal) return;
      if (fila) await tx.stockItem.update({ where: { id: fila.id }, data: { cantidad: cantidadReal } });
      else await tx.stockItem.create({ data: { itemId, obraId, cantidad: cantidadReal } });
      await tx.movimientoItem.create({
        data: {
          itemId, tipo: "AJUSTE", cantidad: Math.abs(cantidadReal - previa),
          desdeObraId: cantidadReal < previa ? obraId : null, haciaObraId: cantidadReal > previa ? obraId : null,
          registradoPorId: yo.id, observaciones: `${previa} → ${cantidadReal}. ${motivo.trim()}`,
        },
      });
    });
    despuesDeCambiar();
    return null;
  });
}

export async function cambiarActivoItem(id: string, activo: boolean): Promise<Resultado<null>> {
  return ejecutar(async () => {
    const yo = await autorizar("deposito.editar");
    const item = await db.item.findUniqueOrThrow({ where: { id }, select: { obraId: true, control: true, stock: { where: { obraId: { not: null }, cantidad: { gt: 0 } } } } });
    if (!activo && (item.obraId || item.stock.length)) throw new ErrorNegocio("Primero tiene que volver todo al depósito.");
    await db.item.update({ where: { id }, data: { activo } });
    await auditar(db, { usuarioId: yo.id, accion: activo ? "item.reactivar" : "item.desactivar", entidad: "Item", entidadId: id });
    despuesDeCambiar();
    return null;
  });
}

// ─────────────────────────── Solicitudes de obra ───────────────────────────

const esquemaSolicitud = z.object({
  tipo: z.enum(["PEDIDO", "DEVOLUCION"]),
  itemId: z.string().min(1, "Elegí qué herramienta."),
  obraId: z.string().min(1, "Elegí la obra."),
  cantidad: z.preprocess((v) => (v === "" || v == null ? 1 : v), z.coerce.number().int().min(1)),
  observaciones: textoOpcional(300),
});

export type DatosSolicitud = z.input<typeof esquemaSolicitud>;

export async function crearSolicitud(entrada: DatosSolicitud): Promise<Resultado<null>> {
  return ejecutar(async () => {
    const yo = await autorizar("herramientas.solicitar");
    const d = esquemaSolicitud.parse(entrada);
    if (yo.rol === "RESPONSABLE_OBRA") {
      const esMia = await db.obra.count({ where: { id: d.obraId, responsables: { some: { id: yo.id } } } });
      if (!esMia) throw new ErrorNegocio("Esa obra no es tuya.");
    }
    const item = await db.item.findUniqueOrThrow({ where: { id: d.itemId }, select: { control: true, obraId: true, nombre: true, estado: true, stock: true } });
    if (d.tipo === "PEDIDO" && item.control === "UNITARIA" && item.obraId) throw new ErrorNegocio(`${item.nombre} ya está en una obra.`);
    if (d.tipo === "PEDIDO" && item.estado !== "OPERATIVO") throw new ErrorNegocio(`${item.nombre} no está operativa ahora.`);
    if (d.tipo === "DEVOLUCION") {
      if (item.control === "UNITARIA" && item.obraId !== d.obraId) throw new ErrorNegocio(`${item.nombre} no está en esa obra.`);
      if (item.control === "CANTIDAD") {
        const hay = item.stock.find((s) => s.obraId === d.obraId)?.cantidad ?? 0;
        if (hay < d.cantidad) throw new ErrorNegocio(`En la obra hay ${hay}. No se pueden devolver ${d.cantidad}.`);
      }
    }
    const pendiente = await db.solicitudHerramienta.count({ where: { itemId: d.itemId, obraId: d.obraId, tipo: d.tipo, estado: "PENDIENTE" } });
    if (pendiente) throw new ErrorNegocio("Ya hay una solicitud igual pendiente.");
    await db.solicitudHerramienta.create({
      data: { ...d, observaciones: d.observaciones ?? null, cantidad: item.control === "UNITARIA" ? 1 : d.cantidad, solicitanteId: yo.id },
    });
    despuesDeCambiar();
    return null;
  });
}

export async function cancelarSolicitud(id: string): Promise<Resultado<null>> {
  return ejecutar(async () => {
    const yo = await autorizar("herramientas.solicitar");
    const r = await db.solicitudHerramienta.updateMany({ where: { id, solicitanteId: yo.id, estado: "PENDIENTE" }, data: { estado: "CANCELADA", resueltaEn: new Date() } });
    if (r.count === 0) throw new ErrorNegocio("Ya no se puede cancelar.");
    despuesDeCambiar();
    return null;
  });
}

export async function rechazarSolicitud(id: string, motivo: string): Promise<Resultado<null>> {
  return ejecutar(async () => {
    const yo = await autorizar("deposito.mover");
    if (motivo.trim().length < 3) throw new ErrorNegocio("Contá por qué no se puede.");
    const r = await db.solicitudHerramienta.updateMany({
      where: { id, estado: "PENDIENTE" },
      data: { estado: "RECHAZADA", motivoRechazo: motivo.trim(), resueltaPorId: yo.id, resueltaEn: new Date() },
    });
    if (r.count === 0) throw new ErrorNegocio("Esta solicitud ya fue resuelta.");
    despuesDeCambiar();
    return null;
  });
}

/** El depósito entrega lo pedido o recibe lo devuelto: un toque. */
export async function completarSolicitud(id: string): Promise<Resultado<{ movimientoId: string }>> {
  return ejecutar(async () => {
    const yo = await autorizar("deposito.mover");
    const mov = await db.$transaction(async (tx) => {
      const s = await tx.solicitudHerramienta.findUniqueOrThrow({ where: { id } });
      if (s.estado !== "PENDIENTE") throw new ErrorNegocio("Esta solicitud ya fue resuelta.");
      const m = await aplicarMovimiento(tx, yo.id, {
        itemId: s.itemId,
        tipo: s.tipo === "PEDIDO" ? "ENTREGA" : "DEVOLUCION",
        cantidad: s.cantidad,
        desdeObraId: s.tipo === "PEDIDO" ? null : s.obraId,
        haciaObraId: s.tipo === "PEDIDO" ? s.obraId : null,
        recibidoPorId: s.tipo === "PEDIDO" ? s.solicitanteId : yo.id,
        solicitudId: s.id,
      });
      await tx.solicitudHerramienta.update({ where: { id }, data: { estado: "COMPLETADA", resueltaPorId: yo.id, resueltaEn: new Date() } });
      return m;
    });
    despuesDeCambiar();
    return { movimientoId: mov.id };
  });
}
