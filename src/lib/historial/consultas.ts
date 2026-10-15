import "server-only";
import type { EstadoOC, EstadoPedido, Franja, OrigenTipo, Prioridad, Prisma, TipoFavorito, TipoPedido } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirSesion, type UsuarioSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { conAlcance, filtroObras, idsObrasDelUsuario } from "@/lib/alcance";
import { diaISO } from "@/lib/formato";

/**
 * HISTORIAL Y "REPETIR PEDIDO". Los últimos pedidos del usuario (los propios primero, después los de sus
 * obras; Compras y Dirección, de todas), con lo necesario para precargar el formulario. La fecha nunca
 * se copia: queda en blanco y se elige de nuevo.
 */
const LIMITE = 20;

export type RenglonPrecarga = { descripcion: string; cantidad: string; unidad: string };
export type PrecargaMateriales = {
  origen: { id: string; numero: number; fecha: string; obra: string; items: number; oc: { numero: string; proveedor: string } | null };
  obraId: string;
  sedeId: string | null;
  renglones: RenglonPrecarga[];
  adjuntos: { id: string; nombre: string; tipoMime: string; tamanoBytes: number }[];
  observaciones: string;
  prioridad: Prioridad;
};
export type PrecargaViaje = {
  origen: { id: string; numero: number; fecha: string; obra: string };
  tipo: TipoPedido;
  obraId: string;
  sedeId: string | null;
  que: string;
  pesoKg: string;
  desde: { tipo: OrigenTipo; id: string } | null;
  herramientaId: string;
  personas: string;
  prioridad: Prioridad;
  franja: Franja;
  hora: string;
};
export type ItemHistorial = {
  id: string;
  numero: number;
  fecha: string;
  obra: string;
  resumen: string;
  estado: string;
  tono: "ok" | "aviso" | "critico" | "neutro";
  oc: string | null;
  propio: boolean;
  /** Retiro en proveedor: no se repite el viaje, se repite el pedido de materiales. */
  materialId?: string | null;
};
export type Favorito = { id: string; nombre: string; pedidoId: string; tipo: TipoFavorito; datos: PrecargaMateriales | PrecargaViaje };

const ESTADO_MATERIAL: Record<EstadoOC, { t: string; tono: ItemHistorial["tono"] }> = {
  BORRADOR: { t: "Borrador", tono: "neutro" }, ENVIADA_A_COMPRAS: { t: "Enviado", tono: "aviso" }, EN_COMPRAS: { t: "En Compras", tono: "aviso" },
  ESPERANDO_AUTORIZACION: { t: "Esperando autorización", tono: "aviso" }, AUTORIZADA: { t: "Autorizada", tono: "aviso" }, RECHAZADA: { t: "Rechazada", tono: "critico" },
  ENCARGADA: { t: "Encargada", tono: "aviso" }, HABILITADA: { t: "Listo para retirar", tono: "ok" }, ENTREGADA: { t: "Entregada", tono: "ok" }, ANULADA: { t: "Anulada", tono: "critico" },
};
const ESTADO_VIAJE: Record<EstadoPedido, { t: string; tono: ItemHistorial["tono"] }> = {
  PENDIENTE: { t: "Pendiente", tono: "aviso" }, TOMADO: { t: "Aceptado", tono: "aviso" }, EN_VIAJE: { t: "En viaje", tono: "aviso" }, ENTREGADO: { t: "Entregado", tono: "ok" }, CANCELADO: { t: "Cancelado", tono: "critico" },
};

/** "40 bolsas Cemento · 20 barras Hierro del 8" o "lista adjunta (planilla.xlsx)". */
function resumenMaterial(p: { detallePedido: string | null }) {
  const d = p.detallePedido ?? "";
  const m = d.match(/^Ver lista adjunta \((.*)\)$/);
  if (m) return `lista adjunta (${m[1]})`;
  const lineas = d.split("\n").map((l) => l.trim()).filter(Boolean);
  return lineas.length > 2 ? `${lineas.slice(0, 2).join(" · ")} y ${lineas.length - 2} más` : lineas.join(" · ") || "sin detalle";
}
/**
 * Pedidos sin renglones guardados (los viejos, o escritos en una línea): se arman desde la descripción.
 * "40 bolsas Cemento Portland" o "Cemento Portland, 40 bolsas" → { cantidad: 40, unidad: bolsas, descripcion }.
 */
