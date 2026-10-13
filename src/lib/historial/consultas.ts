import "server-only";
import type { EstadoMaterial, EstadoPedido, Franja, OrigenTipo, Prioridad, Prisma, TipoFavorito, TipoPedido } from "@prisma/client";
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

const ESTADO_MATERIAL: Record<EstadoMaterial, { t: string; tono: ItemHistorial["tono"] }> = {
  SOLICITADO: { t: "Pedido", tono: "aviso" }, EN_COMPRA: { t: "En compra", tono: "aviso" }, ESPERANDO_APROBACION: { t: "Esperando aprobación", tono: "aviso" },
  APROBADO: { t: "Aprobado", tono: "aviso" }, LISTO_PARA_RETIRAR: { t: "Listo para retirar", tono: "ok" }, RETIRO_PEDIDO: { t: "Retiro pedido", tono: "aviso" },
  EN_CAMINO: { t: "En camino", tono: "aviso" }, ENTREGADO: { t: "Entregado", tono: "ok" }, CANCELADO: { t: "Cancelado", tono: "critico" },
};
const ESTADO_VIAJE: Record<EstadoPedido, { t: string; tono: ItemHistorial["tono"] }> = {
  PENDIENTE: { t: "Pendiente", tono: "aviso" }, TOMADO: { t: "Aceptado", tono: "aviso" }, EN_VIAJE: { t: "En viaje", tono: "aviso" }, ENTREGADO: { t: "Entregado", tono: "ok" }, CANCELADO: { t: "Cancelado", tono: "critico" },
};

