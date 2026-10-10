import "server-only";
import type { EstadoMaterial, EstadoMaterialListo, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso, exigirSesion, type UsuarioSesion } from "@/lib/auth/sesion";
import { filtroObras, obrasDelUsuario } from "@/lib/alcance";
import { puede } from "@/lib/permisos";
import { hora } from "@/lib/formato";
import { adjuntosDe } from "@/lib/archivos";
import { proveedoresConSucursales } from "@/lib/proveedores/consultas";
import { demorado, PESTANAS_COMPRAS, type PestanaCompras } from "./presentacion";

/**
 * Qué pedidos de material ve cada uno. TODA query de materiales pasa por acá.
 * Compras y Dirección: todos. Responsable de obra: los de sus obras. Capataz: todas las obras.
 * El resto: ninguno.
 */
export function materialesVisibles(u: Pick<UsuarioSesion, "id" | "rol">): Prisma.PedidoMaterialWhereInput {
  if (puede(u.rol, "materiales.gestionar")) return {};
  if (puede(u.rol, "materiales.pedir")) return { OR: [{ solicitanteId: u.id }, { obra: filtroObras(u) }] };
  return { id: "-" };
}

const conAlcance = (u: Pick<UsuarioSesion, "id" | "rol">, where: Prisma.PedidoMaterialWhereInput = {}): Prisma.PedidoMaterialWhereInput => ({ AND: [materialesVisibles(u), where] });

/** Cuándo entró al estado actual (el último cambio). */
const ultimoCambio = { cambios: { orderBy: { fecha: "desc" as const }, take: 1, select: { fecha: true } } };

const filaInclude = {
  obra: { select: { nombre: true } },
  solicitante: { select: { nombre: true } },
  tomadoPor: { select: { nombre: true } },
  ...ultimoCambio,
  materialesListos: {
    where: { estado: { not: "CANCELADO" as EstadoMaterialListo } },
    orderBy: { habilitadoEn: "asc" as const },
    select: {
      id: true, estado: true, proveedor: { select: { nombre: true } },
      pedidoViaje: { select: { id: true, viaje: { select: { etaDestino: true, llegadaReal: true } } } },
    },
  },
} satisfies Prisma.PedidoMaterialInclude;

type FilaDb = Prisma.PedidoMaterialGetPayload<{ include: typeof filaInclude }>;

export type FilaMaterial = {
  id: string; numero: number; descripcion: string; obraId: string; obra: string; solicitante: string; comprador: string | null;
  estado: EstadoMaterial; prioridad: "NORMAL" | "URGENTE"; paraCuando: string; enEstadoDesde: string; demorado: boolean;
  ordenCompra: string | null; monto: number | null;
  /** Para la frase del que pidió: dónde retirar y a qué hora llega. */
  proveedorListo: string | null; llega: string | null; listoId: string | null;
  /** Para la cola de Compras: clip con cuántos archivos y si trae observaciones. */
  adjuntos: number; conNota: boolean;
};

function aFila(p: FilaDb): FilaMaterial {
  const desde = p.cambios[0]?.fecha ?? p.creadoEn;
  const listo = p.materialesListos.find((m) => m.estado === "LISTO");
  const enCamino = p.materialesListos.find((m) => m.estado === "EN_CAMINO");
  const eta = enCamino?.pedidoViaje?.viaje?.etaDestino;
  return {
    id: p.id, numero: p.numero, descripcion: p.descripcion, obraId: p.obraId, obra: p.obra.nombre, solicitante: p.solicitante.nombre, comprador: p.tomadoPor?.nombre ?? null,
    estado: p.estado, prioridad: p.prioridad, paraCuando: p.paraCuando.toISOString(), enEstadoDesde: desde.toISOString(), demorado: demorado(p.estado, desde),
    ordenCompra: p.ordenCompraNumero, monto: p.montoAprobado ? p.montoAprobado.toNumber() : null,
    proveedorListo: listo?.proveedor.nombre ?? null, listoId: listo?.id ?? null, llega: eta ? hora(eta) : null,
    adjuntos: 0, conNota: !!p.observaciones?.trim(),
  };
}

