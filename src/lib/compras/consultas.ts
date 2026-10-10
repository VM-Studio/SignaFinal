import "server-only";
import type { EstadoOC, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso, exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { adjuntosDe } from "@/lib/archivos";
import { proveedoresConSucursales } from "@/lib/proveedores/consultas";
import { diaISO } from "@/lib/formato";
import { incluirOC, type OCCompleta } from "./servicio";

const n = (d: Prisma.Decimal | null | undefined) => (d == null ? null : d.toNumber());

/** OC plana (sin Decimal ni Date) para pasar a un componente cliente. */
export function ocPlana(oc: OCCompleta, conInternas: boolean) {
  return {
    id: oc.id, numero: oc.numero, estado: oc.estado, version: oc.version,
    fecha: diaISO(oc.fecha), fechaNecesaria: oc.fechaNecesaria ? diaISO(oc.fechaNecesaria) : null,
    proveedorId: oc.proveedorId, sucursalId: oc.sucursalId,
    proveedor: oc.proveedor?.nombre ?? null, sucursal: oc.sucursal ? { nombre: oc.sucursal.nombre, direccion: `${oc.sucursal.direccion}, ${oc.sucursal.localidad}`, horario: oc.sucursal.horarioRetiro, contacto: oc.sucursal.contacto, telefono: oc.sucursal.telefono } : null,
    metodoPago: oc.metodoPago, moneda: oc.moneda, condiciones: oc.condiciones, observaciones: oc.observaciones,
    notasInternas: conInternas ? oc.notasInternas : null,
    ivaPorcentaje: n(oc.ivaPorcentaje), subtotal: n(oc.subtotal), iva: n(oc.iva), total: n(oc.total),
    renglones: oc.renglones.map((r) => ({ descripcion: r.descripcion, cantidad: r.cantidad.toNumber(), unidad: r.unidad, precioUnitario: n(r.precioUnitario), subtotal: n(r.subtotal) })),
    obra: oc.obra.nombre, solicitante: oc.solicitante.nombre, creadaPor: oc.creadaPor.nombre,
    enviadaEn: oc.enviadaEn?.toISOString() ?? null, aprobadaPor: oc.aprobadaPor?.nombre ?? null, aprobadaEn: oc.aprobadaEn?.toISOString() ?? null,
    motivoRechazo: oc.motivoRechazo, motivoAnulacion: oc.motivoAnulacion, pedidoMaterialId: oc.pedidoMaterialId,
  };
}
export type OCPlana = ReturnType<typeof ocPlana>;

/** Todo lo que necesita el formulario de la OC: el pedido (para copiar datos), el borrador y los proveedores. */
export async function formularioOC(pedidoId: string) {
  const u = await exigirPermiso("materiales.gestionar");
  const p = await db.pedidoMaterial.findUnique({
    where: { id: pedidoId },
    include: {
      obra: { select: { nombre: true, direccion: true, localidad: true, latitud: true, longitud: true } },
      obraSede: { select: { nombre: true, direccion: true, localidad: true, latitud: true, longitud: true } },
      solicitante: { select: { nombre: true } },
      ordenesCompra: { orderBy: { creadoEn: "desc" }, include: incluirOC },
    },
  });
  if (!p) return null;
  const borrador = p.ordenesCompra.find((o) => o.id === p.ordenCompraId && o.estado === "BORRADOR") ?? null;
  const [adjuntosPedido, adjuntosOC, proveedores] = await Promise.all([
    adjuntosDe("PEDIDO_MATERIAL", p.id, true),
    borrador ? adjuntosDe("ORDEN_COMPRA", borrador.id, true) : Promise.resolve([]),
    proveedoresConSucursales(),
  ]);
  return {
    yo: u.nombre,
    pedido: {
      id: p.id, numero: p.numero, estado: p.estado, descripcion: p.descripcion, observaciones: p.observaciones, notasCompras: p.notasCompras,
      obra: p.obra.nombre, sede: p.obraSede?.nombre ?? null, solicitante: p.solicitante.nombre, paraCuando: diaISO(p.paraCuando),
      destino: p.obraSede ? { lat: p.obraSede.latitud, lng: p.obraSede.longitud } : { lat: p.obra.latitud, lng: p.obra.longitud },
      direccionEntrega: p.obraSede ? `${p.obraSede.direccion}, ${p.obraSede.localidad}` : `${p.obra.direccion}, ${p.obra.localidad}`,
      renglones: (Array.isArray(p.renglones) ? p.renglones : []) as { descripcion: string; cantidad: number | null; unidad: string | null }[],
    },
    adjuntosPedido, adjuntosOC,
    borrador: borrador ? ocPlana(borrador, true) : null,
    anteriores: p.ordenesCompra.filter((o) => o.estado === "RECHAZADA" || o.estado === "ANULADA").map((o) => ocPlana(o, true)),
    proveedores,
  };
}
export type FormularioOCDatos = NonNullable<Awaited<ReturnType<typeof formularioOC>>>;

/** La OC vigente y el historial de un pedido, para el detalle (sin notas internas para el que pidió). */
export async function ocsDePedido(pedidoId: string) {
  const u = await exigirSesion();
  const gestiona = puede(u.rol, "materiales.gestionar") || puede(u.rol, "materiales.aprobar");
  const ocs = await db.ordenCompra.findMany({ where: { pedidoMaterialId: pedidoId, ...(gestiona ? {} : { estado: "APROBADA" }) }, orderBy: { creadoEn: "desc" }, include: incluirOC });
  return Promise.all(ocs.map(async (o) => ({ ...ocPlana(o, gestiona), adjuntos: gestiona ? await adjuntosDe("ORDEN_COMPRA", o.id, true) : [] })));
}

export type FiltroOC = { q?: string; estado?: string; desde?: string; hasta?: string };

function whereOC(f: FiltroOC): Prisma.OrdenCompraWhereInput {
  const q = f.q?.trim();
  const estados: EstadoOC[] = ["BORRADOR", "ESPERANDO_APROBACION", "APROBADA", "RECHAZADA", "ANULADA"];
  return {
    ...(f.estado && estados.includes(f.estado as EstadoOC) ? { estado: f.estado as EstadoOC } : { estado: { not: "BORRADOR" } }),
    ...(f.desde || f.hasta ? { fecha: { ...(f.desde ? { gte: new Date(`${f.desde}T00:00:00-03:00`) } : {}), ...(f.hasta ? { lte: new Date(`${f.hasta}T23:59:59-03:00`) } : {}) } } : {}),
    ...(q ? { OR: [{ numero: { contains: q, mode: "insensitive" } }, { proveedor: { nombre: { contains: q, mode: "insensitive" } } }, { obra: { nombre: { contains: q, mode: "insensitive" } } }] } : {}),
  };
}

/** /compras/ordenes: todas las OC con buscador y filtros (lo que va a recibir Lebane cuando haya API). */
export async function ordenesCompra(f: FiltroOC, limite: number) {
  await exigirPermiso("materiales.gestionar");
  const filas = await db.ordenCompra.findMany({ where: whereOC(f), orderBy: [{ anio: "desc" }, { secuencia: "desc" }, { creadoEn: "desc" }], take: limite + 1, include: incluirOC });
  return { filas: filas.slice(0, limite).map((o) => ocPlana(o, true)), hayMas: filas.length > limite };
}

export async function ordenesParaExportar(f: FiltroOC) {
  await exigirPermiso("materiales.gestionar");
  return (await db.ordenCompra.findMany({ where: whereOC(f), orderBy: [{ anio: "asc" }, { secuencia: "asc" }], include: incluirOC })).map((o) => ocPlana(o, true));
}

/** /aprobaciones: cada OC esperando, con TODOS los datos escritos y sus adjuntos. */
export async function ocsParaAprobar() {
  await exigirPermiso("materiales.aprobar");
  const ocs = await db.ordenCompra.findMany({ where: { estado: "ESPERANDO_APROBACION" }, orderBy: { enviadaEn: "asc" }, include: { ...incluirOC, pedidoMaterial: { select: { prioridad: true, numero: true, observaciones: true, obraSede: { select: { nombre: true, direccion: true, localidad: true } } } } } });
  return Promise.all(ocs.map(async (o) => ({
    ...ocPlana(o, true), prioridad: o.pedidoMaterial.prioridad, pedidoNumero: o.pedidoMaterial.numero, observacionesPedido: o.pedidoMaterial.observaciones,
    adjuntos: await adjuntosDe("ORDEN_COMPRA", o.id, true),
  })));
}
