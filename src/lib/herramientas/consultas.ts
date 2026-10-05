import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso, type UsuarioSesion } from "@/lib/auth/sesion";
import { diaISO, inicioDelDia } from "@/lib/formato";
import { idsObrasDelUsuario } from "@/lib/alcance";

export const PESTANAS = { maquinaria: "Maquinaria", herramientas: "Herramientas", cantidad: "Por cantidad", sobrantes: "Sobrantes" } as const;
export type Pestana = keyof typeof PESTANAS;

const vencida = (h: { estado: string; devolucionPrevista: Date | null }) => h.estado === "EN_OBRA" && !!h.devolucionPrevista && diaISO(h.devolucionPrevista) < diaISO();

/** Números de arriba: en depósito, en obras, en reparación, devoluciones vencidas (maquinaria y herramientas unitarias). */
export async function cifras() {
  await exigirPermiso("herramientas.ver");
  const base = { activo: true, tipoControl: "UNITARIA" as const };
  const [deposito, obras, reparacion, vencidas] = await Promise.all([
    db.herramienta.count({ where: { ...base, estado: "DISPONIBLE" } }),
    db.herramienta.count({ where: { ...base, estado: "EN_OBRA" } }),
    db.herramienta.count({ where: { ...base, estado: "EN_REPARACION" } }),
    db.herramienta.count({ where: { ...base, estado: "EN_OBRA", devolucionPrevista: { lt: inicioDelDia() } } }),
  ]);
  return { deposito, obras, reparacion, vencidas };
}

export type Fila = {
  id: string; codigo: string; nombre: string; categoria: string; esMaquina: boolean; tipoControl: "UNITARIA" | "CANTIDAD";
  estado: keyof typeof import("./presentacion").ESTADO; donde: string; quien: string | null; devolucionPrevista: Date | null;
  vencida: boolean; condicion: string; total?: number;
};

/** Listado por pestaña, con buscador (nombre o código) y filtro por ubicación ("deposito" o id de obra). */
export async function listar({ tab, q, ubicacion }: { tab: Exclude<Pestana, "sobrantes">; q?: string; ubicacion?: string }): Promise<Fila[]> {
  await exigirPermiso("herramientas.ver");
  const where: Prisma.HerramientaWhereInput = {
    activo: true,
    ...(tab === "cantidad" ? { tipoControl: "CANTIDAD" } : { tipoControl: "UNITARIA", esMaquina: tab === "maquinaria" }),
    ...(q ? { OR: [{ nombre: { contains: q, mode: "insensitive" } }, { codigo: { contains: q.toUpperCase() } }, { marca: { contains: q, mode: "insensitive" } }] } : {}),
  };
  if (ubicacion && tab !== "cantidad") Object.assign(where, ubicacion === "deposito" ? { ubicacionId: { not: null } } : { obraId: ubicacion });
  if (ubicacion && tab === "cantidad") {
    where.existencias = { some: { cantidad: { gt: 0 }, ...(ubicacion === "deposito" ? { ubicacionId: { not: null } } : { obraId: ubicacion }) } };
  }

  const filas = await db.herramienta.findMany({
    where,
    orderBy: [{ nombre: "asc" }, { codigo: "asc" }],
    include: {
      categoria: { select: { nombre: true } },
      obra: { select: { nombre: true } },
      responsable: { select: { nombre: true } },
      existencias: { where: { cantidad: { gt: 0 } }, include: { obra: { select: { nombre: true } } } },
    },
  });
  return filas
    .map((h) => {
      let donde = "—";
      if (h.tipoControl === "CANTIDAD") {
        const dep = h.existencias.filter((e) => e.ubicacionId).reduce((a, e) => a + e.cantidad, 0);
        donde = [dep ? `${dep} en depósito` : null, ...h.existencias.filter((e) => e.obra).map((e) => `${e.cantidad} en ${e.obra!.nombre}`)].filter(Boolean).join(" · ") || "Sin stock";
      } else if (h.estado === "EN_OBRA") donde = `Obra ${h.obra?.nombre}`;
      else if (h.estado === "DISPONIBLE") donde = "Depósito";
      else if (h.estado === "EN_REPARACION") donde = "En el taller";
      else if (h.estado === "EXTRAVIADA") donde = "No se sabe";
      return {
        id: h.id, codigo: h.codigo, nombre: h.nombre, categoria: h.categoria.nombre, esMaquina: h.esMaquina, tipoControl: h.tipoControl,
        estado: h.estado, donde, quien: h.responsable?.nombre ?? null, devolucionPrevista: h.devolucionPrevista,
        vencida: vencida(h), condicion: h.condicion,
        total: h.tipoControl === "CANTIDAD" ? h.existencias.reduce((a, e) => a + e.cantidad, 0) : undefined,
      };
    })
    .sort((a, b) => Number(b.vencida) - Number(a.vencida)); // devoluciones vencidas arriba
}