/** Cuántos archivos (visibles para quien mira) tiene cada pedido de la lista. */
async function conAdjuntos(filas: FilaMaterial[], internos: boolean) {
  if (!filas.length) return filas;
  const n = await db.adjunto.groupBy({ by: ["entidadId"], where: { entidadTipo: "PEDIDO_MATERIAL", entidadId: { in: filas.map((f) => f.id) }, ...(internos ? {} : { interno: false }) }, _count: true });
  const m = new Map(n.map((x) => [x.entidadId, x._count]));
  return filas.map((f) => ({ ...f, adjuntos: m.get(f.id) ?? 0 }));
}

/** Urgentes primero, después para cuándo. */
const ORDEN_COLA: Prisma.PedidoMaterialOrderByWithRelationInput[] = [{ prioridad: "desc" }, { paraCuando: "asc" }, { creadoEn: "asc" }];

// ═══════════════════════════ Compras ═══════════════════════════

export async function colaCompras(pestana: PestanaCompras, obraId: string | undefined, limite: number) {
  const u = await exigirPermiso("materiales.gestionar");
  const porObra: Prisma.PedidoMaterialWhereInput = obraId ? { obraId } : {};
  const [filas, conteos, obras] = await Promise.all([
    db.pedidoMaterial.findMany({
      where: conAlcance(u, { ...porObra, estado: { in: [...PESTANAS_COMPRAS[pestana].estados] } }),
      include: filaInclude, orderBy: ORDEN_COLA, take: limite + 1,
    }),
    db.pedidoMaterial.groupBy({ by: ["estado"], where: conAlcance(u, porObra), _count: true }),
    db.obra.findMany({ where: { pedidosMaterial: { some: {} } }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
  ]);
  const n = new Map(conteos.map((c) => [c.estado, c._count]));
  const cuantos = Object.fromEntries(
    (Object.keys(PESTANAS_COMPRAS) as PestanaCompras[]).map((k) => [k, PESTANAS_COMPRAS[k].estados.reduce((s, e) => s + (n.get(e) ?? 0), 0)]),
  ) as Record<PestanaCompras, number>;
  return { filas: await conAdjuntos(filas.slice(0, limite).map(aFila), true), hayMas: filas.length > limite, cuantos, obras };
}

/** Inicio de Compras: cuántos hay en cada paso y los que están demorados. */
export async function resumenCompras() {
  const u = await exigirPermiso("materiales.gestionar");
  const activos = await db.pedidoMaterial.findMany({
    where: conAlcance(u, { estado: { in: ["SOLICITADO", "EN_COMPRA", "ESPERANDO_APROBACION", "APROBADO"] } }),
    include: filaInclude, orderBy: ORDEN_COLA,
  });
  const filas = activos.map(aFila);
  const sinRetirar = await db.materialListo.count({ where: { estado: "LISTO", habilitadoEn: { lt: new Date(Date.now() - 3 * 86_400_000) } } });
  return {
    nuevos: filas.filter((f) => f.estado === "SOLICITADO"),
    enCompra: filas.filter((f) => f.estado === "EN_COMPRA").length,
    esperando: filas.filter((f) => f.estado === "ESPERANDO_APROBACION").length,
    aprobados: filas.filter((f) => f.estado === "APROBADO").length,
    demorados: filas.filter((f) => f.demorado),
    sinRetirar,
  };
}

/** Detalle con todo lo que hace falta para la acción que sigue. */
export async function detalleMaterial(id: string) {
  const u = await exigirSesion();
  const p = await db.pedidoMaterial.findFirst({
    where: conAlcance(u, { id }),
    include: {
      obra: { select: { id: true, nombre: true, direccion: true, localidad: true, latitud: true, longitud: true } },
      obraSede: { select: { nombre: true, latitud: true, longitud: true } },
      solicitante: { select: { id: true, nombre: true, telefono: true } },
      tomadoPor: { select: { nombre: true } },
      aprobadoPor: { select: { nombre: true } },
      cambios: { orderBy: { fecha: "asc" }, include: { usuario: { select: { nombre: true } } } },
      materialesListos: {
        orderBy: { habilitadoEn: "asc" },
        include: {
          proveedor: { select: { id: true, nombre: true, telefono: true } },
          habilitadoPor: { select: { nombre: true } },
          pedidoViaje: { select: { id: true, numero: true, estado: true, tomadoPor: { select: { nombre: true } }, viaje: { select: { etaDestino: true, llegadaReal: true } } } },
        },
      },
    },
  });
  if (!p) return null;
  const { montoAprobado, cantidad, notasCompras, ...resto } = p;
  const internos = puede(u.rol, "materiales.gestionar") || puede(u.rol, "materiales.aprobar");
  return {
    ...resto,
    // Las notas internas de Compras no salen del servidor para el que pidió.
    notasCompras: internos ? notasCompras : null,
    renglones: (Array.isArray(p.renglones) ? p.renglones : []) as { descripcion: string; cantidad: number | null; unidad: string | null }[],
    adjuntos: await adjuntosDe("PEDIDO_MATERIAL", p.id, internos),
    // Ningún Decimal cruza a un Client Component.
    monto: montoAprobado ? montoAprobado.toNumber() : null,
    cantidad: cantidad ? cantidad.toNumber() : null,
    esMio: p.solicitanteId === u.id,
    gestiona: puede(u.rol, "materiales.gestionar"),
    aprueba: puede(u.rol, "materiales.aprobar"),
  };
}
export type DetalleMaterial = NonNullable<Awaited<ReturnType<typeof detalleMaterial>>>;

/** Proveedores (con sus sucursales) para la hoja "Habilitar para retirar". */
export async function proveedoresParaHabilitar() {
  await exigirPermiso("materiales.gestionar");
  return proveedoresConSucursales();
}

/** Habilitados por estado, con hace cuánto (Compras ve lo que quedó colgado del lado de la obra). */
export async function habilitados(estado: EstadoMaterialListo, limite: number) {
  await exigirPermiso("materiales.gestionar");
  const [filas, conteos] = await Promise.all([
    db.materialListo.findMany({
      where: { estado },
      orderBy: estado === "ENTREGADO" ? { entregadoEn: "desc" } : { habilitadoEn: "asc" },
      take: limite + 1,
      include: {
        obra: { select: { nombre: true } }, proveedor: { select: { nombre: true } },
        pedidoMaterial: { select: { id: true, numero: true, solicitante: { select: { nombre: true } } } },
        pedidoViaje: { select: { numero: true, tomadoPor: { select: { nombre: true } }, viaje: { select: { etaDestino: true } } } },
      },
    }),
    db.materialListo.groupBy({ by: ["estado"], _count: true }),
  ]);
  return { filas: filas.slice(0, limite), hayMas: filas.length > limite, cuantos: Object.fromEntries(conteos.map((c) => [c.estado, c._count])) as Partial<Record<EstadoMaterialListo, number>> };
}

/** Aprobaciones del dueño. */
export async function paraAprobar() {
  await exigirPermiso("materiales.aprobar");
  const filas = await db.pedidoMaterial.findMany({
    where: { estado: "ESPERANDO_APROBACION" },
    orderBy: ORDEN_COLA,
    include: { ...filaInclude },
  });
  return filas.map(aFila);
}

// ═══════════════════════════ Obra ═══════════════════════════

/** Mis pedidos, pestaña Materiales: los propios y los de mis obras. */
export async function misMateriales(limite: number) {
  const u = await exigirPermiso("materiales.pedir");
  const filas = await db.pedidoMaterial.findMany({
    where: conAlcance(u, { OR: [{ estado: { notIn: ["ENTREGADO", "CANCELADO"] } }, { actualizadoEn: { gte: new Date(Date.now() - 14 * 86_400_000) } }] }),
    include: filaInclude,
    // Lo listo para retirar arriba: es lo único que le pide una acción.
    orderBy: [{ actualizadoEn: "desc" }],
    take: limite + 1,
  });
  const todas = filas.slice(0, limite).map(aFila);
  const peso = (f: FilaMaterial) => (f.listoId ? 0 : f.estado === "ENTREGADO" || f.estado === "CANCELADO" ? 2 : 1);
  return { filas: todas.sort((a, b) => peso(a) - peso(b)), hayMas: filas.length > limite };
}

/** Datos del formulario "Pedir materiales". */
export async function datosPedirMateriales() {
  const u = await exigirPermiso("materiales.pedir");
  const [obras, responsables] = await Promise.all([
    db.obra.findMany({
      where: { estado: "ACTIVA", ...filtroObras(u) },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, localidad: true, sedes: { where: { activa: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } } },
    }),
    puede(u.rol, "obras.cargar") ? db.usuario.findMany({ where: { rol: { in: ["RESPONSABLE_OBRA", "CAPATAZ"] }, activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }) : Promise.resolve([]),
  ]);
  return { obras, puedeCrearObra: puede(u.rol, "obras.cargar"), responsables };
}

/** Compras carga un pedido que le pidieron por teléfono: todas las obras y quién lo pidió en cada una. */
export async function datosNuevoPedidoCompras() {
  await exigirPermiso("materiales.gestionar");
  const [obras, capataces, responsables] = await Promise.all([
    db.obra.findMany({
      where: { estado: "ACTIVA" }, orderBy: { nombre: "asc" },
      select: {
        id: true, nombre: true, localidad: true, sedes: { where: { activa: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } },
        responsables: { where: { activo: true }, orderBy: [{ principal: "desc" }, { creadoEn: "asc" }], select: { usuario: { select: { id: true, nombre: true } } } },
      },
    }),
    db.usuario.findMany({ where: { rol: "CAPATAZ", activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    db.usuario.findMany({ where: { rol: { in: ["RESPONSABLE_OBRA", "CAPATAZ"] }, activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);
  return {
    obras: obras.map(({ responsables: r, ...o }) => {
      const personas = [...r.map((x) => x.usuario), ...capataces];
      return { ...o, personas: [...new Map(personas.map((p) => [p.id, p])).values()] };
    }),
    responsables,
  };
}

/** Lo listo para retirar de una obra (pedir el viaje de retiro). */
export async function listosParaRetirar(obraId: string) {
  const u = await exigirPermiso("pedidos.crear");
  const filas = await db.materialListo.findMany({
    where: { obraId, estado: "LISTO", modoEntrega: "RETIRA_CHOFER", pedidoMaterial: materialesVisibles(u) },
    orderBy: { habilitadoEn: "asc" },
    include: { proveedor: { select: { id: true, nombre: true } } },
  });
  return filas.map((m) => ({
    id: m.id, proveedorId: m.proveedorId, proveedor: m.proveedor.nombre, descripcion: m.descripcion, pesoKg: m.pesoKg,
    habilitadoEn: m.habilitadoEn.toISOString(), horario: m.horarioRetiro, ordenCompra: m.ordenCompraNumero,
  }));
}
export type ListoParaRetirar = Awaited<ReturnType<typeof listosParaRetirar>>[number];

/** Pedir → Retiro en proveedor: mis obras y lo listo en cada una. */
export async function datosRetiro() {
  const u = await exigirPermiso("pedidos.crear");
  const obras = (await obrasDelUsuario(u)).map((o) => ({ id: o.id, nombre: o.nombre }));
  const listos = await Promise.all(obras.map(async (o) => [o.id, await listosParaRetirar(o.id)] as const));
  return { obras, listos: Object.fromEntries(listos) as Record<string, ListoParaRetirar[]> };
}

/** Inicio de obra: cuántos materiales listos para retirar hay en mis obras. */
export async function listosEnMisObras() {
  const u = await exigirPermiso("materiales.pedir");
  return db.materialListo.count({ where: { estado: "LISTO", modoEntrega: "RETIRA_CHOFER", pedidoMaterial: materialesVisibles(u) } });
}

/** Inicio del dueño: cuántas órdenes de compra esperan su aprobación. */
export async function cuantasParaAprobar() {
  await exigirPermiso("materiales.aprobar");
  return db.pedidoMaterial.count({ where: { estado: "ESPERANDO_APROBACION" } });
}
