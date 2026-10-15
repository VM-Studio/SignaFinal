import "server-only";
import type { EstadoMaterialListo, EstadoOC, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso, exigirSesion, type UsuarioSesion } from "@/lib/auth/sesion";
import { filtroObras, obrasDelUsuario } from "@/lib/alcance";
import { puede } from "@/lib/permisos";
import { hora } from "@/lib/formato";
import { proveedoresConSucursales } from "@/lib/proveedores/consultas";
import { conOCCargada, demorado, nombreDoc } from "@/lib/compras/documento";
import { faltan, textoFaltan } from "@/lib/compras/permisosCeldas";
import { celdasSeccion1, incluirDocumento, valoresDe } from "@/lib/compras/celdas";
import { primeraLinea } from "./comun";

/**
 * LISTAS DE DOCUMENTOS DE COMPRA (OC/PE) y de lo habilitado. Qué ve cada uno: Compras, Dirección y
 * Administración, todos; la gente de obra, los que creó o pidió y los de sus obras (el capataz, todas).
 * Chofer y Depósito, ninguno. TODA lista pasa por documentosVisibles.
 */
export function documentosVisibles(u: Pick<UsuarioSesion, "id" | "rol">): Prisma.OrdenCompraWhereInput {
  if (u.rol === "COMPRAS" || u.rol === "DIRECCION" || u.rol === "ADMINISTRACION" || u.rol === "CAPATAZ") return {};
  if (u.rol === "RESPONSABLE_OBRA") return { OR: [{ creadaPorId: u.id }, { solicitanteId: u.id }, { obra: filtroObras(u) }] };
  return { id: "-" };
}
const conAlcance = (u: Pick<UsuarioSesion, "id" | "rol">, where: Prisma.OrdenCompraWhereInput = {}): Prisma.OrdenCompraWhereInput => ({ AND: [documentosVisibles(u), where] });

/** Cuándo entró al estado actual (el último cambio). */
const filaInclude = {
  ...incluirDocumento,
  cambios: { orderBy: { fecha: "desc" as const }, take: 1, select: { fecha: true } },
  materialesListos: {
    where: { estado: { not: "CANCELADO" as EstadoMaterialListo } },
    orderBy: { habilitadoEn: "asc" as const },
    select: { id: true, estado: true, modoEntrega: true, fechaEntregaEstimada: true, horarioRetiro: true, proveedor: { select: { nombre: true } }, pedidoViaje: { select: { id: true, viaje: { select: { etaDestino: true } } } } },
  },
} satisfies Prisma.OrdenCompraInclude;
type FilaDb = Prisma.OrdenCompraGetPayload<{ include: typeof filaInclude }>;

export type FilaDoc = {
  id: string; numeroInterno: number; tipo: "OC" | "PE"; nombre: string; detalle: string; lineas: number;
  obraId: string | null; obra: string; solicitante: string; comprador: string | null;
  estado: EstadoOC; prioridad: "NORMAL" | "URGENTE"; caducidad: string | null; enEstadoDesde: string; demorado: boolean;
  /** Bandeja de Compras: "Faltan: Proveedor Final, Importe" y si ya viene con OC cargada. */
  faltan: string | null; conOC: boolean;
  /** Para la frase del que pidió: dónde retirar y a qué hora llega. */
  proveedorListo: string | null; horarioListo: string | null; listoId: string | null; retiro: EstadoMaterialListo | null; llega: string | null; entregaProveedor: string | null;
  adjuntos: number; conNota: boolean; motivoRechazo: string | null; notaDevolucion: string | null;
};

const fechaLarga = (d: Date) => new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "numeric" }).format(d);

