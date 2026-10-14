import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso, exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { adjuntosDe } from "@/lib/archivos";
import { proveedoresConSucursales } from "@/lib/proveedores/consultas";
import { diaISO } from "@/lib/formato";
import { incluirOC, obraDe, solicitadoPor, type OCCompleta } from "./servicio";
import { numeroCorto } from "./numerar";

const n = (d: Prisma.Decimal | null | undefined) => (d == null ? null : d.toNumber());
const f = (d: Date | null | undefined) => (d ? diaISO(d) : null);

/** Orden plana (sin Decimal ni Date) para pasar a un componente cliente. */
export function ocPlana(oc: OCCompleta, conInternas: boolean) {
  return {
    id: oc.id, tipo: oc.tipo, numero: oc.numero, numeroCorto: numeroCorto(oc), estado: oc.estado, version: oc.version, versionAprobacion: oc.versionAprobacion, fuente: oc.fuente,
    estadoTablero: oc.estadoTablero, estadoTableroAuto: oc.estadoTableroAuto, semaforoPE: oc.semaforoPE, encargadaEn: oc.encargadaEn?.toISOString() ?? null,
    empresaCompraId: oc.empresaCompraId, empresaCompra: oc.empresaCompra ? { nombre: oc.empresaCompra.nombre, cuit: oc.empresaCompra.cuit } : null,
    fecha: diaISO(oc.fecha), fechaNecesaria: f(oc.fechaNecesaria), fechaEntrega: f(oc.fechaEntrega),
    solicitadoPor: solicitadoPor(oc), solicitadoPorValor: oc.solicitanteId ? `u:${oc.solicitanteId}` : oc.solicitanteExternoId ? `e:${oc.solicitanteExternoId}` : null,
    obraId: oc.obraId, obra: obraDe(oc), obraSedeId: null as string | null,
    detallePedido: oc.detallePedido, proveedorSugerido: oc.proveedorSugerido,
    proveedorId: oc.proveedorId, sucursalId: oc.sucursalId,
    proveedor: oc.proveedor?.nombre ?? null,
    sucursal: oc.sucursal ? { nombre: oc.sucursal.nombre, direccion: `${oc.sucursal.direccion}, ${oc.sucursal.localidad}`, horario: oc.sucursal.horarioRetiro, contacto: oc.sucursal.contacto, telefono: oc.sucursal.telefono } : null,
    presupuestoNumero: oc.presupuestoNumero, importe: n(oc.importe), importeAConfirmar: oc.importeAConfirmar, moneda: oc.moneda, cotizacionUsd: n(oc.cotizacionUsd),
    formaPago: oc.formaPago, condicionPago: oc.condicionPago, condicionPagoTexto: oc.condicionPagoTexto,
    observaciones: oc.observaciones, notasInternas: conInternas ? oc.notasInternas : null,
    proximosPasos: oc.proximosPasos, comentarios: oc.comentarios,
    renglones: oc.renglones.map((r) => ({ descripcion: r.descripcion, cantidad: r.cantidad.toNumber(), unidad: r.unidad, precioUnitario: n(r.precioUnitario), subtotal: n(r.subtotal) })),
    empresaFacturarId: oc.empresaFacturarId, empresaFacturar: oc.empresaFacturar ? { nombre: oc.empresaFacturar.nombre, cuit: oc.empresaFacturar.cuit } : null,
    facturaNumero: oc.facturaNumero, facturaImporte: n(oc.facturaImporte), facturaFecha: f(oc.facturaFecha), facturaFormaPago: oc.facturaFormaPago, facturaCondicion: oc.facturaCondicion, facturaAdjuntoId: oc.facturaAdjuntoId,
    ordenPagoAutorizadaPor: oc.ordenPagoAutorizadaPor?.nombre ?? null, ordenPagoAutorizadaEn: oc.ordenPagoAutorizadaEn?.toISOString() ?? null,
    fechaPago: f(oc.fechaPago), pagoImporte: n(oc.pagoImporte), pagoObservaciones: oc.pagoObservaciones,
    creadaPor: oc.creadaPor.nombre, enviadaEn: oc.enviadaEn?.toISOString() ?? null, aprobadaPor: oc.aprobadaPor?.nombre ?? null, aprobadaEn: oc.aprobadaEn?.toISOString() ?? null,
    motivoRechazo: oc.motivoRechazo, motivoAnulacion: oc.motivoAnulacion,
    pedidoMaterialId: oc.pedidoMaterialId, pedidoNumero: oc.pedidoMaterial?.numero ?? null, pedidoEstado: oc.pedidoMaterial?.estado ?? null,
    pdfUrl: oc.pdfUrl, pdfAprobadaUrl: oc.pdfAprobadaUrl,
  };
}
export type OCPlana = ReturnType<typeof ocPlana>;