/** "40 bolsas Cemento · 20 barras Hierro del 8" o "lista adjunta (planilla.xlsx)". */
function resumenMaterial(p: { descripcion: string; renglones: Prisma.JsonValue }) {
  const r = Array.isArray(p.renglones) ? (p.renglones as { descripcion?: string; cantidad?: number | null; unidad?: string | null }[]) : [];
  if (r.length) {
    const t = r.slice(0, 2).map((x) => [x.cantidad != null ? x.cantidad.toLocaleString("es-AR") : null, x.unidad, x.descripcion].filter(Boolean).join(" ")).join(" · ");
    return r.length > 2 ? `${t} y ${r.length - 2} más` : t;
  }
  const m = p.descripcion.match(/^Ver lista adjunta \((.*)\)$/);
  return m ? `lista adjunta (${m[1]})` : p.descripcion.split("\n").slice(0, 2).join(" · ");
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

/** Qué pedidos de material puede ver en su historial (y repetir). */
function alcanceMateriales(u: UsuarioSesion, todas: boolean): Prisma.PedidoMaterialWhereInput {
  if (todas && gestiona(u)) return {};
  return { OR: [{ solicitanteId: u.id }, { obra: filtroObras(u) }] };
}

const selMaterial = {
  id: true, numero: true, creadoEn: true, descripcion: true, renglones: true, estado: true, solicitanteId: true, obraId: true, obraSedeId: true, observaciones: true, prioridad: true,
  obra: { select: { nombre: true } },
  ordenCompra: { select: { numero: true, estado: true, proveedor: { select: { nombre: true } } } },
} satisfies Prisma.PedidoMaterialSelect;

export async function historialMateriales(o: { q?: string; todas?: boolean } = {}): Promise<ItemHistorial[]> {
  const u = await exigirSesion();
  const q = o.q?.trim();
  const busqueda: Prisma.PedidoMaterialWhereInput = q
    ? { OR: [{ descripcion: { contains: q, mode: "insensitive" } }, { obra: { nombre: { contains: q, mode: "insensitive" } } }, { ordenesCompra: { some: { numero: { contains: q, mode: "insensitive" } } } }] }
    : {};
  const filas = await db.pedidoMaterial.findMany({ where: { AND: [alcanceMateriales(u, !!o.todas), busqueda] }, orderBy: { creadoEn: "desc" }, take: 60, select: selMaterial });
  // Los propios primero (cada grupo, del más nuevo al más viejo).
  const ordenados = [...filas.filter((f) => f.solicitanteId === u.id), ...filas.filter((f) => f.solicitanteId !== u.id)].slice(0, LIMITE);
  return ordenados.map((f) => ({
    id: f.id, numero: f.numero, fecha: f.creadoEn.toISOString(), obra: f.obra.nombre, resumen: resumenMaterial(f),
    estado: ESTADO_MATERIAL[f.estado].t, tono: ESTADO_MATERIAL[f.estado].tono, oc: f.ordenCompra?.numero ?? null, propio: f.solicitanteId === u.id,
  }));
}

export async function historialViajes(o: { q?: string } = {}): Promise<ItemHistorial[]> {
  const u = await exigirSesion();
  const q = o.q?.trim();
  const obras = u.rol === "RESPONSABLE_OBRA" ? await idsObrasDelUsuario(u) : null;
  const base: Prisma.PedidoViajeWhereInput = obras ? { OR: [{ solicitanteId: u.id }, { obraId: { in: obras } }] } : u.rol === "CAPATAZ" || u.rol === "DIRECCION" ? {} : { solicitanteId: u.id };
  const busqueda: Prisma.PedidoViajeWhereInput = q ? { OR: [{ descripcion: { contains: q, mode: "insensitive" } }, { obra: { nombre: { contains: q, mode: "insensitive" } } }, { origenNombre: { contains: q, mode: "insensitive" } }] } : {};
  const filas = await db.pedidoViaje.findMany({
    where: conAlcance(u, { AND: [base, busqueda] }), orderBy: { creadoEn: "desc" }, take: 60,
    select: { id: true, numero: true, creadoEn: true, descripcion: true, estado: true, solicitanteId: true, tipo: true, origenNombre: true, obra: { select: { nombre: true } }, materialesListos: { take: 1, select: { pedidoMaterialId: true, ordenCompraNumero: true } } },
  });
  const ordenados = [...filas.filter((f) => f.solicitanteId === u.id), ...filas.filter((f) => f.solicitanteId !== u.id)].slice(0, LIMITE);
  return ordenados.map((f) => ({
    id: f.id, numero: f.numero, fecha: f.creadoEn.toISOString(), obra: f.obra.nombre, resumen: `${f.descripcion} · desde ${f.origenNombre.split(" · ")[0]}`,
    estado: ESTADO_VIAJE[f.estado].t, tono: ESTADO_VIAJE[f.estado].tono, oc: f.materialesListos[0]?.ordenCompraNumero ?? null, propio: f.solicitanteId === u.id,
    materialId: f.tipo === "RETIRO_PROVEEDOR" ? f.materialesListos[0]?.pedidoMaterialId ?? null : undefined,
  }));
}

/** Lo que hay que precargar para repetir un pedido de material (si lo puede ver). */
export async function precargaMaterial(id: string, todas = false): Promise<PrecargaMateriales | null> {
  const u = await exigirSesion();
  const p = await db.pedidoMaterial.findFirst({ where: { AND: [{ id }, alcanceMateriales(u, todas || gestiona(u))] }, select: selMaterial });
  if (!p) return null;
  const r = Array.isArray(p.renglones) ? (p.renglones as { descripcion?: string; cantidad?: number | null; unidad?: string | null }[]) : [];
  // Los adjuntos que vio el que pidió (no los internos de Compras).
  const adjuntos = await db.adjunto.findMany({ where: { entidadTipo: "PEDIDO_MATERIAL", entidadId: p.id, interno: false }, orderBy: { creadoEn: "asc" }, select: { id: true, nombre: true, tipoMime: true, tamanoBytes: true } });
  const oc = p.ordenCompra && p.ordenCompra.estado === "APROBADA" && p.ordenCompra.numero ? { numero: p.ordenCompra.numero, proveedor: p.ordenCompra.proveedor?.nombre ?? "el proveedor" } : null;
  // Las observaciones del sistema ("Lo cargó Compras…") no se repiten.
  const observaciones = (p.observaciones ?? "").replace(/^Lo cargó .*? por pedido de [^.]+\.\s*/, "");
  const renglones = r.length ? r.map((x) => ({ descripcion: x.descripcion ?? "", cantidad: x.cantidad != null ? String(x.cantidad) : "", unidad: x.unidad || "u" })) : renglonesDeDescripcion(p.descripcion);
  return {
    origen: { id: p.id, numero: p.numero, fecha: diaISO(p.creadoEn), obra: p.obra.nombre, items: renglones.length || adjuntos.length, oc },
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
