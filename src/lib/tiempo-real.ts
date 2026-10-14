import type { EntidadCambio, Prisma, PrismaClient, Rol } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * TIEMPO REAL. Cada cambio que otro usuario puede estar mirando deja un EventoCambio por destinatario;
 * el stream por usuario (/api/tiempo-real/stream) se los entrega y cada pantalla refresca solo si le
 * importa esa entidad (useTiempoReal). Sin "server-only": también lo usan la carga de datos y los jobs.
 *
 * Quién emite:
 *  - notificar() → AVISO al destinatario (todo aviso es un cambio).
 *  - auditar() → toda acción deja auditoría, y con la entidad auditada se resuelven los destinatarios
 *    (cambioDeAuditoria): así ninguna acción se olvida de avisar.
 *  - evaluarAlertas() → ALERTA a quienes les corresponde cada alerta nueva.
 */

type Cliente = Prisma.TransactionClient | PrismaClient;

export type Evento = { id: number; entidad: EntidadCambio; entidadId: string; accion: string };

/** Deja un evento para cada destinatario (sin repetidos). Nunca rompe la acción que lo llama. */
export async function emitirCambio(usuarioIds: (string | null | undefined)[], entidad: EntidadCambio, entidadId: string, accion: string, cliente: Cliente = db) {
  const ids = [...new Set(usuarioIds.filter((x): x is string => !!x))];
  if (!ids.length) return 0;
  try {
    const r = await cliente.eventoCambio.createMany({ data: ids.map((usuarioId) => ({ usuarioId, entidad, entidadId, accion })) });
    return r.count;
  } catch (e) {
    console.error("No se pudo emitir el cambio", entidad, entidadId, e);
    return 0;
  }
}

const conRol = (cliente: Cliente, roles: Rol[]) => cliente.usuario.findMany({ where: { activo: true, rol: { in: roles } }, select: { id: true } }).then((us) => us.map((u) => u.id));
const responsables = (cliente: Cliente, obraIds: string[]) =>
  cliente.responsableObra.findMany({ where: { obraId: { in: obraIds }, activo: true }, select: { usuarioId: true } }).then((r) => r.map((x) => x.usuarioId));

/**
 * Pedido de viaje: el que pidió (y quien lo coordinó), el chofer, los responsables de la obra, TODOS los
 * choferes (la cola de solicitudes: aparece o desaparece), Dirección y Compras. Si va en un viaje con
 * otros pedidos, también los que pidieron esos (cambia su seguimiento).
 */
async function destinosPedidoViaje(cliente: Cliente, pedidoId: string) {
  const p = await cliente.pedidoViaje.findUnique({ where: { id: pedidoId }, select: { solicitanteId: true, coordinadoPorId: true, tomadoPorId: true, obraId: true, esRetiroMaterial: true, viajeId: true } });
  if (!p) return [];
  const delViaje = p.viajeId ? await cliente.pedidoViaje.findMany({ where: { viajeId: p.viajeId }, select: { solicitanteId: true, obraId: true } }) : [];
  const obras = [p.obraId, ...delViaje.map((x) => x.obraId)];
  return [
    p.solicitanteId, p.coordinadoPorId, p.tomadoPorId, ...delViaje.map((x) => x.solicitanteId),
    ...(await responsables(cliente, obras)),
    // Compras ve todas las solicitudes (coordina viajes para la obra).
    ...(await conRol(cliente, ["CHOFER", "DIRECCION", "CAPATAZ", "COMPRAS"])),
  ];
}

/** Pedido de material (y su OC y lo habilitado): Compras, Dirección, el que pidió y los responsables de la obra. */
async function destinosMaterial(cliente: Cliente, pedidoMaterialId: string) {
  const p = await cliente.pedidoMaterial.findUnique({ where: { id: pedidoMaterialId }, select: { solicitanteId: true, obraId: true } });
  if (!p) return [];
  return [p.solicitanteId, ...(await responsables(cliente, [p.obraId])), ...(await conRol(cliente, ["COMPRAS", "DIRECCION", "CAPATAZ"]))];
}

/** Herramienta: Depósito, Dirección, el capataz y los responsables de la obra donde está. */
async function destinosHerramienta(cliente: Cliente, herramientaId: string) {
  const h = await cliente.herramienta.findUnique({ where: { id: herramientaId }, select: { obraId: true } }).catch(() => null);
  return [...(h?.obraId ? await responsables(cliente, [h.obraId]) : []), ...(await conRol(cliente, ["DEPOSITO", "DIRECCION", "CAPATAZ"]))];
}

/**
 * Desde la auditoría: con la entidad y la acción auditadas, a quién avisar y de qué entidad.
 * "viaje.*" sobre un pedido es también un cambio del VIAJE; "oc.*" y aprobaciones, de la ORDEN_COMPRA;
 * habilitar / retirar, del MATERIAL_LISTO.
 */