export async function opciones() {
  await exigirPermiso("herramientas.ver");
  const [obrasConResponsables, personas, categorias, deposito] = await Promise.all([
    db.obra.findMany({ where: { estado: "ACTIVA" }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, responsables: { select: { usuarioId: true, principal: true }, orderBy: [{ principal: "desc" }, { creadoEn: "asc" }] } } }),
    db.usuario.findMany({ where: { activo: true, rol: { in: ["RESPONSABLE_OBRA", "CAPATAZ", "CHOFER", "DIRECCION", "DEPOSITO"] } }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    db.categoriaHerramienta.findMany({ orderBy: { nombre: "asc" } }),
    db.ubicacion.findFirst({ where: { tipo: "DEPOSITO" }, select: { id: true, nombre: true } }),
  ]);
  // responsableId: el principal (quien recibe por defecto); responsablesIds: todos los asignados.
  const obras = obrasConResponsables.map((o) => ({
    id: o.id, nombre: o.nombre, responsableId: o.responsables[0]?.usuarioId ?? "", responsablesIds: o.responsables.map((r) => r.usuarioId),
  }));
  return { obras, personas, categorias, deposito };
}

export async function ficha(id: string) {
  await exigirPermiso("herramientas.ver");
  const h = await db.herramienta.findUnique({
    where: { id },
    include: {
      categoria: true,
      obra: { select: { id: true, nombre: true, responsables: { select: { usuarioId: true, principal: true }, orderBy: [{ principal: "desc" }, { creadoEn: "asc" }] } } },
      ubicacion: { select: { nombre: true } },
      responsable: { select: { id: true, nombre: true } },
      existencias: { include: { obra: { select: { id: true, nombre: true } }, ubicacion: { select: { nombre: true } } }, orderBy: { cantidad: "desc" } },
      movimientos: {
        orderBy: { fecha: "desc" },
        take: 50,
        include: {
          desdeObra: { select: { nombre: true } }, haciaObra: { select: { nombre: true } },
          desdeUbicacion: { select: { nombre: true } }, haciaUbicacion: { select: { nombre: true } },
          registradoPor: { select: { nombre: true } }, recibidoPor: { select: { nombre: true } },
          viaje: { select: { pedidoId: true, chofer: { select: { nombre: true } }, vehiculo: { select: { nombre: true } } } },
        },
      },
      mantenimientos: { orderBy: { fecha: "desc" }, include: { registradoPor: { select: { nombre: true } } } },
      pedidos: {
        where: { estado: { in: ["PENDIENTE", "TOMADO", "EN_VIAJE"] } },
        include: { obra: { select: { nombre: true } }, solicitante: { select: { nombre: true } }, tomadoPor: { select: { nombre: true } } },
      },
    },
  });
  if (!h) return null;
  return {
    ...h,
    valorCompra: h.valorCompra == null ? null : Number(h.valorCompra),
    vencida: vencida(h),
    mantenimientos: h.mantenimientos.map((m) => ({ ...m, costo: Number(m.costo) })),
  };
}

export type FichaHerramienta = NonNullable<Awaited<ReturnType<typeof ficha>>>;

/** Para el depósito: lo que hay que entregar porque alguien lo pidió (y entra o está en la cola de viajes). */
export async function paraEntregar() {
  await exigirPermiso("herramientas.mover");
  return db.pedidoViaje.findMany({
    where: { herramientaId: { not: null }, estado: { in: ["PENDIENTE", "TOMADO", "EN_VIAJE"] }, herramienta: { estado: { not: "EN_OBRA" } } },
    orderBy: [{ prioridad: "desc" }, { paraCuando: "asc" }],
    include: {
      herramienta: { select: { id: true, codigo: true, nombre: true, estado: true } },
      obra: { select: { nombre: true } },
      solicitante: { select: { nombre: true } },
      tomadoPor: { select: { nombre: true } },
    },
  });
}

export async function movimientosDeHoy() {
  await exigirPermiso("herramientas.ver");
  return db.movimientoHerramienta.findMany({
    where: { fecha: { gte: inicioDelDia() } },
    orderBy: { fecha: "desc" },
    include: {
      herramienta: { select: { id: true, nombre: true, codigo: true } },
      haciaObra: { select: { nombre: true } }, desdeObra: { select: { nombre: true } },
      recibidoPor: { select: { nombre: true } }, registradoPor: { select: { nombre: true } },
    },
  });
}

export async function enReparacion() {
  await exigirPermiso("herramientas.ver");
  return db.herramienta.findMany({ where: { activo: true, estado: "EN_REPARACION" }, select: { id: true, nombre: true, codigo: true, actualizadoEn: true } });
}

export async function sobrantes() {
  await exigirPermiso("sobrantes.ver");
  const filas = await db.materialSobrante.findMany({ where: { bajaEn: null }, orderBy: [{ categoria: "asc" }, { descripcion: "asc" }], include: { obraOrigen: { select: { nombre: true } } } });
  return filas.map((s) => ({ ...s, cantidad: Number(s.cantidad) }));
}

/** Responsable/capataz: lo que hay en sus obras y los pedidos que se llevan herramientas de ahí. */
export async function deMisObras(u: UsuarioSesion) {
  await exigirPermiso("herramientas.ver");
  const ids = await idsObrasDelUsuario(u);
  const [unitarias, porCantidad, salen] = await Promise.all([
    db.herramienta.findMany({
      where: { activo: true, estado: "EN_OBRA", obraId: { in: ids } },
      orderBy: [{ devolucionPrevista: "asc" }],
      include: { obra: { select: { nombre: true } }, responsable: { select: { nombre: true } } },
    }),
    db.existenciaHerramienta.findMany({ where: { obraId: { in: ids }, cantidad: { gt: 0 } }, include: { herramienta: { select: { id: true, nombre: true } }, obra: { select: { nombre: true } } } }),
    db.pedidoViaje.findMany({
      where: { herramientaId: { not: null }, origenTipo: "OBRA", origenId: { in: ids }, estado: { in: ["PENDIENTE", "TOMADO", "EN_VIAJE"] } },
      include: { herramienta: { select: { nombre: true } }, obra: { select: { nombre: true } }, solicitante: { select: { nombre: true } } },
    }),
  ]);
  return { unitarias: unitarias.map((h) => ({ ...h, vencida: vencida(h) })), porCantidad, salen };
}

export async function paraEtiquetas(ids?: string[]) {
  await exigirPermiso("herramientas.editar");
  return db.herramienta.findMany({
    where: { activo: true, ...(ids ? { id: { in: ids } } : {}) },
    orderBy: [{ esMaquina: "desc" }, { codigo: "asc" }],
    select: { id: true, codigo: true, nombre: true, esMaquina: true, tipoControl: true, categoria: { select: { nombre: true } } },
  });
}