export function renglonesDeDescripcion(descripcion: string): RenglonPrecarga[] {
  if (/^Ver lista adjunta/.test(descripcion)) return [];
  return descripcion.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const adelante = l.match(/^(\d+(?:[.,]\d+)?)\s+([a-zA-Záéíóúñ³²]+)\s+(.+)$/);
    if (adelante) return { cantidad: adelante[1].replace(",", "."), unidad: adelante[2], descripcion: adelante[3] };
    const atras = l.match(/^(.+?),\s*(\d+(?:[.,]\d+)?)\s*([a-zA-Záéíóúñ³²]*)$/);
    if (atras) return { descripcion: atras[1], cantidad: atras[2].replace(",", "."), unidad: atras[3] || "u" };
    return { descripcion: l, cantidad: "", unidad: "u" };
  });
}

const gestiona = (u: Pick<UsuarioSesion, "rol">) => puede(u.rol, "materiales.gestionar") || puede(u.rol, "materiales.aprobar");

/** Qué documentos de compra puede ver en su historial (y repetir). Los borradores e importados, no. */
function alcanceMateriales(u: UsuarioSesion, todas: boolean): Prisma.OrdenCompraWhereInput {
  const base: Prisma.OrdenCompraWhereInput = { estado: { not: "BORRADOR" }, fuente: { not: "IMPORTADA" }, obraId: { not: null } };
  if (todas && gestiona(u)) return base;
  return { AND: [base, { OR: [{ solicitanteId: u.id }, { creadaPorId: u.id }, { obra: filtroObras(u) }] }] };
}

const selMaterial = {
  id: true, numeroInterno: true, creadoEn: true, detallePedido: true, estado: true, solicitanteId: true, creadaPorId: true, obraId: true, obraSedeId: true, observacionesSolicitante: true, prioridad: true,
  numero: true, aprobadaEn: true,
  obra: { select: { nombre: true } },
  proveedor: { select: { nombre: true } },
  renglones: { orderBy: { orden: "asc" as const }, select: { descripcion: true, cantidad: true, unidad: true } },
} satisfies Prisma.OrdenCompraSelect;

export async function historialMateriales(o: { q?: string; todas?: boolean } = {}): Promise<ItemHistorial[]> {
  const u = await exigirSesion();
  const q = o.q?.trim();
  const busqueda: Prisma.OrdenCompraWhereInput = q
    ? { OR: [{ detallePedido: { contains: q, mode: "insensitive" } }, { obra: { nombre: { contains: q, mode: "insensitive" } } }, { numero: { contains: q, mode: "insensitive" } }] }
    : {};
  const filas = await db.ordenCompra.findMany({ where: { AND: [alcanceMateriales(u, !!o.todas), busqueda] }, orderBy: { creadoEn: "desc" }, take: 60, select: selMaterial });
  // Los propios primero (cada grupo, del más nuevo al más viejo).
  const mio = (f: (typeof filas)[number]) => f.solicitanteId === u.id || f.creadaPorId === u.id;
  const ordenados = [...filas.filter(mio), ...filas.filter((f) => !mio(f))].slice(0, LIMITE);
  return ordenados.map((f) => ({
    id: f.id, numero: f.numeroInterno, fecha: f.creadoEn.toISOString(), obra: f.obra?.nombre ?? "", resumen: resumenMaterial(f),
    estado: ESTADO_MATERIAL[f.estado].t, tono: ESTADO_MATERIAL[f.estado].tono, oc: f.numero, propio: mio(f),
  }));
}

export async function historialViajes(o: { q?: string } = {}): Promise<ItemHistorial[]> {
  const u = await exigirSesion();
  const q = o.q?.trim();
  const obras = u.rol === "RESPONSABLE_OBRA" ? await idsObrasDelUsuario(u) : null;
  // Compras: los que pidió y los que coordinó para alguien de obra (salen a nombre de esa persona).
  const base: Prisma.PedidoViajeWhereInput = obras ? { OR: [{ solicitanteId: u.id }, { obraId: { in: obras } }] } : u.rol === "CAPATAZ" || u.rol === "DIRECCION" ? {} : u.rol === "COMPRAS" ? { OR: [{ solicitanteId: u.id }, { coordinadoPorId: u.id }] } : { solicitanteId: u.id };
  const busqueda: Prisma.PedidoViajeWhereInput = q ? { OR: [{ descripcion: { contains: q, mode: "insensitive" } }, { obra: { nombre: { contains: q, mode: "insensitive" } } }, { origenNombre: { contains: q, mode: "insensitive" } }] } : {};
  const filas = await db.pedidoViaje.findMany({
    where: conAlcance(u, { AND: [base, busqueda] }), orderBy: { creadoEn: "desc" }, take: 60,
    select: { id: true, numero: true, creadoEn: true, descripcion: true, estado: true, solicitanteId: true, coordinadoPorId: true, tipo: true, origenNombre: true, obra: { select: { nombre: true } }, materialesListos: { take: 1, select: { ordenCompraId: true, ordenCompraNumero: true } } },
  });
  const mio = (f: (typeof filas)[number]) => f.solicitanteId === u.id || f.coordinadoPorId === u.id;
  const ordenados = [...filas.filter(mio), ...filas.filter((f) => !mio(f))].slice(0, LIMITE);
  return ordenados.map((f) => ({
    id: f.id, numero: f.numero, fecha: f.creadoEn.toISOString(), obra: f.obra.nombre, resumen: `${f.descripcion} · desde ${f.origenNombre.split(" · ")[0]}`,
    estado: ESTADO_VIAJE[f.estado].t, tono: ESTADO_VIAJE[f.estado].tono, oc: f.materialesListos[0]?.ordenCompraNumero ?? null, propio: mio(f),
    materialId: f.tipo === "RETIRO_PROVEEDOR" ? f.materialesListos[0]?.ordenCompraId ?? null : undefined,
  }));
}