export async function cambioDeAuditoria(cliente: Cliente, d: { entidad: string; entidadId: string; accion: string }) {
  try {
    if (d.entidad === "PedidoViaje") {
      const destinos = await destinosPedidoViaje(cliente, d.entidadId);
      await emitirCambio(destinos, "PEDIDO_VIAJE", d.entidadId, d.accion, cliente);
      if (d.accion.startsWith("viaje.")) await emitirCambio(destinos, "VIAJE", d.entidadId, d.accion, cliente);
    } else if (d.entidad === "PedidoMaterial") {
      const destinos = await destinosMaterial(cliente, d.entidadId);
      await emitirCambio(destinos, "PEDIDO_MATERIAL", d.entidadId, d.accion, cliente);
      if (/^oc\.|aprob|rechaz/i.test(d.accion)) await emitirCambio([...destinos, ...(await conRol(cliente, ["ADMINISTRACION"]))], "ORDEN_COMPRA", d.entidadId, d.accion, cliente);
      if (/habilit|retiro|listo/i.test(d.accion)) await emitirCambio(destinos, "MATERIAL_LISTO", d.entidadId, d.accion, cliente);
    } else if (d.entidad === "OrdenCompra") {
      // Tablero de Compras (órdenes sin pedido: creadas o importadas; celdas editadas en línea).
      await emitirCambio(await conRol(cliente, ["COMPRAS", "DIRECCION", "ADMINISTRACION"]), "ORDEN_COMPRA", d.entidadId, d.accion, cliente);
    } else if (d.entidad === "Herramienta" && d.entidadId !== "csv") {
      await emitirCambio(await destinosHerramienta(cliente, d.entidadId), "HERRAMIENTA", d.entidadId, d.accion, cliente);
    } else if (d.entidad === "Herramienta" || d.entidad === "MaterialSobrante") {
      await emitirCambio(await conRol(cliente, ["DEPOSITO", "DIRECCION", "CAPATAZ"]), "HERRAMIENTA", d.entidadId, d.accion, cliente);
    }
  } catch (e) {
    console.error("Tiempo real: no se pudo resolver el cambio", d, e);
  }
}

/** Alertas nuevas: a las personas nombradas y a los roles destino. */
export async function cambioDeAlertas(alertas: { claveUnica: string; personas: string[]; rolesDestino: Rol[] }[], cliente: Cliente = db) {
  for (const a of alertas) await emitirCambio([...a.personas, ...(await conRol(cliente, a.rolesDestino))], "ALERTA", a.claveUnica, "alerta.nueva", cliente);
}

// ─────────────────────────────── Lectura (stream) ───────────────────────────────

/**
 * Mirada hacia atrás: los ids se asignan al insertar pero las transacciones confirman en otro orden,
 * así que un evento con id menor puede aparecer después. Se vuelve a mirar una ventana corta y se
 * descartan los ya entregados. Un repetido solo cuesta un refresco de más; uno perdido, una pantalla vieja.
 */
export const VENTANA_ATRAS = 200;
export const VENTANA_ATRAS_MS = 60_000;

/** Último id del usuario (para empezar sin repetir la historia). */
export async function ultimoEvento(usuarioId: string) {
  const e = await db.eventoCambio.findFirst({ where: { usuarioId }, orderBy: { id: "desc" }, select: { id: true } });
  return e?.id ?? 0;
}

const enVentana = (usuarioId: string, desde: number) => ({
  usuarioId,
  id: { gt: Math.max(0, desde - VENTANA_ATRAS) },
  OR: [{ id: { gt: desde } }, { fecha: { gte: new Date(Date.now() - VENTANA_ATRAS_MS) } }],
});

/**
 * Al conectarse (o reconectarse con Last-Event-ID): lo que está en la ventana hasta "desde" ya se
 * entregó en la conexión anterior. Desde ahí, la ventana atrapa los que confirmaron tarde.
 */
export async function yaEntregados(usuarioId: string, desde: number): Promise<Set<number>> {
  if (!desde) return new Set();
  const filas = await db.eventoCambio.findMany({ where: { ...enVentana(usuarioId, desde), id: { gt: Math.max(0, desde - VENTANA_ATRAS), lte: desde } }, select: { id: true } });
  return new Set(filas.map((f) => f.id));
}

/** Los eventos del usuario que todavía no se le entregaron (los de después de "desde" y los que confirmaron tarde), en orden. */
export async function eventosDesde(usuarioId: string, desde: number, entregados: Set<number>): Promise<Evento[]> {
  const filas = await db.eventoCambio.findMany({ where: enVentana(usuarioId, desde), orderBy: { id: "asc" }, take: 500, select: { id: true, entidad: true, entidadId: true, accion: true } });
  return filas.filter((f) => !entregados.has(f.id));
}

/** Job diario: los eventos de más de 24 h ya no le sirven a nadie. */
export async function limpiarEventos(ahora = new Date()) {
  return (await db.eventoCambio.deleteMany({ where: { fecha: { lt: new Date(ahora.getTime() - 24 * 3600_000) } } })).count;
}
