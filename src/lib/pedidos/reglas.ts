import "server-only";
import type { Prisma, TipoPedido } from "@prisma/client";
import { db } from "@/lib/db";
import { cuando, dia, diaISO, peso } from "@/lib/formato";
import { ErrorNegocio } from "@/lib/resultado";
import { auditar as auditarBase, type DatosAuditoria } from "@/lib/auditoria";
import { parecido, UMBRAL_PARECIDO } from "./similitud";
import { TIPO, UMBRAL_CAMION_KG } from "./presentacion";

type Cliente = Prisma.TransactionClient | typeof db;

/** Hace falta camión si pesa más de 500 kg o es maquinaria. */
export const necesitaCamion = (tipo: TipoPedido, pesoKg?: number | null) =>
  tipo === "TRASLADO_MAQUINARIA" || (pesoKg ?? 0) > UMBRAL_CAMION_KG;

// ─────────────────────────── Vehículos ───────────────────────────

const conDocumentos = {
  documentos: { where: { tipo: { in: ["SEGURO", "VTV"] } }, select: { tipo: true, vencimiento: true } },
  viajes: { where: { estado: "EN_CURSO" }, select: { chofer: { select: { nombre: true } } }, take: 1 },
} satisfies Prisma.VehiculoInclude;

export type VehiculoConDocs = Prisma.VehiculoGetPayload<{ include: typeof conDocumentos }>;

/** ¿Sirve este vehículo para este pedido? Si no, el motivo en palabras. */
export function aptitud(v: VehiculoConDocs, pedido: { pesoKg: number | null; necesitaCamion: boolean }): { apto: boolean; motivo?: string } {
  // Vigente hasta el día de vencimiento inclusive (comparación por día, hora argentina).
  const vencido = (f: Date) => diaISO(f) < diaISO();
  const doc = (t: "SEGURO" | "VTV") =>
    v.documentos.filter((d) => d.tipo === t).sort((a, b) => (b.vencimiento?.getTime() ?? 0) - (a.vencimiento?.getTime() ?? 0))[0];
  const seguro = doc("SEGURO");
  const vtv = doc("VTV");

  if (!v.activo || v.estado === "FUERA_DE_SERVICIO") return { apto: false, motivo: "Fuera de servicio" };
  if (v.estado === "EN_TALLER") return { apto: false, motivo: "En el taller" };
  if (!seguro?.vencimiento) return { apto: false, motivo: "Sin seguro cargado" };
  if (vencido(seguro.vencimiento)) return { apto: false, motivo: "Seguro vencido" };
  if (vtv && vtv.vencimiento && vencido(vtv.vencimiento)) return { apto: false, motivo: "VTV vencida" };
  if (!vtv?.vencimiento) return { apto: false, motivo: "Sin VTV cargada" };
  if (pedido.necesitaCamion && v.tipo !== "CAMION") return { apto: false, motivo: "Hace falta camión" };
  if (pedido.pesoKg && pedido.pesoKg > v.capacidadCargaKg) return { apto: false, motivo: `Muy chico para ${peso(pedido.pesoKg)}` };
  if (v.estado === "EN_VIAJE" || v.viajes.length) return { apto: false, motivo: `En viaje${v.viajes[0] ? ` con ${v.viajes[0].chofer.nombre}` : ""}` };
  return { apto: true };
}

/** Vehículos de la cola (entraEnCola) y el propio del chofer, cada uno con si sirve y por qué no. */
export async function vehiculosPara(pedido: { pesoKg: number | null; necesitaCamion: boolean }, choferId: string, cliente: Cliente = db) {
  const vehiculos = await cliente.vehiculo.findMany({
    where: { activo: true, OR: [{ entraEnCola: true }, { asignadoAId: choferId }] },
    include: conDocumentos,
    orderBy: [{ tipo: "asc" }, { capacidadCargaKg: "desc" }],
  });
  return vehiculos
    // Si el pedido supera 3 tn, solo aparecen los camiones que alcanzan.
    .filter((v) => !(pedido.pesoKg && pedido.pesoKg > 3000 && (v.tipo !== "CAMION" || v.capacidadCargaKg < pedido.pesoKg)))
    .map((v) => ({ vehiculo: v, ...aptitud(v, pedido) }));
}

export async function vehiculoParaPedido(vehiculoId: string, cliente: Cliente = db) {
  return cliente.vehiculo.findUnique({ where: { id: vehiculoId }, include: conDocumentos });
}