function aFila(d: FilaDb): FilaDoc {
  const desde = d.cambios[0]?.fecha ?? d.creadoEn;
  const listo = d.materialesListos.find((m) => m.estado === "LISTO" && m.modoEntrega === "RETIRA_CHOFER");
  const enCamino = d.materialesListos.find((m) => m.estado === "EN_CAMINO");
  const pedido = d.materialesListos.find((m) => m.estado === "RETIRO_PEDIDO");
  const proveedorTrae = d.materialesListos.find((m) => m.modoEntrega === "ENTREGA_PROVEEDOR" && m.estado !== "ENTREGADO");
  const eta = enCamino?.pedidoViaje?.viaje?.etaDestino;
  const v = valoresDe(d);
  const lineas = (d.detallePedido ?? "").split("\n").filter((l) => l.trim()).length;
  return {
    id: d.id, numeroInterno: d.numeroInterno, tipo: d.tipo, nombre: nombreDoc(d), detalle: primeraLinea(d.detallePedido), lineas,
    obraId: d.obraId, obra: d.obra?.nombre ?? d.obraTexto ?? "sin obra", solicitante: d.solicitante?.nombre ?? d.solicitanteExterno?.nombre ?? d.solicitadoPorTexto ?? d.creadaPor.nombre,
    comprador: d.tomadoPor?.nombre ?? null,
    estado: d.estado, prioridad: d.prioridad, caducidad: d.fechaNecesaria?.toISOString() ?? null, enEstadoDesde: desde.toISOString(), demorado: demorado(d.estado, desde),
    faltan: d.estado === "ENVIADA_A_COMPRAS" || d.estado === "EN_COMPRAS" ? textoFaltan(faltan("enviarAAutorizacion", v)) : d.estado === "BORRADOR" ? textoFaltan(faltan("enviarACompras", v)) : null,
    conOC: conOCCargada({ proveedorSugerido: d.proveedorSugerido, importe: d.importe, importeAConfirmar: d.importeAConfirmar, celdasSeccion1: celdasSeccion1(v) }),
    proveedorListo: listo?.proveedor.nombre ?? null, horarioListo: listo?.horarioRetiro ?? null, listoId: listo?.id ?? null,
    retiro: enCamino ? "EN_CAMINO" : pedido ? "RETIRO_PEDIDO" : listo ? "LISTO" : null, llega: eta ? hora(eta) : null,
    entregaProveedor: proveedorTrae ? (proveedorTrae.fechaEntregaEstimada ? `el ${fechaLarga(proveedorTrae.fechaEntregaEstimada)}` : "") : null,
    adjuntos: 0, conNota: !!d.observacionesSolicitante?.trim(), motivoRechazo: d.motivoRechazo, notaDevolucion: d.notaDevolucion,
  };
}

/** Cuántos archivos (visibles para quien mira) tiene cada documento de la lista. */
async function conAdjuntos(filas: FilaDoc[], internos: boolean) {
  if (!filas.length) return filas;
  const n = await db.adjunto.groupBy({ by: ["entidadId"], where: { entidadTipo: "ORDEN_COMPRA", entidadId: { in: filas.map((f) => f.id) }, ...(internos ? {} : { interno: false }) }, _count: true });
  const m = new Map(n.map((x) => [x.entidadId, x._count]));
  return filas.map((f) => ({ ...f, adjuntos: m.get(f.id) ?? 0 }));
}

// ═══════════════════════════ Bandeja de Compras ═══════════════════════════

/** Pestañas de la bandeja: lo que llegó (sin abrir) y lo que Compras está comprando. */
export const PESTANAS_BANDEJA = {
  nuevos: { titulo: "Nuevos", estados: ["ENVIADA_A_COMPRAS"] },
  "en-compras": { titulo: "En Compras", estados: ["EN_COMPRAS"] },
  todos: { titulo: "Todos", estados: ["ENVIADA_A_COMPRAS", "EN_COMPRAS"] },
} as const satisfies Record<string, { titulo: string; estados: EstadoOC[] }>;
export type PestanaBandeja = keyof typeof PESTANAS_BANDEJA;