/** Las listas de la plantilla: razones sociales, obras (con sedes), quién puede pedir y proveedores. */
export async function listasPlantilla() {
  const [razones, obras, usuarios, externos, proveedores] = await Promise.all([
    db.razonSocial.findMany({ where: { activa: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
    db.obra.findMany({ where: { estado: { not: "FINALIZADA" } }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, razonSocialId: true, latitud: true, longitud: true, sedes: { where: { activa: true }, select: { id: true, nombre: true, latitud: true, longitud: true } } } }),
    db.usuario.findMany({ where: { activo: true, rol: { in: ["RESPONSABLE_OBRA", "CAPATAZ", "DIRECCION", "COMPRAS"] } }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, rol: true } }),
    db.solicitanteExterno.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    proveedoresConSucursales(),
  ]);
  return {
    razones: razones.map((r) => ({ id: r.id, nombre: r.nombre, cuit: r.cuit })),
    obras: obras.map((o) => ({ id: o.id, nombre: o.nombre, razonSocialId: o.razonSocialId, destino: { lat: o.latitud, lng: o.longitud }, sedes: o.sedes.map((s) => ({ id: s.id, nombre: s.nombre, destino: { lat: s.latitud, lng: s.longitud } })) })),
    solicitantes: [
      ...usuarios.map((u) => ({ valor: `u:${u.id}`, nombre: u.nombre, detalle: "usuario" as const })),
      ...externos.map((e) => ({ valor: `e:${e.id}`, nombre: e.nombre, detalle: "sin usuario" as const })),
    ].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    proveedores,
  };
}
export type ListasPlantilla = Awaited<ReturnType<typeof listasPlantilla>>;

/** Razón social por defecto: la de la obra, o Signa Desarrollos (la primera activa). */
export async function razonPorDefecto(obraId: string | null) {
  const obra = obraId ? await db.obra.findUnique({ where: { id: obraId }, select: { razonSocialId: true } }) : null;
  if (obra?.razonSocialId) return obra.razonSocialId;
  return (await db.razonSocial.findFirst({ where: { activa: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }], select: { id: true } }))?.id ?? null;
}

/**
 * Todo lo que necesita la plantilla. Con pedidoId (/compras/[id]/oc): el pedido para copiar datos y
 * su borrador (o la orden enviada/aprobada para editar). Con ocId (/compras/ordenes/[id]): esa orden.
 * Sin nada (/compras/ordenes/nueva): en blanco.
 */