/** Lo que hay que precargar para repetir un pedido de material (si lo puede ver). */
export async function precargaMaterial(id: string, todas = false): Promise<PrecargaMateriales | null> {
  const u = await exigirSesion();
  const p = await db.ordenCompra.findFirst({ where: { AND: [{ id }, alcanceMateriales(u, todas || gestiona(u))] }, select: selMaterial });
  if (!p || !p.obraId) return null;
  // Los adjuntos que vio el que pidió (no los internos de Compras).
  const adjuntos = await db.adjunto.findMany({ where: { entidadTipo: "ORDEN_COMPRA", entidadId: p.id, interno: false }, orderBy: { creadoEn: "asc" }, select: { id: true, nombre: true, tipoMime: true, tamanoBytes: true } });
  const oc = p.aprobadaEn && p.numero ? { numero: p.numero, proveedor: p.proveedor?.nombre ?? "el proveedor" } : null;
  // Las observaciones del sistema ("Lo cargó Compras…") no se repiten.
  const observaciones = (p.observacionesSolicitante ?? "").replace(/^Lo cargó .*? por pedido de [^.]+\.\s*/, "");
  const renglones = p.renglones.length
    ? p.renglones.map((x) => ({ descripcion: x.descripcion, cantidad: String(x.cantidad.toNumber()), unidad: x.unidad || "u" }))
    : renglonesDeDescripcion(p.detallePedido ?? "");
  return {
    origen: { id: p.id, numero: p.numeroInterno, fecha: diaISO(p.creadoEn), obra: p.obra?.nombre ?? "", items: renglones.length || adjuntos.length, oc },
    obraId: p.obraId, sedeId: p.obraSedeId,
    renglones,
    adjuntos, observaciones, prioridad: p.prioridad,
  };
}

/** Lo que hay que precargar para repetir un pedido de viaje. Los retiros en proveedor no se repiten (null). */
export async function precargaViaje(id: string): Promise<PrecargaViaje | null> {
  const u = await exigirSesion();
  const p = await db.pedidoViaje.findFirst({
    where: conAlcance(u, { id }),
    select: { id: true, numero: true, creadoEn: true, tipo: true, obraId: true, destinoSedeId: true, descripcion: true, pesoKg: true, origenTipo: true, origenId: true, herramientaId: true, cantidadPersonas: true, prioridad: true, franja: true, paraCuando: true, obra: { select: { nombre: true } } },
  });
  if (!p || p.tipo === "RETIRO_PROVEEDOR") return null;
  const hora = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hour12: false }).format(p.paraCuando);
  return {
    origen: { id: p.id, numero: p.numero, fecha: diaISO(p.creadoEn), obra: p.obra.nombre },
    tipo: p.tipo, obraId: p.obraId, sedeId: p.destinoSedeId, que: p.descripcion, pesoKg: p.pesoKg ? String(p.pesoKg) : "",
    desde: p.tipo === "RETIRO_ESCOMBROS" ? null : { tipo: p.origenTipo, id: p.origenId }, herramientaId: p.herramientaId ?? "",
    personas: p.cantidadPersonas ? String(p.cantidadPersonas) : "", prioridad: p.prioridad, franja: p.franja, hora,
  };
}

/** Los favoritos del usuario (arriba del panel), con su nombre. */
export async function favoritos(tipo: TipoFavorito): Promise<Favorito[]> {
  const u = await exigirSesion();
  const f = await db.pedidoFavorito.findMany({ where: { usuarioId: u.id, tipo, activo: true }, orderBy: { creadoEn: "desc" } });
  return f.map((x) => ({ id: x.id, nombre: x.nombre, pedidoId: x.pedidoId, tipo: x.tipo, datos: x.datos as unknown as PrecargaMateriales | PrecargaViaje }));
}