export type FiltrosBandeja = { obra: string[]; sol: string[]; prioridad: ("URGENTE" | "NORMAL")[]; adjuntos: boolean; carga: "oc" | "indicaciones" | null; q?: string; orden: string };
export function leerFiltrosBandeja(sp: Record<string, string | string[] | undefined>): FiltrosBandeja {
  const l = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string).split(",").filter(Boolean).slice(0, 50) : []);
  return {
    obra: l("obra"), sol: l("sol"),
    prioridad: l("prioridad").filter((x): x is "URGENTE" | "NORMAL" => x === "URGENTE" || x === "NORMAL"),
    adjuntos: sp.adjuntos === "1", carga: sp.carga === "oc" ? "oc" : sp.carga === "indicaciones" ? "indicaciones" : null,
    q: typeof sp.q === "string" ? sp.q.trim().slice(0, 100) || undefined : undefined,
    orden: typeof sp.orden === "string" ? sp.orden : "caducidad",
  };
}

/**
 * BANDEJA DE COMPRAS (/compras, "Pedidos de material"): los documentos ENVIADA_A_COMPRAS y EN_COMPRAS,
 * con "Con OC cargada" / "Solo indicaciones", qué falta en cada uno y la barra de filtros. La bandeja es
 * chica (lo que está en manos de Compras): se filtra en memoria lo que no entra en un where.
 */