export async function formularioOC(o: { pedidoId?: string; ocId?: string; tipo?: "OC" | "PE" }) {
  const u = await exigirPermiso("materiales.gestionar");
  const listas = await listasPlantilla();
  const p = o.pedidoId
    ? await db.pedidoMaterial.findUnique({
        where: { id: o.pedidoId },
        include: {
          obra: { select: { id: true, nombre: true, direccion: true, localidad: true, latitud: true, longitud: true } },
          obraSede: { select: { id: true, nombre: true, direccion: true, localidad: true, latitud: true, longitud: true } },
          solicitante: { select: { id: true, nombre: true } },
          ordenesCompra: { orderBy: { creadoEn: "desc" }, include: incluirOC },
        },
      })
    : null;
  if (o.pedidoId && !p) return null;
  const ocDirecta = o.ocId ? await db.ordenCompra.findUnique({ where: { id: o.ocId }, include: incluirOC }) : null;
  if (o.ocId && !ocDirecta) return null;
  // La orden que se edita: la vigente del pedido (borrador, enviada o aprobada) o la pedida por id.
  const vigente = ocDirecta ?? p?.ordenesCompra.find((x) => x.id === p.ordenCompraId && ["BORRADOR", "ESPERANDO_APROBACION", "APROBADA"].includes(x.estado)) ?? null;
  const [adjuntosPedido, adjuntosOC] = await Promise.all([
    p ? adjuntosDe("PEDIDO_MATERIAL", p.id, true) : Promise.resolve([]),
    vigente ? adjuntosDe("ORDEN_COMPRA", vigente.id, true) : Promise.resolve([]),
  ]);
  const empresaPorDefecto = await razonPorDefecto(vigente?.obraId ?? p?.obraId ?? null);
  return {
    yo: u.nombre,
    puedeAutorizarPago: puede(u.rol, "materiales.aprobar"),
    tipoInicial: vigente?.tipo ?? o.tipo ?? "OC",
    empresaPorDefecto,
    pedido: p
      ? {
          id: p.id, numero: p.numero, estado: p.estado, descripcion: p.descripcion, observaciones: p.observaciones, notasCompras: p.notasCompras, presupuestoSolicitado: p.presupuestoSolicitado,
          obraId: p.obraId, obraSedeId: p.obraSedeId, obra: p.obra.nombre, sede: p.obraSede?.nombre ?? null, solicitante: p.solicitante.nombre, solicitanteId: p.solicitante.id, paraCuando: diaISO(p.paraCuando),
          prioridad: p.prioridad,
          destino: p.obraSede ? { lat: p.obraSede.latitud, lng: p.obraSede.longitud } : { lat: p.obra.latitud, lng: p.obra.longitud },
          direccionEntrega: p.obraSede ? `${p.obraSede.direccion}, ${p.obraSede.localidad}` : `${p.obra.direccion}, ${p.obra.localidad}`,
          renglones: (Array.isArray(p.renglones) ? p.renglones : []) as { descripcion: string; cantidad: number | null; unidad: string | null }[],
        }
      : null,
    adjuntosPedido, adjuntosOC,
    orden: vigente ? ocPlana(vigente, true) : null,
    anteriores: (p?.ordenesCompra ?? []).filter((x) => x.estado === "RECHAZADA" || x.estado === "ANULADA").map((x) => ocPlana(x, true)),
    ...listas,
  };
}
export type FormularioOCDatos = NonNullable<Awaited<ReturnType<typeof formularioOC>>>;

/** Las órdenes y el historial de un pedido, para el detalle (sin notas internas para el que pidió). */
export async function ocsDePedido(pedidoId: string) {
  const u = await exigirSesion();
  const gestiona = puede(u.rol, "materiales.gestionar") || puede(u.rol, "materiales.aprobar");
  const ocs = await db.ordenCompra.findMany({ where: { pedidoMaterialId: pedidoId, ...(gestiona ? {} : { estado: "APROBADA" }) }, orderBy: { creadoEn: "desc" }, include: incluirOC });
  return Promise.all(ocs.map(async (o) => ({ ...(gestiona ? ocPlana(o, true) : sinImportes(ocPlana(o, false))), adjuntos: gestiona ? await adjuntosDe("ORDEN_COMPRA", o.id, true) : [] })));
}

