import "server-only";
import type { EstadoPedido, Prioridad, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { conAlcance } from "@/lib/alcance";
import { finDelDia, inicioDelDia } from "@/lib/formato";

/**
 * SOLICITUDES CON FILTROS (Compras → Viajes → Solicitudes y Dirección → Solicitudes): todas las
 * solicitudes de viaje (pendientes, aceptadas, en curso y lo entregado hoy) con chips combinables. Al
 * filtrar por quién pidió o por un estado terminado, aparece también la historia (con paginado).
 * Orden por defecto: fecha necesaria más cercana primero.
 */
export const POR_PAGINA = 50;
const ESTADOS: EstadoPedido[] = ["PENDIENTE", "TOMADO", "EN_VIAJE", "ENTREGADO", "CANCELADO"];

export type FiltrosSolicitudes = { obra: string[]; lugar: string[]; pidio: string[]; prioridad: Prioridad[]; estado: EstadoPedido[]; chofer: string[]; q?: string; orden: string; pagina: number };

const lista = (v: unknown) => (typeof v === "string" && v ? v.split(",").filter(Boolean).slice(0, 50) : []);
export function leerFiltrosSolicitudes(sp: Record<string, string | string[] | undefined>): FiltrosSolicitudes {
  return {
    obra: lista(sp.obra), lugar: lista(sp.lugar), pidio: lista(sp.pidio), chofer: lista(sp.chofer),
    prioridad: lista(sp.prioridad).filter((p): p is Prioridad => p === "URGENTE" || p === "NORMAL"),
    estado: lista(sp.estado).filter((e): e is EstadoPedido => (ESTADOS as string[]).includes(e)),
    q: typeof sp.q === "string" ? sp.q.trim().slice(0, 100) || undefined : undefined,
    orden: typeof sp.orden === "string" ? sp.orden : "fecha",
    pagina: Math.max(1, Number(sp.pagina) || 1),
  };
}

/** Sin filtro de persona ni de estado terminado: lo vivo (pendiente, aceptado, en curso) y lo entregado hoy. */
function alcanceTemporal(f: FiltrosSolicitudes): Prisma.PedidoViajeWhereInput {
  const historia = f.pidio.length > 0 || f.estado.some((e) => e === "ENTREGADO" || e === "CANCELADO");
  if (historia) return f.estado.length ? { estado: { in: f.estado } } : {};
  const vivos: Prisma.PedidoViajeWhereInput = { OR: [{ estado: { in: ["PENDIENTE", "TOMADO", "EN_VIAJE"] } }, { estado: "ENTREGADO", actualizadoEn: { gte: inicioDelDia(), lte: finDelDia() } }] };
  return f.estado.length ? { AND: [vivos, { estado: { in: f.estado } }] } : vivos;
}

export function whereSolicitudes(f: FiltrosSolicitudes, sin: "lugar" | "pidio" | null = null): Prisma.PedidoViajeWhereInput {
  const y: Prisma.PedidoViajeWhereInput[] = [alcanceTemporal(sin === "pidio" ? { ...f, pidio: [] } : f)];
  if (f.obra.length) y.push({ obraId: { in: f.obra } });
  if (f.lugar.length && sin !== "lugar") y.push({ origenNombre: { in: f.lugar } });
  if (f.pidio.length && sin !== "pidio") y.push({ solicitanteId: { in: f.pidio } });
  if (f.prioridad.length) y.push({ prioridad: { in: f.prioridad } });
  if (f.chofer.length) y.push({ tomadoPorId: { in: f.chofer } });
  if (f.q) y.push({ OR: [{ descripcion: { contains: f.q, mode: "insensitive" } }, { origenNombre: { contains: f.q, mode: "insensitive" } }, { destinoNombre: { contains: f.q, mode: "insensitive" } }] });
  return { AND: y };
}

const seleccion = {
  id: true, numero: true, estado: true, tipo: true, descripcion: true, paraCuando: true, franja: true, prioridad: true, origenNombre: true, destinoNombre: true, esRetiroMaterial: true, pesoKg: true, necesitaCamion: true,
  obra: { select: { id: true, nombre: true } }, solicitante: { select: { id: true, nombre: true } }, coordinadoPor: { select: { nombre: true } }, tomadoPor: { select: { nombre: true } },
  viaje: { select: { etapa: true, vehiculo: { select: { nombre: true } } } },
} satisfies Prisma.PedidoViajeSelect;
export type FiltroSolicitud = Prisma.PedidoViajeGetPayload<{ select: typeof seleccion }>;

export const ORDENES_SOLICITUDES = [
  { valor: "fecha", etiqueta: "Fecha necesaria (más cercana)" },
  { valor: "fecha-lejana", etiqueta: "Fecha necesaria (más lejana)" },
  { valor: "nuevos", etiqueta: "Pedidos más nuevos" },
];

export async function solicitudesFiltradas(f: FiltrosSolicitudes) {
  const u = await exigirSesion();
  if (!puede(u.rol, "pedidos.coordinar") && !puede(u.rol, "pedidos.reasignar")) throw new Error("Sin permiso");
  const where = conAlcance(u, whereSolicitudes(f));
  const orderBy: Prisma.PedidoViajeOrderByWithRelationInput[] =
    f.orden === "fecha-lejana" ? [{ paraCuando: "desc" }] : f.orden === "nuevos" ? [{ creadoEn: "desc" }] : [{ paraCuando: "asc" }, { prioridad: "desc" }];
  const [total, filas] = await Promise.all([
    db.pedidoViaje.count({ where }),
    db.pedidoViaje.findMany({ where, orderBy, skip: (f.pagina - 1) * POR_PAGINA, take: POR_PAGINA, select: seleccion }),
  ]);
  return { filas, total, paginas: Math.max(1, Math.ceil(total / POR_PAGINA)), editar: puede(u.rol, "pedidos.coordinar") || puede(u.rol, "pedidos.reprogramar"), asignar: puede(u.rol, "pedidos.reasignar") };
}

/** Opciones de los chips y los grupos: "Corralón San Martín · 3 retiros", "Daniela 6". */
export async function opcionesSolicitudes(f: FiltrosSolicitudes) {
  const u = await exigirSesion();
  const vivos = conAlcance(u, whereSolicitudes({ ...f, obra: [], lugar: [], pidio: [], prioridad: [], chofer: [], estado: [], q: undefined }));
  const [porLugar, porObra, porPersona, porChofer, porEstado, lugaresFiltrados, obras, usuarios] = await Promise.all([
    db.pedidoViaje.groupBy({ by: ["origenNombre"], where: vivos, _count: true }),
    db.pedidoViaje.groupBy({ by: ["obraId"], where: vivos, _count: true }),
    db.pedidoViaje.groupBy({ by: ["solicitanteId"], where: conAlcance(u, {}), _count: true }),
    db.pedidoViaje.groupBy({ by: ["tomadoPorId"], where: { ...vivos, tomadoPorId: { not: null } }, _count: true }),
    db.pedidoViaje.groupBy({ by: ["estado"], where: vivos, _count: true }),
    // Los grupos por lugar respetan los demás filtros (obra, prioridad, persona…).
    db.pedidoViaje.groupBy({ by: ["origenNombre"], where: conAlcance(u, whereSolicitudes(f, "lugar")), _count: true, orderBy: { _count: { origenNombre: "desc" } } }),
    db.obra.findMany({ select: { id: true, nombre: true } }),
    db.usuario.findMany({ select: { id: true, nombre: true } }),
  ]);
  const nombre = (xs: { id: string; nombre: string }[], id: string | null) => xs.find((x) => x.id === id)?.nombre ?? "—";
  const ord = <T extends { etiqueta: string }>(xs: T[]) => xs.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
  return {
    lugares: ord(porLugar.map((x) => ({ valor: x.origenNombre, etiqueta: x.origenNombre, cantidad: x._count }))),
    obras: ord(porObra.map((x) => ({ valor: x.obraId, etiqueta: `Obra ${nombre(obras, x.obraId)}`, cantidad: x._count }))),
    personas: ord(porPersona.map((x) => ({ valor: x.solicitanteId, etiqueta: nombre(usuarios, x.solicitanteId), cantidad: x._count }))),
    choferes: ord(porChofer.map((x) => ({ valor: x.tomadoPorId!, etiqueta: nombre(usuarios, x.tomadoPorId), cantidad: x._count }))),
    estados: porEstado.map((x) => ({ valor: x.estado, cantidad: x._count })),
    grupos: lugaresFiltrados.map((x) => ({ lugar: x.origenNombre, cantidad: x._count })),
  };
}