export async function bandejaCompras(pestana: PestanaBandeja, f: FiltrosBandeja, limite: number) {
  const u = await exigirPermiso("materiales.gestionar");
  const base: Prisma.OrdenCompraWhereInput = {
    AND: [
      { estado: { in: ["ENVIADA_A_COMPRAS", "EN_COMPRAS"] } },
      f.obra.length ? { obraId: { in: f.obra } } : {},
      f.sol.length ? { solicitanteId: { in: f.sol } } : {},
      f.prioridad.length ? { prioridad: { in: f.prioridad } } : {},
      f.q ? { OR: [{ detallePedido: { contains: f.q, mode: "insensitive" } }, { observacionesSolicitante: { contains: f.q, mode: "insensitive" } }, { proveedorSugerido: { contains: f.q, mode: "insensitive" } }, { obra: { nombre: { contains: f.q, mode: "insensitive" } } }] } : {},
    ],
  };
  const orderBy: Prisma.OrdenCompraOrderByWithRelationInput[] = f.orden === "caducidad-lejana" ? [{ fechaNecesaria: { sort: "desc", nulls: "last" } }] : f.orden === "nuevos" ? [{ creadoEn: "desc" }] : [{ prioridad: "desc" }, { fechaNecesaria: { sort: "asc", nulls: "last" } }, { creadoEn: "asc" }];
  const [docs, obras, usuarios] = await Promise.all([
    db.ordenCompra.findMany({ where: conAlcance(u, base), include: filaInclude, orderBy, take: 1000 }),
    db.obra.findMany({ where: { ordenesCompra: { some: { estado: { in: ["ENVIADA_A_COMPRAS", "EN_COMPRAS"] } } } }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    db.usuario.findMany({ where: { ocSolicitadas: { some: { estado: { in: ["ENVIADA_A_COMPRAS", "EN_COMPRAS"] } } } }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
  ]);
  let filas = await conAdjuntos(docs.map(aFila), true);
  if (f.adjuntos) filas = filas.filter((x) => x.adjuntos > 0);
  const enPestana = (x: FilaDoc, p: PestanaBandeja) => (PESTANAS_BANDEJA[p].estados as readonly EstadoOC[]).includes(x.estado);
  const cuantos = Object.fromEntries((Object.keys(PESTANAS_BANDEJA) as PestanaBandeja[]).map((p) => [p, filas.filter((x) => enPestana(x, p)).length])) as Record<PestanaBandeja, number>;
  const dePestana = filas.filter((x) => enPestana(x, pestana));
  const chips = { oc: dePestana.filter((x) => x.conOC).length, indicaciones: dePestana.filter((x) => !x.conOC).length };
  const lista = f.carga ? dePestana.filter((x) => (f.carga === "oc" ? x.conOC : !x.conOC)) : dePestana;
  const porSolicitante = new Map<string, number>();
  for (const d of docs) if (d.solicitanteId) porSolicitante.set(d.solicitanteId, (porSolicitante.get(d.solicitanteId) ?? 0) + 1);
  return {
    filas: lista.slice(0, limite), hayMas: lista.length > limite, cuantos, chips,
    obras: obras.map((o) => ({ valor: o.id, etiqueta: `Obra ${o.nombre}` })),
    solicitantes: usuarios.map((x) => ({ valor: x.id, etiqueta: x.nombre, cantidad: porSolicitante.get(x.id) })),
  };
}

/** Cuántos llegaron sin que nadie los abra (franja negra del tablero de Compras). */
export async function cuantosNuevos() {
  return db.ordenCompra.count({ where: { estado: "ENVIADA_A_COMPRAS" } });
}

// ═══════════════════════════ Administración: facturación ═══════════════════════════

/** "Facturación": autorizadas en adelante con la factura o el pago pendientes, por fecha. */
export async function paraFacturar(f: { q?: string; obra: string[]; pendiente: "factura" | "pago" | null }, limite: number) {
  const u = await exigirSesion();
  if (u.rol !== "ADMINISTRACION" && u.rol !== "DIRECCION") throw new Error("Sin permiso");
  const where: Prisma.OrdenCompraWhereInput = {
    AND: [
      { estado: { in: ["AUTORIZADA", "ENCARGADA", "HABILITADA", "ENTREGADA"] } },
      f.pendiente === "factura" ? { estadoFacturacion: "PENDIENTE" } : f.pendiente === "pago" ? { estadoPago: { not: "PAGADO" } } : { OR: [{ estadoFacturacion: "PENDIENTE" }, { estadoPago: { not: "PAGADO" } }] },
      f.obra.length ? { obraId: { in: f.obra } } : {},
      f.q ? { OR: [{ numero: { contains: f.q, mode: "insensitive" } }, { facturaNumero: { contains: f.q, mode: "insensitive" } }, { proveedor: { nombre: { contains: f.q, mode: "insensitive" } } }, { detallePedido: { contains: f.q, mode: "insensitive" } }] } : {},
    ],
  };
  const [filas, total, obras] = await Promise.all([
    db.ordenCompra.findMany({ where, orderBy: [{ aprobadaEn: "asc" }, { fecha: "asc" }], take: limite + 1, include: incluirDocumento }),
    db.ordenCompra.count({ where }),
    db.obra.findMany({ where: { ordenesCompra: { some: { estado: { in: ["AUTORIZADA", "ENCARGADA", "HABILITADA", "ENTREGADA"] } } } }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
  ]);
  return { filas: filas.slice(0, limite), hayMas: filas.length > limite, total, obras: obras.map((o) => ({ valor: o.id, etiqueta: `Obra ${o.nombre}` })) };
}

/** Inicio de Administración: pagos que pidió y esperan la autorización del dueño. */
export async function pagosEsperandoAutorizacion(limite = 8) {
  const u = await exigirSesion();
  if (u.rol !== "ADMINISTRACION" && u.rol !== "DIRECCION") throw new Error("Sin permiso");
  return db.ordenCompra.findMany({ where: { pagoSolicitadoEn: { not: null }, ordenPagoAutorizadaEn: null, estado: { not: "ANULADA" } }, orderBy: { pagoSolicitadoEn: "asc" }, take: limite, include: incluirDocumento });
}

// ═══════════════════════════ Habilitados ═══════════════════════════

/** Proveedores (con sus sucursales) para la hoja "Habilitar para retirar". */
export async function proveedoresParaHabilitar() {
  await exigirPermiso("materiales.gestionar");
  return proveedoresConSucursales();
}

/** Filtros de Habilitados (barra de filtros): obra, proveedor y buscador (qué se retira, OC). */
export type FiltrosHabilitados = { obra: string[]; prov: string[]; q?: string };

/** Habilitados por estado, con hace cuánto (Compras ve lo que quedó colgado del lado de la obra). */
export async function habilitados(estado: EstadoMaterialListo, limite: number, f: FiltrosHabilitados = { obra: [], prov: [] }) {
  await exigirPermiso("materiales.gestionar");
  const filtro: Prisma.MaterialListoWhereInput = {
    ...(f.obra.length ? { obraId: { in: f.obra } } : {}),
    ...(f.prov.length ? { proveedorId: { in: f.prov } } : {}),
    ...(f.q ? { OR: [{ descripcion: { contains: f.q, mode: "insensitive" } }, { ordenCompraNumero: { contains: f.q, mode: "insensitive" } }] } : {}),
  };
  const [filas, conteos, obras, provs] = await Promise.all([
    db.materialListo.findMany({
      where: { estado, ...filtro },
      orderBy: estado === "ENTREGADO" ? { entregadoEn: "desc" } : { habilitadoEn: "asc" },
      take: limite + 1,
      include: {
        obra: { select: { nombre: true } }, proveedor: { select: { nombre: true } },
        ordenCompra: { select: { id: true, numeroInterno: true, solicitante: { select: { nombre: true } }, creadaPor: { select: { nombre: true } } } },
        pedidoViaje: { select: { numero: true, tomadoPor: { select: { nombre: true } }, viaje: { select: { etaDestino: true } } } },
      },
    }),
    db.materialListo.groupBy({ by: ["estado"], where: filtro, _count: true }),
    db.materialListo.groupBy({ by: ["obraId"], where: { estado }, _count: true }),
    db.materialListo.groupBy({ by: ["proveedorId"], where: { estado }, _count: true }),
  ]);
  const [nombresObra, nombresProv] = await Promise.all([
    db.obra.findMany({ where: { id: { in: obras.map((o) => o.obraId) } }, select: { id: true, nombre: true } }),
    db.proveedor.findMany({ where: { id: { in: provs.map((p) => p.proveedorId) } }, select: { id: true, nombre: true } }),
  ]);
  const opcion = (xs: { id: string; nombre: string }[], id: string, n: number) => ({ valor: id, etiqueta: xs.find((x) => x.id === id)?.nombre ?? "—", cantidad: n });
  return {
    filas: filas.slice(0, limite), hayMas: filas.length > limite,
    cuantos: Object.fromEntries(conteos.map((c) => [c.estado, c._count])) as Partial<Record<EstadoMaterialListo, number>>,
    obras: obras.map((o) => opcion(nombresObra, o.obraId, o._count)).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es")),
    proveedores: provs.map((p) => opcion(nombresProv, p.proveedorId, p._count)).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es")),
  };
}

// ═══════════════════════════ Obra ═══════════════════════════

/**
 * Mis pedidos, pestaña Materiales: arriba los borradores ("Seguir completando") y lo listo para retirar
 * (tarjetas verdes con "Pedir el viaje"); después lo que está en curso y lo entregado o anulado hace poco.
 */
export async function misDocumentos(limite: number) {
  const u = await exigirSesion();
  const [borradores, enCurso] = await Promise.all([
    db.ordenCompra.findMany({ where: conAlcance(u, { estado: "BORRADOR", creadaPorId: u.id }), include: filaInclude, orderBy: { actualizadoEn: "desc" }, take: 20 }),
    db.ordenCompra.findMany({
      where: conAlcance(u, { estado: { not: "BORRADOR" }, OR: [{ estado: { notIn: ["ENTREGADA", "ANULADA", "RECHAZADA"] } }, { actualizadoEn: { gte: new Date(Date.now() - 14 * 86_400_000) } }] }),
      include: filaInclude, orderBy: [{ actualizadoEn: "desc" }], take: limite + 1,
    }),
  ]);
  const peso = (f: FilaDoc) => (f.listoId ? 0 : f.estado === "ENTREGADA" || f.estado === "ANULADA" ? 2 : 1);
  return {
    borradores: borradores.map(aFila),
    filas: enCurso.slice(0, limite).map(aFila).sort((a, b) => peso(a) - peso(b)),
    hayMas: enCurso.length > limite,
  };
}

/** Datos del formulario "Pedir materiales". */
export async function datosPedirMateriales() {
  const u = await exigirSesion();
  if (!puede(u.rol, "materiales.pedir")) throw new Error("Sin permiso");
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
  const u = await exigirSesion();
  if (!puede(u.rol, "pedidos.crear") && !puede(u.rol, "pedidos.coordinar")) throw new Error("Sin permiso");
  const filas = await db.materialListo.findMany({
    where: { obraId, estado: "LISTO", modoEntrega: "RETIRA_CHOFER", ordenCompra: documentosVisibles(u) },
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

/**
 * Compras → Viajes → Coordinar: todas las obras activas con su gente (responsables y capataz) y lo
 * habilitado para retirar en cada una (lo mismo que ve la arquitecta en Pedir → Retiro).
 */
export async function datosCoordinar() {
  await exigirPermiso("pedidos.coordinar");
  const [obras, capataces] = await Promise.all([
    db.obra.findMany({
      where: { estado: "ACTIVA" }, orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, responsables: { where: { activo: true }, orderBy: [{ principal: "desc" }, { creadoEn: "asc" }], select: { usuario: { select: { id: true, nombre: true, activo: true } } } } },
    }),
    db.usuario.findMany({ where: { rol: "CAPATAZ", activo: true }, select: { id: true, nombre: true } }),
  ]);
  const listos = await Promise.all(obras.map(async (o) => [o.id, await listosParaRetirar(o.id)] as const));
  return {
    obras: obras.map((o) => ({
      id: o.id, nombre: o.nombre,
      personas: [...o.responsables.filter((r) => r.usuario.activo).map((r) => ({ id: r.usuario.id, nombre: r.usuario.nombre })), ...capataces.map((c) => ({ id: c.id, nombre: `${c.nombre} (capataz)` }))],
    })),
    listos: Object.fromEntries(listos) as Record<string, ListoParaRetirar[]>,
  };
}

/** Lo habilitado para retirar en mis obras, con "Pedir el viaje" (inicio de obra y Mis pedidos). */
export async function listosEnMisObrasDetalle(limite = 6) {
  const u = await exigirSesion();
  if (!puede(u.rol, "materiales.pedir")) return [];
  const filas = await db.materialListo.findMany({
    where: { estado: "LISTO", modoEntrega: "RETIRA_CHOFER", ordenCompra: documentosVisibles(u) },
    orderBy: { habilitadoEn: "asc" }, take: limite,
    include: { proveedor: { select: { nombre: true } }, obra: { select: { nombre: true } }, ordenCompra: { select: { id: true, tipo: true, numero: true, numeroInterno: true } } },
  });
  return filas.map((m) => ({ id: m.id, obraId: m.obraId, obra: m.obra.nombre, proveedor: m.proveedor.nombre, descripcion: m.descripcion, horario: m.horarioRetiro, documentoId: m.ordenCompra.id, documento: nombreDoc(m.ordenCompra) }));
}

/** Inicio de obra: lo que pedí y todavía está en manos de Compras (sin habilitar). */
export async function esperandoACompras(limite = 5) {
  const u = await exigirSesion();
  const filas = await db.ordenCompra.findMany({
    where: conAlcance(u, { OR: [{ solicitanteId: u.id }, { creadaPorId: u.id }], estado: { in: ["ENVIADA_A_COMPRAS", "EN_COMPRAS", "ESPERANDO_AUTORIZACION", "AUTORIZADA", "ENCARGADA"] } }),
    include: filaInclude, orderBy: { fechaNecesaria: { sort: "asc", nulls: "last" } }, take: limite,
  });
  return filas.map(aFila);
}

/** Cuántos materiales listos para retirar hay en mis obras (contador de Mis pedidos). */
export async function listosEnMisObras() {
  const u = await exigirSesion();
  if (!puede(u.rol, "materiales.pedir")) return 0;
  return db.materialListo.count({ where: { estado: "LISTO", modoEntrega: "RETIRA_CHOFER", ordenCompra: documentosVisibles(u) } });
}

/** Inicio del dueño: cuántas órdenes esperan su autorización (las importadas del Excel nunca). */
export async function cuantasParaAprobar() {
  await exigirPermiso("materiales.aprobar");
  return db.ordenCompra.count({ where: { estado: "ESPERANDO_AUTORIZACION", fuente: { not: "IMPORTADA" } } });
}

/** Pagos que Administración pidió autorizar. */
export async function cuantosPagosParaAutorizar() {
  return db.ordenCompra.count({ where: { pagoSolicitadoEn: { not: null }, ordenPagoAutorizadaEn: null, estado: { not: "ANULADA" } } });
}