/** Lo que ve la gente de obra de una orden: sin importes, precios, facturación ni orden de pago. */
export function sinImportes(o: OCPlana): OCPlana {
  return {
    ...o, importe: null, importeAConfirmar: false, cotizacionUsd: null, presupuestoNumero: null, formaPago: null, condicionPago: null, condicionPagoTexto: null,
    renglones: o.renglones.map((r) => ({ ...r, precioUnitario: null, subtotal: null })),
    facturaNumero: null, facturaImporte: null, facturaFecha: null, facturaFormaPago: null, facturaCondicion: null, facturaAdjuntoId: null, empresaFacturar: null, empresaFacturarId: null,
    ordenPagoAutorizadaPor: null, ordenPagoAutorizadaEn: null, fechaPago: null, pagoImporte: null, pagoObservaciones: null, notasInternas: null, proximosPasos: null, comentarios: null,
    pdfUrl: null, pdfAprobadaUrl: null,
  };
}

/** /compras/ordenes: borradores arriba, después todas por número; buscador por número, proveedor u obra. */
export async function ordenesCompra(o: { q?: string; tipo?: string }, limite: number) {
  await exigirPermiso("materiales.gestionar");
  const q = o.q?.trim();
  const where: Prisma.OrdenCompraWhereInput = {
    ...(o.tipo === "OC" || o.tipo === "PE" ? { tipo: o.tipo } : {}),
    ...(q
      ? {
          OR: [
            { numero: { contains: q, mode: "insensitive" } }, { numeroTexto: { contains: q, mode: "insensitive" } },
            { proveedor: { nombre: { contains: q, mode: "insensitive" } } }, { proveedorSugerido: { contains: q, mode: "insensitive" } },
            { obra: { nombre: { contains: q, mode: "insensitive" } } }, { obraTexto: { contains: q, mode: "insensitive" } },
            { detallePedido: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [borradores, filas] = await Promise.all([
    db.ordenCompra.findMany({ where: { ...where, estado: "BORRADOR", fuente: "SISTEMA" }, orderBy: { actualizadoEn: "desc" }, take: 50, include: incluirOC }),
    db.ordenCompra.findMany({ where: { ...where, NOT: { estado: "BORRADOR", fuente: "SISTEMA" } }, orderBy: [{ fecha: "desc" }, { secuencia: "desc" }, { creadoEn: "desc" }], take: limite + 1, include: incluirOC }),
  ]);
  return { borradores: borradores.map((x) => ocPlana(x, true)), filas: filas.slice(0, limite).map((x) => ocPlana(x, true)), hayMas: filas.length > limite };
}

/** /aprobaciones: cada orden esperando, con TODOS los datos escritos y sus adjuntos (las importadas, nunca). */
export async function ocsParaAprobar() {
  await exigirPermiso("materiales.aprobar");
  const ocs = await db.ordenCompra.findMany({
    where: { estado: "ESPERANDO_APROBACION", fuente: "SISTEMA", pedidoMaterialId: { not: null } },
    orderBy: { enviadaEn: "asc" },
    include: { ...incluirOC, pedidoMaterial: { select: { id: true, numero: true, estado: true, prioridad: true, observaciones: true, obraSede: { select: { nombre: true, direccion: true, localidad: true } } } } },
  });
  return Promise.all(ocs.map(async (o) => ({
    ...ocPlana(o, true), prioridad: o.pedidoMaterial!.prioridad, observacionesPedido: o.pedidoMaterial!.observaciones,
    adjuntos: await adjuntosDe("ORDEN_COMPRA", o.id, true),
  })));
}

/** Una orden por id (para el panel del tablero y /compras/ordenes/[id]). */
export async function ordenPorId(id: string) {
  const u = await exigirSesion();
  if (!puede(u.rol, "materiales.gestionar") && !puede(u.rol, "materiales.aprobar") && u.rol !== "ADMINISTRACION") return null;
  const oc = await db.ordenCompra.findUnique({ where: { id }, include: incluirOC });
  if (!oc) return null;
  return { ...ocPlana(oc, true), adjuntos: await adjuntosDe("ORDEN_COMPRA", oc.id, true) };
}
