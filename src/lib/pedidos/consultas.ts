import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import type { UsuarioSesion } from "@/lib/auth/sesion";
import { inicioDelDia } from "@/lib/formato";
import { vehiculosPara } from "./reglas";

const seleccion = {
  id: true, numero: true, tipo: true, estado: true, prioridad: true, descripcion: true, pesoKg: true, cantidadPersonas: true,
  necesitaCamion: true, paraCuando: true, franja: true, ordenCompraLebane: true, origenTipo: true, origenId: true,
  motivoCancelacion: true, canceladoEn: true, creadoEn: true, tomadoEn: true, solicitanteId: true, tomadoPorId: true,
  obra: { select: { id: true, nombre: true, direccion: true, localidad: true } },
  proveedor: { select: { nombre: true, direccion: true, localidad: true, telefono: true } },
  solicitante: { select: { nombre: true } },
  tomadoPor: { select: { nombre: true } },
  viaje: {
    select: {
      id: true, estado: true, salidaEstimada: true, salidaReal: true, llegadaReal: true, kmSalida: true, kmLlegada: true,
      ordenRuta: true, peajes: true, costoCalculado: true, vehiculo: { select: { id: true, nombre: true, patente: true } },
    },
  },
} satisfies Prisma.PedidoViajeSelect;

type Fila = Prisma.PedidoViajeGetPayload<{ select: typeof seleccion }>;

/** Nombre del lugar de origen (Proveedor, Obra o Ubicación). */
async function nombresDeOrigen(filas: Fila[]) {
  const obras = filas.filter((f) => f.origenTipo === "OBRA").map((f) => f.origenId);
  const ubic = filas.filter((f) => f.origenTipo === "BASE" || f.origenTipo === "DEPOSITO").map((f) => f.origenId);
  const [o, u] = await Promise.all([
    obras.length ? db.obra.findMany({ where: { id: { in: obras } }, select: { id: true, nombre: true, direccion: true, localidad: true } }) : [],
    ubic.length ? db.ubicacion.findMany({ where: { id: { in: ubic } }, select: { id: true, nombre: true, direccion: true } }) : [],
  ]);
  const mapa = new Map<string, { nombre: string; direccion: string }>([
    ...o.map((x) => [x.id, { nombre: `Obra ${x.nombre}`, direccion: `${x.direccion}, ${x.localidad}` }] as const),
    ...u.map((x) => [x.id, { nombre: x.nombre, direccion: x.direccion }] as const),
  ]);
  return (f: Fila) =>
    f.proveedor ? { nombre: f.proveedor.nombre, direccion: `${f.proveedor.direccion}, ${f.proveedor.localidad}` } : mapa.get(f.origenId) ?? { nombre: "—", direccion: "" };
}

/** Plano y sin Decimal: listo para pasar a componentes cliente. */
function plano(f: Fila, origen: { nombre: string; direccion: string }) {
  return {
    ...f,
    origen,
    viaje: f.viaje ? { ...f.viaje, peajes: Number(f.viaje.peajes), costoCalculado: f.viaje.costoCalculado == null ? null : Number(f.viaje.costoCalculado) } : null,
  };
}

export type PedidoPlano = ReturnType<typeof plano>;

async function aplanar(filas: Fila[]) {
  const origen = await nombresDeOrigen(filas);
  return filas.map((f) => plano(f, origen(f)));
}

// ─────────────────────────────── Cola ───────────────────────────────

export const FILTROS = {
  pendientes: "Pendientes",
  "en-curso": "En curso",
  "entregados-hoy": "Entregados hoy",
  mios: "Míos",
} as const;
export type Filtro = keyof typeof FILTROS;

function whereFiltro(filtro: Filtro, u: UsuarioSesion, misObras: string[] = []): Prisma.PedidoViajeWhereInput {
  switch (filtro) {
    case "pendientes":
      return { estado: "PENDIENTE" };
    case "en-curso":
      return { estado: { in: ["TOMADO", "EN_VIAJE"] } };
    case "entregados-hoy":
      return { estado: "ENTREGADO", viaje: { llegadaReal: { gte: inicioDelDia() } } };
    case "mios":
      return {
        // Lo que pedí, lo que tomé y lo que se lleva una herramienta de mis obras.
        OR: [{ solicitanteId: u.id }, { tomadoPorId: u.id }, ...(misObras.length ? [{ origenTipo: "OBRA" as const, origenId: { in: misObras }, herramientaId: { not: null } }] : [])],
        AND: [{ OR: [{ estado: { in: ["PENDIENTE", "TOMADO", "EN_VIAJE"] } }, { estado: "ENTREGADO", viaje: { llegadaReal: { gte: new Date(Date.now() - 2 * 86_400_000) } } }, { estado: "CANCELADO", canceladoEn: { gte: new Date(Date.now() - 2 * 86_400_000) } }] }],
      };
  }
}

/** La cola única: urgentes primero, después por fecha pedida. La ven todos los roles. */
export async function cola(filtro: Filtro) {
  const u = await exigirPermiso("pedidos.ver");
  const misObras = u.rol === "RESPONSABLE_OBRA" ? (await db.obra.findMany({ where: { responsableId: u.id }, select: { id: true } })).map((o) => o.id) : [];
  const orden: Prisma.PedidoViajeOrderByWithRelationInput[] =
    filtro === "entregados-hoy" ? [{ viaje: { llegadaReal: "desc" } }] : [{ prioridad: "desc" }, { paraCuando: "asc" }, { creadoEn: "asc" }];
  const [filas, conteos] = await Promise.all([
    db.pedidoViaje.findMany({ where: whereFiltro(filtro, u, misObras), select: seleccion, orderBy: orden, take: 200 }),
    Promise.all((Object.keys(FILTROS) as Filtro[]).map(async (f) => [f, await db.pedidoViaje.count({ where: whereFiltro(f, u, misObras) })] as const)),
  ]);
  return { pedidos: await aplanar(filas), conteos: Object.fromEntries(conteos) as Record<Filtro, number> };
}

