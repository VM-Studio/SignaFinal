"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { autorizar } from "@/lib/auth/usuario-actual";
import { puede } from "@/lib/permisos";
import { auditar } from "@/lib/auditoria";
import { peso } from "@/lib/formato";
import { ejecutar, ErrorNegocio, type Resultado } from "./resultado";
import { despuesDeCambiar, licenciaVencida } from "./comun";

const opcional = <T extends z.ZodTypeAny>(s: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), s.optional());

const esquemaPedido = z.object({
  clientId: z.string().uuid(),
  obraId: z.string().min(1, "Elegí la obra."),
  proveedorId: opcional(z.string()),
  ordenCompraId: opcional(z.string()),
  origenTexto: opcional(z.string().trim().max(120)),
  tipoCarga: z.enum(["MATERIALES", "MAQUINARIA", "HERRAMIENTAS", "OTRO"], { error: "Elegí qué hay que llevar." }),
  descripcion: z.string().trim().min(3, "Contá qué hay que llevar.").max(300),
  pesoKg: opcional(z.coerce.number().int("El peso va en kg, sin decimales.").positive("El peso tiene que ser mayor a cero.").max(30000)),
  vehiculoRequerido: z.enum(["CUALQUIERA", "CAMION", "CAMIONETA", "AUTO"]).default("CUALQUIERA"),
  prioridad: z.enum(["NORMAL", "URGENTE"]).default("NORMAL"),
  necesarioPara: opcional(z.coerce.date()),
  observaciones: opcional(z.string().trim().max(500)),
});

export type DatosPedido = z.input<typeof esquemaPedido>;

export async function crearPedido(entrada: DatosPedido): Promise<Resultado<{ id: string; numero: number }>> {
  return ejecutar(async () => {
    const yo = await autorizar("pedidos.crear");
    const d = esquemaPedido.parse(entrada);

    // Idempotencia: si el celular reenvía un pedido guardado sin señal, no se duplica.
    const existente = await db.pedidoViaje.findUnique({ where: { clientId: d.clientId }, select: { id: true, numero: true } });
    if (existente) return existente;

    const obra = await db.obra.findFirst({
      where: { id: d.obraId, activa: true },
      select: { id: true, nombre: true, responsables: { select: { id: true } } },
    });
    if (!obra) throw new ErrorNegocio("Esa obra no está activa.");
    if (yo.rol === "RESPONSABLE_OBRA" && !obra.responsables.some((r) => r.id === yo.id)) {
      throw new ErrorNegocio(`No sos responsable de la obra ${obra.nombre}.`);
    }
    if (!d.proveedorId && !d.origenTexto) throw new ErrorNegocio("Indicá de dónde hay que buscarlo.");

    let ordenCompraId = d.ordenCompraId;
    if (ordenCompraId) {
      const oc = await db.ordenCompra.findUnique({ where: { id: ordenCompraId }, select: { obraId: true, proveedorId: true } });
      if (!oc || oc.obraId !== d.obraId) ordenCompraId = undefined;
    }

    // Peso: si supera la capacidad del camión más grande, no hay con qué llevarlo.
    let vehiculoRequerido = d.vehiculoRequerido;
    if (d.pesoKg) {
      const mayor = await db.vehiculo.aggregate({ where: { activo: true, disponibleParaPedidos: true }, _max: { capacidadKg: true } });
      const max = mayor._max.capacidadKg ?? 0;
      if (d.pesoKg > max) throw new ErrorNegocio(`Ningún vehículo carga ${peso(d.pesoKg)}. El más grande lleva ${peso(max)}. Partilo en dos pedidos.`);
      const camionetaMax = await db.vehiculo.aggregate({ where: { activo: true, disponibleParaPedidos: true, tipo: { not: "CAMION" } }, _max: { capacidadKg: true } });
      if (d.pesoKg > (camionetaMax._max.capacidadKg ?? 0)) vehiculoRequerido = "CAMION";
    }

    const pedido = await db.$transaction(async (tx) => {
      const p = await tx.pedidoViaje.create({
        data: {
          clientId: d.clientId,
          obraId: d.obraId,
          proveedorId: d.proveedorId ?? null,
          ordenCompraId: ordenCompraId ?? null,
          origenTexto: d.proveedorId ? null : d.origenTexto ?? null,
          tipoCarga: d.tipoCarga,
          descripcion: d.descripcion,
          pesoKg: d.pesoKg ?? null,
          vehiculoRequerido,
          prioridad: d.prioridad,
          necesarioPara: d.necesarioPara ?? null,
          observaciones: d.observaciones ?? null,
          solicitanteId: yo.id,
        },
        select: { id: true, numero: true },
      });
      await auditar(tx, { usuarioId: yo.id, accion: "pedido.crear", entidad: "PedidoViaje", entidadId: p.id });
      return p;
    });

    despuesDeCambiar();
    return pedido;
  });
}

