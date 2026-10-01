import "server-only";
import type { EstadoPedido, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { problemasVehiculo } from "@/lib/acciones/comun";
import { peso, km } from "@/lib/formato";
import { TIPO_VEHICULO } from "@/lib/etiquetas";

const seleccion = {
  id: true, numero: true, estado: true, prioridad: true, tipoCarga: true, descripcion: true, pesoKg: true,
  vehiculoRequerido: true, necesarioPara: true, observaciones: true, creadoEn: true, tomadoEn: true, origenTexto: true,
  canceladoEn: true, motivoCancelacion: true, solicitanteId: true, choferId: true,
  obra: { select: { id: true, nombre: true, direccion: true, localidad: true } },
  proveedor: { select: { nombre: true, direccion: true, localidad: true, telefono: true } },
  ordenCompra: { select: { numero: true } },
  solicitante: { select: { nombre: true } },
  chofer: { select: { nombre: true } },
  vehiculo: { select: { nombre: true } },
  viaje: { select: { id: true, estado: true, salidaEn: true, llegadaEn: true, kmSalida: true, kmLlegada: true, kmRecorridos: true, costo: true, peajes: true, costoKmAplicado: true, observaciones: true } },
} satisfies Prisma.PedidoViajeSelect;

type Fila = Prisma.PedidoViajeGetPayload<{ select: typeof seleccion }>;

/** Versión plana para pasar a componentes (sin Decimal). */
function plano(p: Fila) {
  return {
    ...p,
    origen: p.proveedor ? p.proveedor.nombre : p.origenTexto ?? "—",
    origenDireccion: p.proveedor ? [p.proveedor.direccion, p.proveedor.localidad].filter(Boolean).join(", ") : null,
    viaje: p.viaje
      ? { ...p.viaje, costo: p.viaje.costo == null ? null : Number(p.viaje.costo), peajes: Number(p.viaje.peajes), costoKmAplicado: Number(p.viaje.costoKmAplicado) }
      : null,
  };
}

export type PedidoPlano = ReturnType<typeof plano>;

const ORDEN_COLA: Prisma.PedidoViajeOrderByWithRelationInput[] = [{ prioridad: "desc" }, { creadoEn: "asc" }];

/** La cola única: lo que falta tomar, lo tomado y lo que está en viaje. */
export async function obtenerCola(filtro: { obraIds?: string[] | null } = {}) {
  const where: Prisma.PedidoViajeWhereInput = {
    estado: { in: ["PENDIENTE", "TOMADO", "EN_VIAJE"] },
    ...(filtro.obraIds ? { obraId: { in: filtro.obraIds } } : {}),
  };
  const filas = await db.pedidoViaje.findMany({ where, select: seleccion, orderBy: ORDEN_COLA });
  const lista = filas.map(plano);
  return {
    pendientes: lista.filter((p) => p.estado === "PENDIENTE"),
    tomados: lista.filter((p) => p.estado === "TOMADO"),
    enViaje: lista.filter((p) => p.estado === "EN_VIAJE"),
  };
}

export async function obtenerHistorial(filtro: { obraIds?: string[] | null; dias?: number; estados?: EstadoPedido[] } = {}) {
  const desde = new Date(Date.now() - (filtro.dias ?? 30) * 24 * 3600 * 1000);
  const filas = await db.pedidoViaje.findMany({
    where: {
      estado: { in: filtro.estados ?? ["ENTREGADO", "CANCELADO"] },
      actualizadoEn: { gte: desde },
      ...(filtro.obraIds ? { obraId: { in: filtro.obraIds } } : {}),
    },
    select: seleccion,
    orderBy: { actualizadoEn: "desc" },
    take: 200,
  });
  return filas.map(plano);
}

export async function pedidosDe(solicitanteId: string) {
  const filas = await db.pedidoViaje.findMany({
    where: { solicitanteId, OR: [{ estado: { in: ["PENDIENTE", "TOMADO", "EN_VIAJE"] } }, { actualizadoEn: { gte: new Date(Date.now() - 2 * 24 * 3600 * 1000) } }] },
    select: seleccion,
    orderBy: [{ creadoEn: "desc" }],
    take: 20,
  });
  return filas.map(plano);
}

export async function obtenerPedido(id: string) {
  const p = await db.pedidoViaje.findUnique({ where: { id }, select: seleccion });
  return p ? plano(p) : null;
}

export async function viajeEnCursoDe(choferId: string) {
  const p = await db.pedidoViaje.findFirst({ where: { choferId, estado: "EN_VIAJE" }, select: seleccion });
  return p ? plano(p) : null;
}

export type VehiculoElegible = {
  id: string;
  nombre: string;
  detalle: string;
  kmActual: number;
  disponible: boolean;
  motivo?: string;
};

/**
 * Vehículos para que un chofer salga con un pedido.
 * Si el pedido supera 3 tn, solo aparecen los camiones que alcanzan.
 * Los que no se pueden usar aparecen deshabilitados con el motivo en palabras.
 */
export async function vehiculosParaPedido(choferId: string, pedido: { pesoKg: number | null; vehiculoRequerido: string }): Promise<VehiculoElegible[]> {
  const UMBRAL_SOLO_CAMIONES = 3000;
  const [vehiculos, enViaje] = await Promise.all([
    db.vehiculo.findMany({
      where: {
        activo: true,
        disponibleParaPedidos: true,
        OR: [{ asignadoAId: null }, { asignadoAId: choferId }],
        ...(pedido.pesoKg && pedido.pesoKg > UMBRAL_SOLO_CAMIONES ? { tipo: "CAMION", capacidadKg: { gte: pedido.pesoKg } } : {}),
      },
      orderBy: [{ asignadoAId: "asc" }, { tipo: "asc" }, { capacidadKg: "desc" }],
    }),
    db.viaje.findMany({ where: { estado: "EN_VIAJE" }, select: { vehiculoId: true, chofer: { select: { nombre: true } } } }),
  ]);
  const ocupados = new Map(enViaje.map((v) => [v.vehiculoId, v.chofer.nombre]));

  return vehiculos
    .map((v) => {
      const motivos: string[] = [];
      const problemas = problemasVehiculo(v);
      if (problemas.length) motivos.push(`No se puede usar: ${problemas.join(" y ")}`);
      if (ocupados.has(v.id)) motivos.push(`En viaje con ${ocupados.get(v.id)}`);
      if (pedido.pesoKg && pedido.pesoKg > v.capacidadKg) motivos.push(`Carga hasta ${peso(v.capacidadKg)}`);
      if (pedido.vehiculoRequerido !== "CUALQUIERA" && pedido.vehiculoRequerido !== v.tipo) {
        motivos.push(`El pedido necesita ${TIPO_VEHICULO[pedido.vehiculoRequerido as keyof typeof TIPO_VEHICULO].toLowerCase()}`);
      }
      return {
        id: v.id,
        nombre: v.nombre,
        detalle: `${v.patente} · carga ${peso(v.capacidadKg)} · ${km(v.kmActual)}`,
        kmActual: v.kmActual,
        disponible: motivos.length === 0,
        motivo: motivos[0],
      };
    })
    .sort((a, b) => Number(b.disponible) - Number(a.disponible));
}