export async function pedido(id: string) {
  await exigirPermiso("pedidos.ver");
  const f = await db.pedidoViaje.findUnique({ where: { id }, select: seleccion });
  if (!f) return null;
  return (await aplanar([f]))[0];
}

/** Historia del pedido desde la auditoría (quién hizo qué y cuándo). */
export async function historia(id: string) {
  await exigirPermiso("pedidos.ver");
  const eventos = await db.auditoria.findMany({
    where: { entidad: "PedidoViaje", entidadId: id },
    orderBy: { fecha: "asc" },
    select: { accion: true, fecha: true, despues: true, usuario: { select: { nombre: true } } },
  });
  return eventos.map((e) => ({ ...e, despues: e.despues as Record<string, unknown> | null }));
}

// ─────────────────────────── Para tomar ───────────────────────────

export type OpcionVehiculo = { id: string; nombre: string; detalle: string; apto: boolean; motivo?: string };

export async function vehiculosParaTomar(p: { pesoKg: number | null; necesitaCamion: boolean }, choferId?: string): Promise<OpcionVehiculo[]> {
  const u = choferId ? await exigirPermiso("pedidos.reasignar") : await exigirPermiso("pedidos.tomar");
  const lista = await vehiculosPara(p, choferId ?? u.id);
  return lista
    .map(({ vehiculo: v, apto, motivo }) => ({
      id: v.id,
      nombre: v.nombre,
      detalle: `${v.patente} · carga ${v.capacidadCargaKg >= 1000 ? `${v.capacidadCargaKg / 1000} tn` : `${v.capacidadCargaKg} kg`}`,
      apto,
      motivo,
    }))
    .sort((a, b) => Number(b.apto) - Number(a.apto));
}

/** Para dirección al reasignar: choferes y los vehículos de la cola. */
export async function opcionesReasignar(p: { pesoKg: number | null; necesitaCamion: boolean }) {
  await exigirPermiso("pedidos.reasignar");
  const choferes = await db.usuario.findMany({ where: { rol: "CHOFER", activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } });
  const porChofer = await Promise.all(choferes.map(async (c) => [c.id, await vehiculosParaTomar(p, c.id)] as const));
  return { choferes, vehiculos: Object.fromEntries(porChofer) as Record<string, OpcionVehiculo[]> };
}

/** Ruta del día del chofer: sus viajes programados en orden. */
export async function miRuta() {
  const u = await exigirPermiso("pedidos.tomar");
  const filas = await db.pedidoViaje.findMany({
    where: { tomadoPorId: u.id, estado: { in: ["TOMADO", "EN_VIAJE"] } },
    select: seleccion,
  });
  const lista = await aplanar(filas);
  return lista.sort((a, b) => {
    if (a.estado !== b.estado) return a.estado === "EN_VIAJE" ? -1 : 1;
    return (a.viaje?.ordenRuta ?? 999) - (b.viaje?.ordenRuta ?? 999);
  });
}

export async function tengoViajeEnCurso() {
  const u = await exigirPermiso("pedidos.tomar");
  return (await db.viaje.count({ where: { choferId: u.id, estado: "EN_CURSO" } })) > 0;
}

// ─────────────────────────── Formulario ───────────────────────────

export async function datosFormulario() {
  const u = await exigirPermiso("pedidos.crear");
  const [obras, todasLasObras, proveedores, ubicaciones, herramientas] = await Promise.all([
    db.obra.findMany({
      where: { estado: "ACTIVA", ...(u.rol === "RESPONSABLE_OBRA" ? { responsableId: u.id } : {}) },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, direccion: true, localidad: true },
    }),
    db.obra.findMany({ where: { estado: "ACTIVA" }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    db.proveedor.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true, direccion: true, localidad: true } }),
    db.ubicacion.findMany({ orderBy: { tipo: "asc" }, select: { id: true, nombre: true, tipo: true } }),
    db.herramienta.findMany({
      where: { activo: true, estado: { in: ["DISPONIBLE", "EN_OBRA"] } },
      orderBy: [{ esMaquina: "desc" }, { nombre: "asc" }],
      select: { id: true, codigo: true, nombre: true, esMaquina: true, ubicacionId: true, obraId: true, obra: { select: { nombre: true } } },
    }),
  ]);
  return {
    obras: obras.map((o) => ({ id: o.id, nombre: o.nombre, direccion: `${o.direccion}, ${o.localidad}` })),
    todasLasObras,
    proveedores: proveedores.map((p) => ({ id: p.id, nombre: p.nombre, detalle: `${p.direccion}, ${p.localidad}` })),
    ubicaciones: ubicaciones.map((x) => ({ id: x.id, nombre: x.nombre, tipo: x.tipo === "DEPOSITO" ? ("DEPOSITO" as const) : ("BASE" as const) })),
    herramientas: herramientas.map((h) => ({
      id: h.id,
      nombre: h.nombre,
      esMaquina: h.esMaquina,
      lugar: h.obraId ? { tipo: "OBRA" as const, id: h.obraId, nombre: `Obra ${h.obra?.nombre}` } : h.ubicacionId ? { tipo: "DEPOSITO" as const, id: h.ubicacionId, nombre: "Depósito" } : null,
    })),
  };
}

export type DatosFormulario = Awaited<ReturnType<typeof datosFormulario>>;