export async function tomarPedido(pedidoId: string): Promise<Resultado<{ numero: number }>> {
  return ejecutar(async () => {
    const yo = await autorizar("pedidos.tomar");
    const chofer = await db.usuario.findUniqueOrThrow({ where: { id: yo.id }, select: { licenciaVence: true } });
    if (licenciaVencida(chofer.licenciaVence)) {
      throw new ErrorNegocio("Tu licencia de conducir está vencida o sin cargar. Avisá a la oficina para actualizarla.");
    }

    // Solo uno puede tomarlo: la condición estado = PENDIENTE hace de cerrojo.
    const tomado = await db.pedidoViaje.updateMany({
      where: { id: pedidoId, estado: "PENDIENTE" },
      data: { estado: "TOMADO", choferId: yo.id, tomadoEn: new Date() },
    });

    const pedido = await db.pedidoViaje.findUniqueOrThrow({
      where: { id: pedidoId },
      select: { numero: true, estado: true, choferId: true, chofer: { select: { nombre: true } } },
    });

    if (tomado.count === 0) {
      if (pedido.choferId === yo.id) throw new ErrorNegocio("Ya lo tenés tomado vos.");
      if (pedido.estado === "CANCELADO") throw new ErrorNegocio("Este pedido fue cancelado.");
      if (pedido.estado === "ENTREGADO") throw new ErrorNegocio("Este pedido ya fue entregado.");
      throw new ErrorNegocio(`Ya lo tomó ${pedido.chofer?.nombre ?? "otro chofer"}.`);
    }

    await auditar(db, { usuarioId: yo.id, accion: "pedido.tomar", entidad: "PedidoViaje", entidadId: pedidoId });
    despuesDeCambiar();
    return { numero: pedido.numero };
  });
}

/** Devolver un pedido tomado a la cola (también es el "deshacer" de tomar). */
export async function soltarPedido(pedidoId: string): Promise<Resultado<null>> {
  return ejecutar(async () => {
    const yo = await autorizar("pedidos.tomar");
    const r = await db.pedidoViaje.updateMany({
      where: { id: pedidoId, estado: "TOMADO", choferId: yo.id },
      data: { estado: "PENDIENTE", choferId: null, tomadoEn: null, vehiculoId: null },
    });
    if (r.count === 0) throw new ErrorNegocio("Ya no se puede devolver: el viaje empezó o el pedido cambió.");
    await auditar(db, { usuarioId: yo.id, accion: "pedido.soltar", entidad: "PedidoViaje", entidadId: pedidoId });
    despuesDeCambiar();
    return null;
  });
}

export async function cancelarPedido(pedidoId: string, motivo?: string): Promise<Resultado<null>> {
  return ejecutar(async () => {
    const yo = await autorizar("pedidos.ver");
    const pedido = await db.pedidoViaje.findUniqueOrThrow({ where: { id: pedidoId }, select: { solicitanteId: true, estado: true } });
    const esMio = pedido.solicitanteId === yo.id;
    if (!esMio && !puede(yo.rol, "pedidos.cancelarCualquiera")) throw new ErrorNegocio("Solo quien lo pidió puede cancelarlo.");
    if (pedido.estado === "EN_VIAJE") throw new ErrorNegocio("El chofer ya salió. Hablá con él directamente.");

    // El chofer queda guardado para poder deshacer la cancelación.
    const r = await db.pedidoViaje.updateMany({
      where: { id: pedidoId, estado: { in: ["PENDIENTE", "TOMADO"] } },
      data: { estado: "CANCELADO", canceladoEn: new Date(), canceladoPorId: yo.id, motivoCancelacion: motivo?.trim() || null },
    });
    if (r.count === 0) throw new ErrorNegocio("Este pedido ya no se puede cancelar.");
    await auditar(db, { usuarioId: yo.id, accion: "pedido.cancelar", entidad: "PedidoViaje", entidadId: pedidoId, detalle: { estadoPrevio: pedido.estado } });
    despuesDeCambiar();
    return null;
  });
}

/** Deshacer una cancelación (ventana de 10 segundos en la interfaz; el servidor da 2 minutos de margen). */
export async function deshacerCancelacion(pedidoId: string): Promise<Resultado<null>> {
  return ejecutar(async () => {
    const yo = await autorizar("pedidos.ver");
    const p = await db.pedidoViaje.findUniqueOrThrow({
      where: { id: pedidoId },
      select: { estado: true, canceladoPorId: true, canceladoEn: true, choferId: true },
    });
    const reciente = p.canceladoEn && Date.now() - p.canceladoEn.getTime() < 2 * 60 * 1000;
    if (p.estado !== "CANCELADO" || p.canceladoPorId !== yo.id || !reciente) throw new ErrorNegocio("Ya no se puede deshacer.");
    await db.pedidoViaje.update({
      where: { id: pedidoId },
      data: { estado: p.choferId ? "TOMADO" : "PENDIENTE", canceladoEn: null, canceladoPorId: null, motivoCancelacion: null },
    });
    await auditar(db, { usuarioId: yo.id, accion: "pedido.deshacerCancelacion", entidad: "PedidoViaje", entidadId: pedidoId });
    despuesDeCambiar();
    return null;
  });
}