/** Chofer activo con licencia vigente y vehículo que sirve para el pedido; si no, error con el motivo. */
export async function validarChoferYVehiculo(tx: Prisma.TransactionClient, choferId: string, vehiculoId: string, pedido: { pesoKg: number | null; necesitaCamion: boolean }, opciones: { permitirEnViaje?: boolean } = {}) {
  const chofer = await tx.usuario.findUniqueOrThrow({ where: { id: choferId }, select: { nombre: true, rol: true, activo: true, licenciaVencimiento: true } });
  if (chofer.rol !== "CHOFER" || !chofer.activo) throw new ErrorNegocio(`${chofer.nombre} no es un chofer activo.`);
  if (!licenciaVigente(chofer)) throw new ErrorNegocio(`La licencia de ${chofer.nombre} está vencida o sin cargar. No puede manejar para la empresa.`);
  const v = await vehiculoParaPedido(vehiculoId, tx);
  if (!v) throw new ErrorNegocio("No existe ese vehículo.");
  if (!v.entraEnCola && v.asignadoAId !== choferId) throw new ErrorNegocio(`${v.nombre} no se usa para pedidos.`);
  const a = aptitud(v, pedido);
  if (!a.apto && !(opciones.permitirEnViaje && a.motivo?.startsWith("En viaje"))) {
    throw new ErrorNegocio(`No se puede usar ${v.nombre}: ${a.motivo?.toLowerCase()}.`);
  }
  return { chofer, vehiculo: v };
}

// ─────────────────────────── Choferes ───────────────────────────

export function licenciaVigente(c: { licenciaVencimiento: Date | null }) {
  return !!c.licenciaVencimiento && diaISO(c.licenciaVencimiento) >= diaISO();
}

/** Licencias profesionales que habilitan camión (C, D, E). */
export const puedeManejarCamion = (categoria: string | null) => !!categoria && /^[CDE]/i.test(categoria);

/** Choferes que van a ver el pedido: los activos con licencia vigente (y de camión si hace falta). */
export async function choferesQueLoVen(camion: boolean) {
  const choferes = await db.usuario.findMany({
    where: { rol: "CHOFER", activo: true },
    select: { nombre: true, licenciaCategoria: true, licenciaVencimiento: true },
    orderBy: { nombre: "asc" },
  });
  return choferes.filter((c) => licenciaVigente(c) && (!camion || puedeManejarCamion(c.licenciaCategoria))).map((c) => c.nombre);
}

// ─────────────────────────── Duplicados ───────────────────────────

export type Duplicado = { id: string; numero: number; quien: string; cuando: string; resumen: string };

/**
 * ¿Ya hay un pedido igual? Misma obra, mismo tipo, PENDIENTE o TOMADO, en las últimas 48 h,
 * y mismo proveedor o descripción muy parecida.
 */
export async function buscarDuplicado(p: { obraId: string; tipo: TipoPedido; proveedorId?: string | null; descripcion: string }): Promise<Duplicado | null> {
  const candidatos = await db.pedidoViaje.findMany({
    where: {
      obraId: p.obraId,
      tipo: p.tipo,
      estado: { in: ["PENDIENTE", "TOMADO"] },
      creadoEn: { gte: new Date(Date.now() - 48 * 3_600_000) },
    },
    orderBy: { creadoEn: "asc" },
    include: { solicitante: { select: { nombre: true } }, proveedor: { select: { nombre: true } }, obra: { select: { nombre: true } } },
  });
  const igual = candidatos.find(
    (c) => (p.proveedorId && c.proveedorId === p.proveedorId) || parecido(c.descripcion, p.descripcion) >= UMBRAL_PARECIDO,
  );
  if (!igual) return null;
  const d = dia(igual.creadoEn);
  return {
    id: igual.id,
    numero: igual.numero,
    quien: igual.solicitante.nombre,
    cuando: d === "hoy" ? `hoy a las ${cuando(igual.creadoEn).slice(4)}` : d,
    resumen: [TIPO[igual.tipo].corto, igual.descripcion, igual.proveedor ? `de ${igual.proveedor.nombre}` : null, `para Obra ${igual.obra.nombre}`]
      .filter(Boolean)
      .join(" · "),
  };
}

// ─────────────────────────── Auditoría ───────────────────────────

export async function auditar(cliente: Cliente, d: Omit<DatosAuditoria, "entidad"> & { entidad?: string }) {
  await auditarBase(cliente, { entidad: "PedidoViaje", ...d });
}

/** Para los resúmenes: "el pedido #12 (Hierro del 10, 40 barras) para Obra Darwin". */
export async function describirPedido(cliente: Cliente, pedidoId: string) {
  const p = await cliente.pedidoViaje.findUnique({ where: { id: pedidoId }, select: { numero: true, descripcion: true, obra: { select: { nombre: true } } } });
  if (!p) return "un pedido";
  const desc = p.descripcion.length > 40 ? `${p.descripcion.slice(0, 40)}…` : p.descripcion;
  return `el pedido #${p.numero} (${desc}) para Obra ${p.obra.nombre}`;
}
