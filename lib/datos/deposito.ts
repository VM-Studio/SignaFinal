import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { SolicitudPlana } from "@/components/deposito/solicitudes";

export async function solicitudes(where: Prisma.SolicitudHerramientaWhereInput, take = 50): Promise<SolicitudPlana[]> {
  const filas = await db.solicitudHerramienta.findMany({
    where,
    orderBy: { creadaEn: "asc" },
    take,
    include: {
      item: { select: { nombre: true, unidad: true, control: true } },
      obra: { select: { nombre: true } },
      solicitante: { select: { nombre: true } },
    },
  });
  return filas.map((s) => ({
    id: s.id,
    tipo: s.tipo,
    estado: s.estado,
    cantidad: s.cantidad,
    unidad: s.item.unidad,
    control: s.item.control,
    item: s.item.nombre,
    obra: s.obra.nombre,
    solicitante: s.solicitante.nombre,
    observaciones: s.observaciones,
    motivoRechazo: s.motivoRechazo,
    creadaEn: s.creadaEn.toISOString(),
  }));
}

/** Inventario con dónde está cada cosa. */
export async function inventario(filtro: { q?: string; donde?: string; categoria?: string } = {}) {
  const items = await db.item.findMany({
    where: {
      activo: true,
      ...(filtro.categoria ? { categoria: filtro.categoria as Prisma.EnumCategoriaItemFilter["equals"] } : {}),
      ...(filtro.q ? { OR: [{ nombre: { contains: filtro.q, mode: "insensitive" } }, { marca: { contains: filtro.q, mode: "insensitive" } }, { codigo: { equals: filtro.q.toUpperCase() } }] } : {}),
    },
    orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
    include: {
      obra: { select: { id: true, nombre: true } },
      tenedor: { select: { nombre: true } },
      stock: { where: { cantidad: { gt: 0 } }, include: { obra: { select: { id: true, nombre: true } } } },
    },
  });

  const lista = items.map((i) => {
    const enDeposito = i.control === "UNITARIA" ? (i.obraId ? 0 : 1) : i.stock.filter((s) => !s.obraId).reduce((a, s) => a + s.cantidad, 0);
    const enObras =
      i.control === "UNITARIA"
        ? i.obra
          ? [{ obraId: i.obra.id, obra: i.obra.nombre, cantidad: 1 }]
          : []
        : i.stock.filter((s) => s.obra).map((s) => ({ obraId: s.obra!.id, obra: s.obra!.nombre, cantidad: s.cantidad }));
    return {
      id: i.id,
      codigo: i.codigo,
      nombre: i.nombre,
      categoria: i.categoria,
      control: i.control,
      marca: [i.marca, i.modelo].filter(Boolean).join(" "),
      unidad: i.unidad,
      estado: i.estado,
      tenedor: i.tenedor?.nombre ?? null,
      ubicadoDesde: i.ubicadoDesde,
      enDeposito,
      enObras,
      total: enDeposito + enObras.reduce((a, o) => a + o.cantidad, 0),
    };
  });

  if (filtro.donde === "deposito") return lista.filter((i) => i.enDeposito > 0);
  if (filtro.donde === "obras") return lista.filter((i) => i.enObras.length > 0);
  if (filtro.donde) return lista.filter((i) => i.enObras.some((o) => o.obraId === filtro.donde));
  return lista;
}

export type ItemInventario = Awaited<ReturnType<typeof inventario>>[number];
