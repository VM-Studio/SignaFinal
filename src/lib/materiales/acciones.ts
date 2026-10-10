"use server";

import { engancharAdjuntos } from "@/lib/archivos";
import { z } from "zod";
import { Prisma, type EstadoMaterial } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso, exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { auditar as auditarBase } from "@/lib/auditoria";
import { revalidar } from "@/lib/revalidar";
import { reevaluar } from "@/lib/alertas/reevaluar";
import { esObraDelUsuario } from "@/lib/alcance";
import { notificarEvento } from "@/lib/notificaciones/enviar";
import { EVENTO } from "@/lib/notificaciones/eventos";
import { queLleva } from "@/lib/notificaciones/textos";
import { aFecha, diaISO, fecha, plata } from "@/lib/formato";
import { nombreSucursal, resolverPuntos, sucursalDe } from "@/lib/pedidos/puntos";
import { describirPedido, necesitaCamion } from "@/lib/pedidos/reglas";
import { avisarSolicitudNueva } from "@/lib/pedidos/avisos";
import { FRANJA } from "@/lib/pedidos/presentacion";
import { cambiarEstado, recalcular } from "./circuito";

type Tx = Prisma.TransactionClient;

const refrescar = () => {
  revalidar("materiales", "pedidos");
  reevaluar("materiales", "pedidos");
};
const vacio = (v: unknown) => (v === "" || v === null ? undefined : v);
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const auditar = (tx: Tx, d: { usuarioId: string; accion: string; entidadId: string; resumen: string; antes?: Prisma.InputJsonValue; despues?: Prisma.InputJsonValue }) =>
  auditarBase(tx, { entidad: "PedidoMaterial", ...d });

/** Lo común de los avisos de un pedido de material. */
const deMaterial = (p: { id: string; solicitanteId: string; obraId: string; descripcion: string; obra: { nombre: string } }) => ({
  pedidoMaterialId: p.id, solicitanteId: p.solicitanteId, obraId: p.obraId, que: p.descripcion, obra: p.obra.nombre,
});

/** "#12 (cemento portland) para Obra Darwin" */
const describir = (p: { numero: number; descripcion: string; obra: { nombre: string } }) => `el pedido de material #${p.numero} (${queLleva(p.descripcion)}) para Obra ${p.obra.nombre}`;

async function pedidoOError(tx: Tx, id: string) {
  const p = await tx.pedidoMaterial.findUnique({ where: { id }, include: { obra: { select: { nombre: true } }, tomadoPor: { select: { nombre: true } } } });
  if (!p) throw new ErrorNegocio("No existe ese pedido de material.");
  return p;
}

function exigirEstado(p: { estado: EstadoMaterial; tomadoPor?: { nombre: string } | null }, ...estados: EstadoMaterial[]) {
  if (estados.includes(p.estado)) return;
  const ahora: Partial<Record<EstadoMaterial, string>> = {
    EN_COMPRA: `Ya lo está comprando ${p.tomadoPor?.nombre ?? "Compras"}.`,
    ESPERANDO_APROBACION: "Ya está esperando la aprobación del dueño.",
    APROBADO: "Ya está aprobado.",
    CANCELADO: "Este pedido fue cancelado.",
    ENTREGADO: "Este pedido ya se entregó.",
  };
  throw new ErrorNegocio(ahora[p.estado] ?? "El pedido cambió. Actualizá la pantalla.");
}

// ═══════════════════════════ Pedir materiales (obra) ═══════════════════════════

const renglonEsquema = z.object({
  descripcion: z.string().trim().max(200),
  cantidad: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().positive("La cantidad tiene que ser más de cero.").max(1_000_000).optional()),
  unidad: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().trim().max(20).optional()),
});

const esquemaPedir = z
  .object({
    obraId: z.string().min(1, "Elegí la obra."),
    obraSedeId: z.preprocess(vacio, z.string().optional()),
    // Renglones (descripción, cantidad, unidad) y/o archivos adjuntos: con uno de los dos alcanza.
    renglones: z.array(renglonEsquema).max(50).transform((r) => r.filter((x) => x.descripcion.length > 0)),
    adjuntos: z.array(z.string()).max(20).default([]),
    dia: z.string().regex(DIA, "Elegí para cuándo."),
    prioridad: z.enum(["NORMAL", "URGENTE"]),
    observaciones: z.preprocess(vacio, z.string().trim().max(2000).optional()),
    // Solo Compras: a nombre de quién (pedido que le hicieron por teléfono).
    solicitanteId: z.preprocess(vacio, z.string().optional()),
  })
  .superRefine((d, ctx) => {
    if (!d.renglones.length && !d.adjuntos.length) ctx.addIssue({ code: "custom", message: "Escribí qué necesitás o adjuntá la lista de materiales." });
  });
export type DatosPedirMateriales = z.input<typeof esquemaPedir>;

/** "40 bolsas cemento" a partir de un renglón. */
const textoRenglon = (r: { descripcion: string; cantidad?: number; unidad?: string }) =>
  r.cantidad ? `${r.cantidad.toLocaleString("es-AR")}${r.unidad ? ` ${r.unidad}` : ""} ${r.descripcion}` : r.descripcion;

export async function pedirMateriales(entrada: DatosPedirMateriales): Promise<Resultado<{ id: string; numero: number }>> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    const comoCompras = puede(yo.rol, "materiales.gestionar") && !!entrada.solicitanteId;
    if (!puede(yo.rol, "materiales.pedir") && !comoCompras) throw new ErrorNegocio("No tenés permiso para pedir materiales.");
    const d = esquemaPedir.parse(entrada);
    if (d.dia < diaISO()) throw new ErrorNegocio("El día ya pasó. Elegí hoy o una fecha futura.");

    const obra = await db.obra.findUnique({ where: { id: d.obraId }, select: { id: true, nombre: true, estado: true, sedes: { where: { activa: true }, select: { id: true, nombre: true } } } });
    if (!obra || obra.estado !== "ACTIVA") throw new ErrorNegocio("Esa obra no está activa.");
    if (!comoCompras && !(await esObraDelUsuario(yo, obra.id))) throw new ErrorNegocio(`No sos responsable de Obra ${obra.nombre}.`);
    const sede = d.obraSedeId ? obra.sedes.find((x) => x.id === d.obraSedeId) : null;
    if (d.obraSedeId && !sede) throw new ErrorNegocio("Esa sede no es de la obra.");
    if (obra.sedes.length > 1 && !sede) throw new ErrorNegocio(`Obra ${obra.nombre} tiene varias sedes: elegí para cuál es.`);
    const solicitante = comoCompras ? await db.usuario.findFirst({ where: { id: d.solicitanteId, activo: true }, select: { id: true, nombre: true } }) : { id: yo.id, nombre: yo.nombre };
    if (!solicitante) throw new ErrorNegocio("Elegí quién lo pidió.");

    // Los archivos tienen que ser de esta persona, recién subidos y sin enganchar.
    const encontrados = d.adjuntos.length ? await db.adjunto.findMany({ where: { id: { in: d.adjuntos }, subidoPorId: yo.id, entidadTipo: "PEDIDO_MATERIAL", entidadId: null }, select: { id: true, nombre: true, tipoMime: true } }) : [];
    // En el orden en que se adjuntaron, con las planillas y los PDF antes que las fotos (la descripción nombra el primero).
    const adjuntos = [...encontrados].sort((a, b) => Number(a.tipoMime.startsWith("image/")) - Number(b.tipoMime.startsWith("image/")) || d.adjuntos.indexOf(a.id) - d.adjuntos.indexOf(b.id));
    if (adjuntos.length !== d.adjuntos.length) throw new ErrorNegocio("Algún archivo no se terminó de subir. Quitalo y adjuntalo de nuevo.");
    if (!d.renglones.length && !adjuntos.length) throw new ErrorNegocio("Escribí qué necesitás o adjuntá la lista de materiales.");

    const lineas = d.renglones.map(textoRenglon);
    const descripcion = lineas.length
      ? lineas.join("\n")
      : `Ver lista adjunta (${adjuntos[0].nombre}${adjuntos.length > 1 ? ` y ${adjuntos.length - 1} más` : ""})`;
    const observaciones = [comoCompras ? `Lo cargó ${yo.nombre} (Compras) por pedido de ${solicitante.nombre}.` : null, d.observaciones].filter(Boolean).join(" ") || null;
    const p = await db.$transaction(async (tx) => {
      const p = await tx.pedidoMaterial.create({
        data: {
          obraId: obra.id, obraSedeId: sede?.id ?? null, solicitanteId: solicitante.id, descripcion, paraCuando: aFecha(d.dia, "12:00"), prioridad: d.prioridad, observaciones,
          renglones: d.renglones.length ? d.renglones.map((r) => ({ descripcion: r.descripcion, cantidad: r.cantidad ?? null, unidad: r.unidad ?? null })) : undefined,
        },
        select: { id: true, numero: true },
      });
      await engancharAdjuntos(tx, adjuntos.map((a) => a.id), "PEDIDO_MATERIAL", p.id, yo.id);
      await tx.cambioEstadoMaterial.create({ data: { pedidoMaterialId: p.id, de: null, a: "SOLICITADO", usuarioId: yo.id, nota: comoCompras ? `Cargado por Compras a pedido de ${solicitante.nombre}` : null } });
      await auditar(tx, {
        usuarioId: yo.id, accion: "material.pedir", entidadId: p.id,
        resumen: `${yo.nombre} pidió a Compras ${queLleva(descripcion)}${lineas.length > 1 ? ` y ${lineas.length - 1} más` : ""} para Obra ${obra.nombre}${sede ? ` (${sede.nombre})` : ""}${adjuntos.length ? ` con ${adjuntos.length} ${adjuntos.length === 1 ? "archivo adjunto" : "archivos adjuntos"}` : ""}${d.prioridad === "URGENTE" ? " (urgente)" : ""}${comoCompras ? ` a nombre de ${solicitante.nombre}` : ""}`,
        despues: { estado: "SOLICITADO", renglones: d.renglones, adjuntos: adjuntos.map((a) => a.nombre), dia: d.dia, prioridad: d.prioridad, observaciones: d.observaciones ?? null },
      });
      // A Compras (push) y al dueño (bandeja). Si lo cargó Compras, no se avisa a sí mismo.
      await notificarEvento(EVENTO.materialNuevo({
        pedidoMaterialId: p.id, solicitanteId: solicitante.id, obraId: obra.id, obra: obra.nombre, quien: solicitante.nombre, para: aFecha(d.dia, "12:00"), urgente: d.prioridad === "URGENTE",
        que: lineas.length ? descripcion : `materiales (lista adjunta: ${adjuntos[0].nombre})`,
        observaciones: d.observaciones ?? null, adjuntos: adjuntos.length,
      }), { tx, actor: yo.id });
      return p;
    });
    refrescar();
    return p;
  });
}

// ═══════════════════════════ Compras: notas internas y adjuntos ═══════════════════════════

/** Notas internas de Compras sobre el pedido (el solicitante no las ve). */
export async function guardarNotasCompras(id: string, notas: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    const t = notas.trim().slice(0, 2000);
    const p = await db.pedidoMaterial.findUnique({ where: { id }, select: { numero: true } });
    if (!p) throw new ErrorNegocio("No existe ese pedido.");
    await db.pedidoMaterial.update({ where: { id }, data: { notasCompras: t || null } });
    await auditar(db, { usuarioId: yo.id, accion: "material.notasCompras", entidadId: id, resumen: `${yo.nombre} actualizó las notas internas del pedido de material ${p.numero}` });
    revalidar("materiales");
    return null;
  });
}

/** Compras suma archivos al pedido (presupuestos del proveedor, etc.). Internos: el solicitante no los ve. */
export async function adjuntarAPedido(id: string, adjuntoIds: string[]): Promise<Resultado<{ cantidad: number }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    const p = await db.pedidoMaterial.findUnique({ where: { id }, select: { numero: true } });
    if (!p) throw new ErrorNegocio("No existe ese pedido.");
    const n = await db.$transaction(async (tx) => {
      const n = await engancharAdjuntos(tx, adjuntoIds, "PEDIDO_MATERIAL", id, yo.id);
      if (n) await auditar(tx, { usuarioId: yo.id, accion: "material.adjuntar", entidadId: id, resumen: `${yo.nombre} adjuntó ${n} ${n === 1 ? "archivo" : "archivos"} al pedido de material ${p.numero}` });
      return n;
    });
    revalidar("materiales");
    return { cantidad: n };
  });
}

/** "Deshacer" justo después de pedir (10 s en pantalla, 2 min de margen): queda cancelado. */
export async function deshacerPedidoMaterial(id: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    await db.$transaction(async (tx) => {
      const p = await pedidoOError(tx, id);
      if (p.estado !== "SOLICITADO" || Date.now() - p.creadoEn.getTime() > 120_000) throw new ErrorNegocio("Ya no se puede deshacer.");
      const cargo = await tx.cambioEstadoMaterial.findFirst({ where: { pedidoMaterialId: id, a: "SOLICITADO" }, select: { usuarioId: true } });
      if (cargo?.usuarioId !== yo.id) throw new ErrorNegocio("Ya no se puede deshacer.");
      await cambiarEstado(tx, p, "CANCELADO", yo.id, "Se deshizo al pedirlo", { motivoCancelacion: "Se deshizo al pedirlo" });
      await auditar(tx, { usuarioId: yo.id, accion: "material.deshacer", entidadId: id, resumen: `${yo.nombre} deshizo ${describir(p)}`, antes: { estado: "SOLICITADO" }, despues: { estado: "CANCELADO" } });
    });
    refrescar();
    return null;
  });
}

// ═══════════════════════════ Cancelar ═══════════════════════════

/** Quien pidió: solo mientras está SOLICITADO. Compras y el dueño: siempre que no haya un viaje en marcha. */
export async function cancelarMaterial(id: string, motivo: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    const m = motivo.trim();
    if (m.length < 3) throw new ErrorNegocio("Contá por qué se cancela.");
    await db.$transaction(async (tx) => {
      const p = await pedidoOError(tx, id);
      const gestiona = puede(yo.rol, "materiales.gestionar");
      if (!gestiona) {
        if (p.solicitanteId !== yo.id) throw new ErrorNegocio("Solo quien lo pidió puede cancelarlo.");
        if (p.estado !== "SOLICITADO") throw new ErrorNegocio(`Compras ya lo está comprando. Hablá con ${p.tomadoPor?.nombre ?? "Compras"} para cancelarlo.`);
      }
      if (p.estado === "CANCELADO" || p.estado === "ENTREGADO") throw new ErrorNegocio(p.estado === "CANCELADO" ? "Ya estaba cancelado." : "Ya se entregó.");
      const enViaje = await tx.materialListo.count({ where: { pedidoMaterialId: id, estado: { in: ["RETIRO_PEDIDO", "EN_CAMINO"] } } });
      if (enViaje) throw new ErrorNegocio("Hay un viaje pedido para retirarlo. Cancelá primero ese viaje.");
      const ok = await cambiarEstado(tx, p, "CANCELADO", yo.id, m, { motivoCancelacion: m });
      if (!ok) throw new ErrorNegocio("El pedido cambió mientras lo cancelabas.");
      await tx.materialListo.updateMany({ where: { pedidoMaterialId: id, estado: "LISTO" }, data: { estado: "CANCELADO" } });
      // Que se entere el otro lado.
      await notificarEvento(EVENTO.materialCancelado({ ...deMaterial(p), quien: yo.nombre, motivo: m, porCompras: gestiona, compradorId: p.tomadoPorId }), { tx, actor: yo.id });
      await auditar(tx, { usuarioId: yo.id, accion: "material.cancelar", entidadId: id, resumen: `${yo.nombre} canceló ${describir(p)}: ${m}`, antes: { estado: p.estado }, despues: { estado: "CANCELADO", motivo: m } });
    });
    refrescar();
    return null;
  });
}

// ═══════════════════════════ Compras ═══════════════════════════

/** SOLICITADO → EN_COMPRA: "lo tomo yo". */
export async function tomarMaterial(id: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    await db.$transaction(async (tx) => {
      const p = await pedidoOError(tx, id);
      exigirEstado(p, "SOLICITADO");
      const ok = await cambiarEstado(tx, p, "EN_COMPRA", yo.id, undefined, { tomadoPorId: yo.id, tomadoEn: new Date() });
      if (!ok) exigirEstado(await pedidoOError(tx, id), "SOLICITADO");
      await notificarEvento(EVENTO.materialTomado({ ...deMaterial(p), comprador: yo.nombre }), { tx, actor: yo.id });
      await auditar(tx, { usuarioId: yo.id, accion: "material.tomar", entidadId: id, resumen: `${yo.nombre} tomó ${describir(p)} y lo está comprando`, antes: { estado: "SOLICITADO" }, despues: { estado: "EN_COMPRA" } });
    });
    refrescar();
    return null;
  });
}

const esquemaAprobacion = z.object({
  id: z.string().min(1),
  ordenCompra: z.string().trim().min(1, "Poné el número de OC.").max(40),
  monto: z.preprocess((v) => (typeof v === "string" ? v.replace(/[^\d,]/g, "").replace(",", ".") : v), z.preprocess(vacio, z.coerce.number().positive("Revisá el monto.").max(1e12).optional())),
});
export type DatosAprobacion = z.input<typeof esquemaAprobacion>;

/** EN_COMPRA → ESPERANDO_APROBACION: la OC está armada en Lebane; le llega al dueño. */
export async function pedirAprobacion(entrada: DatosAprobacion): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    const d = esquemaAprobacion.parse(entrada);
    await db.$transaction(async (tx) => {
      const p = await pedidoOError(tx, d.id);
      exigirEstado(p, "EN_COMPRA");
      const monto = d.monto != null ? new Prisma.Decimal(d.monto) : null;
      const nota = `OC ${d.ordenCompra.replace(/^\s*(OC)?\s*#?\s*/i, "")}${monto ? ` · ${plata(monto.toNumber())}` : ""}`;
      const ok = await cambiarEstado(tx, p, "ESPERANDO_APROBACION", yo.id, nota, { ordenCompraNumero: d.ordenCompra, montoAprobado: monto, ...(p.tomadoPorId ? {} : { tomadoPorId: yo.id, tomadoEn: new Date() }) });
      if (!ok) throw new ErrorNegocio("El pedido cambió. Actualizá la pantalla.");
      await notificarEvento(EVENTO.materialParaAprobar({ ...deMaterial(p), oc: d.ordenCompra, monto: monto ? plata(monto.toNumber()) : null }), { tx, actor: yo.id });
      await notificarEvento(EVENTO.materialOcArmada(deMaterial(p)), { tx, actor: yo.id });
      await auditar(tx, { usuarioId: yo.id, accion: "material.pedirAprobacion", entidadId: p.id, resumen: `${yo.nombre} armó la ${nota} de ${describir(p)} y pidió la aprobación del dueño`, antes: { estado: "EN_COMPRA" }, despues: { estado: "ESPERANDO_APROBACION", ordenCompra: d.ordenCompra, monto: monto?.toString() ?? null } });
    });
    refrescar();
    return null;
  });
}

/**
 * ESPERANDO_APROBACION → APROBADO. El dueño desde /aprobaciones; Compras solo con "El dueño ya aprobó
 * en papel" (queda en la auditoría que lo marcó Compras).
 */
export async function aprobarMaterial(id: string, enPapel = false): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    if (enPapel ? !puede(yo.rol, "materiales.gestionar") : !puede(yo.rol, "materiales.aprobar")) throw new ErrorNegocio("Solo el dueño aprueba las órdenes de compra.");
    await db.$transaction(async (tx) => {
      const p = await pedidoOError(tx, id);
      exigirEstado(p, "ESPERANDO_APROBACION");
      const nota = enPapel ? `El dueño aprobó en papel (lo marcó ${yo.nombre})` : undefined;
      const ok = await cambiarEstado(tx, p, "APROBADO", yo.id, nota, { aprobadoPorId: yo.id, aprobadoEn: new Date() });
      if (!ok) throw new ErrorNegocio("El pedido cambió. Actualizá la pantalla.");
      await notificarEvento(EVENTO.materialAprobado({ ...deMaterial(p), oc: p.ordenCompraNumero, enPapel, compradorId: p.tomadoPorId }), { tx, actor: yo.id });
      await auditar(tx, {
        usuarioId: yo.id, accion: enPapel ? "material.aprobadoEnPapel" : "material.aprobar", entidadId: id,
        resumen: enPapel ? `${yo.nombre} marcó que el dueño aprobó en papel ${describir(p)}` : `${yo.nombre} aprobó la OC de ${describir(p)}`,
        antes: { estado: "ESPERANDO_APROBACION" }, despues: { estado: "APROBADO", enPapel },
      });
    });
    refrescar();
    return null;
  });
}

/** Deshacer la aprobación (10 s en pantalla, 2 min de margen) mientras no se habilitó nada. */
export async function deshacerAprobacion(id: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    await db.$transaction(async (tx) => {
      const p = await pedidoOError(tx, id);
      if (p.estado !== "APROBADO" || p.aprobadoPorId !== yo.id || !p.aprobadoEn || Date.now() - p.aprobadoEn.getTime() > 120_000) throw new ErrorNegocio("Ya no se puede deshacer.");
      if (await tx.materialListo.count({ where: { pedidoMaterialId: id } })) throw new ErrorNegocio("Compras ya lo habilitó para retirar.");
      await cambiarEstado(tx, p, "ESPERANDO_APROBACION", yo.id, "Se deshizo la aprobación", { aprobadoPorId: null, aprobadoEn: null });
      await auditar(tx, { usuarioId: yo.id, accion: "material.deshacerAprobacion", entidadId: id, resumen: `${yo.nombre} deshizo la aprobación de ${describir(p)}`, antes: { estado: "APROBADO" }, despues: { estado: "ESPERANDO_APROBACION" } });
    });
    refrescar();
    return null;
  });
}

/** El dueño rechaza: vuelve a EN_COMPRA con el motivo. */
export async function rechazarMaterial(id: string, motivo: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.aprobar");
    const m = motivo.trim();
    if (m.length < 3) throw new ErrorNegocio("Contá por qué se rechaza.");
    await db.$transaction(async (tx) => {
      const p = await pedidoOError(tx, id);
      exigirEstado(p, "ESPERANDO_APROBACION");
      const ok = await cambiarEstado(tx, p, "EN_COMPRA", yo.id, `Rechazado: ${m}`);
      if (!ok) throw new ErrorNegocio("El pedido cambió. Actualizá la pantalla.");
      await notificarEvento(EVENTO.materialRechazado({ ...deMaterial(p), oc: p.ordenCompraNumero, motivo: m, compradorId: p.tomadoPorId }), { tx, actor: yo.id });
      await auditar(tx, { usuarioId: yo.id, accion: "material.rechazar", entidadId: id, resumen: `${yo.nombre} rechazó la OC de ${describir(p)}: ${m}`, antes: { estado: "ESPERANDO_APROBACION" }, despues: { estado: "EN_COMPRA", motivo: m } });
    });
    refrescar();
    return null;
  });
}

const esquemaHabilitar = z
  .object({
    id: z.string().min(1),
    proveedorId: z.string().min(1, "Elegí el proveedor."),
    // La sucursal donde se retira (si no viene, la principal del proveedor).
    sucursalId: z.preprocess(vacio, z.string().optional()),
    // Renglones de la OC que entran en este retiro (lista de verificación del chofer).
    renglones: z.array(z.object({ descripcion: z.string().trim().min(1).max(200), cantidad: z.coerce.number().positive().nullable().optional(), unidad: z.string().trim().max(20).nullable().optional() })).max(200).optional(),
    horario: z.preprocess(vacio, z.string().trim().max(120).optional()),
    contacto: z.preprocess(vacio, z.string().trim().max(120).optional()),
    ordenCompra: z.preprocess(vacio, z.string().trim().max(40).optional()),
    descripcion: z.string().trim().min(3, "Contá qué se retira.").max(300),
    pesoKg: z.coerce.number({ error: "Elegí el peso aproximado." }).int().positive("Elegí el peso aproximado.").max(30_000),
    modo: z.enum(["RETIRA_CHOFER", "ENTREGA_PROVEEDOR"]),
    fechaEstimada: z.preprocess(vacio, z.string().regex(DIA).optional()),
    completo: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.modo === "ENTREGA_PROVEEDOR" && !d.fechaEstimada) ctx.addIssue({ code: "custom", message: "Poné cuándo lo entrega el proveedor." });
  });
export type DatosHabilitar = z.input<typeof esquemaHabilitar>;

/** "Habilitar para retirar": crea el MaterialListo y le avisa a la obra. Se puede habilitar en partes. */
export async function habilitarRetiro(entrada: DatosHabilitar): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    const d = esquemaHabilitar.parse(entrada);
    await db.$transaction(async (tx) => {
      const p = await pedidoOError(tx, d.id);
      if (!["APROBADO", "LISTO_PARA_RETIRAR", "RETIRO_PEDIDO", "EN_CAMINO"].includes(p.estado)) {
        throw new ErrorNegocio(p.estado === "ESPERANDO_APROBACION" ? "Falta la aprobación del dueño." : "Este pedido no está para habilitar.");
      }
      if (p.completo) throw new ErrorNegocio("Ya se habilitó todo este pedido.");
      const suc = await sucursalDe(tx, d.sucursalId ?? d.proveedorId);
      if (!suc || suc.proveedorId !== d.proveedorId) throw new ErrorNegocio("Elegí la sucursal del proveedor donde se retira.");
      if (!Number.isFinite(suc.latitud) || !Number.isFinite(suc.longitud)) throw new ErrorNegocio("Esa sucursal no tiene ubicación en el mapa. Cargala de nuevo con la dirección.");
      const prov = { id: suc.proveedorId, nombre: nombreSucursal(suc) };
      const max = (await tx.vehiculo.aggregate({ where: { activo: true }, _max: { capacidadCargaKg: true } }))._max.capacidadCargaKg ?? 0;
      if (d.modo === "RETIRA_CHOFER" && d.pesoKg > max) throw new ErrorNegocio(`Ningún vehículo carga más de ${max.toLocaleString("es-AR")} kg. Habilitalo en dos partes.`);

      const ml = await tx.materialListo.create({
        data: {
          pedidoMaterialId: p.id, obraId: p.obraId, proveedorId: prov.id, sucursalId: suc.id, proveedorDireccion: `${suc.direccion}, ${suc.localidad}`, proveedorLat: suc.latitud, proveedorLng: suc.longitud,
          horarioRetiro: d.horario ?? suc.horarioRetiro ?? null, contactoRetiro: d.contacto ?? suc.contacto ?? null, renglones: d.renglones?.length ? d.renglones : undefined, ordenCompraNumero: d.ordenCompra ?? p.ordenCompraNumero, descripcion: d.descripcion,
          pesoKg: d.pesoKg, necesitaCamion: necesitaCamion("RETIRO_PROVEEDOR", d.pesoKg), modoEntrega: d.modo,
          fechaEntregaEstimada: d.fechaEstimada ? aFecha(d.fechaEstimada, "12:00") : null,
          // Lo entrega el proveedor: ya viene en camino, no hace falta viaje.
          estado: d.modo === "ENTREGA_PROVEEDOR" ? "EN_CAMINO" : "LISTO", habilitadoPorId: yo.id,
        },
      });
      if (d.completo) await tx.pedidoMaterial.update({ where: { id: p.id }, data: { completo: true } });
      await recalcular(tx, p.id, yo.id, `${d.descripcion} · ${prov.nombre}${d.completo ? " · No falta nada" : ""}`);

      // Al que pidió y a los demás responsables de la obra (push); a Compras, bandeja.
      await notificarEvento(EVENTO.materialHabilitado({
        ...deMaterial(p), que: d.descripcion, proveedor: prov.nombre, horario: d.horario ?? null,
        entregaProveedor: d.modo === "ENTREGA_PROVEEDOR", cuando: d.fechaEstimada ? `el ${fecha(aFecha(d.fechaEstimada, "12:00"))}` : null,
      }), { tx, actor: yo.id });
      await auditar(tx, {
        usuarioId: yo.id, accion: "material.habilitar", entidadId: p.id,
        resumen: `${yo.nombre} habilitó ${queLleva(d.descripcion)} en ${prov.nombre} para Obra ${p.obra.nombre}${d.modo === "ENTREGA_PROVEEDOR" ? " (lo entrega el proveedor)" : ""}${d.completo ? "; no falta nada" : ""}`,
        despues: { materialListoId: ml.id, proveedor: prov.nombre, modo: d.modo, pesoKg: d.pesoKg, completo: d.completo },
      });
    });
    refrescar();
    return null;
  });
}

/** Lo que entrega el proveedor: la obra (o Compras) marca que llegó. */
export async function marcarRecibido(materialListoId: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    await db.$transaction(async (tx) => {
      const ml = await tx.materialListo.findUnique({ where: { id: materialListoId }, include: { proveedor: { select: { nombre: true } }, pedidoMaterial: { include: { obra: { select: { nombre: true } } } } } });
      if (!ml || ml.modoEntrega !== "ENTREGA_PROVEEDOR") throw new ErrorNegocio("No existe esa entrega.");
      const gestiona = puede(yo.rol, "materiales.gestionar");
      if (!gestiona && !(puede(yo.rol, "materiales.pedir") && (await esObraDelUsuario(yo, ml.obraId)))) throw new ErrorNegocio("No es de tus obras.");
      const r = await tx.materialListo.updateMany({ where: { id: ml.id, estado: "EN_CAMINO" }, data: { estado: "ENTREGADO", entregadoEn: new Date() } });
      if (!r.count) throw new ErrorNegocio("Ya estaba marcado.");
      const cambio = await recalcular(tx, ml.pedidoMaterialId, yo.id, `Recibido en obra: ${ml.descripcion}`);
      await notificarEvento(EVENTO.materialEntregado({ ...deMaterial(ml.pedidoMaterial), que: ml.descripcion, completo: cambio?.a === "ENTREGADO" }), { tx, actor: yo.id });
      await auditar(tx, { usuarioId: yo.id, accion: "material.recibido", entidadId: ml.pedidoMaterialId, resumen: `${yo.nombre} recibió en Obra ${ml.pedidoMaterial.obra.nombre} ${queLleva(ml.descripcion)} que entregó ${ml.proveedor.nombre}` });
    });
    refrescar();
    return null;
  });
}

// ═══════════════════════════ Pedir el viaje de retiro (obra) ═══════════════════════════

const esquemaRetiro = z.object({
  obraId: z.string().min(1, "Elegí la obra."),
  materiales: z.array(z.string().min(1)).min(1, "Marcá qué hay que retirar.").max(30),
  dia: z.string().regex(DIA, "Elegí el día."),
  franja: z.enum(["MANANA", "TARDE", "HORA_EXACTA"]),
  hora: z.preprocess(vacio, z.string().regex(HHMM, "Revisá la hora.").optional()),
  prioridad: z.enum(["NORMAL", "URGENTE"]),
});
export type DatosRetiro = z.input<typeof esquemaRetiro>;

/** Lo que lee el chofer: qué, horario, contacto y OC. */
function descripcionRetiro(ml: { descripcion: string; horarioRetiro: string | null; contactoRetiro: string | null; ordenCompraNumero: string | null }[]) {
  const que = ml.map((m) => m.descripcion).join(" + ");
  const horario = [...new Set(ml.map((m) => m.horarioRetiro).filter(Boolean))].join(" / ");
  const contacto = [...new Set(ml.map((m) => m.contactoRetiro).filter(Boolean))].join(" / ");
  const ocs = [...new Set(ml.map((m) => m.ordenCompraNumero).filter(Boolean))].join(", ");
  return [que, horario && `Retiro: ${horario}`, contacto && `Contacto: ${contacto}`, ocs && `OC ${ocs.replace(/OC\s*#?\s*/gi, "")}`].filter(Boolean).join(" · ");
}

/**
 * Crea UN pedido de viaje RETIRO_PROVEEDOR por proveedor con lo habilitado por Compras:
 * origen copiado del MaterialListo, destino la obra, peso sumado. El material pasa a "retiro pedido".
 */
export async function pedirRetiro(entrada: DatosRetiro): Promise<Resultado<{ pedidos: { id: string; numero: number; proveedor: string }[] }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("pedidos.crear");
    const d = esquemaRetiro.parse(entrada);
    if (d.franja === "HORA_EXACTA" && !d.hora) throw new ErrorNegocio("Poné la hora.");
    if (d.dia < diaISO()) throw new ErrorNegocio("El día ya pasó. Elegí hoy o una fecha futura.");
    const obra = await db.obra.findUnique({ where: { id: d.obraId }, select: { id: true, nombre: true, estado: true } });
    if (!obra || obra.estado !== "ACTIVA") throw new ErrorNegocio("Esa obra no está activa.");
    if (!(await esObraDelUsuario(yo, obra.id))) throw new ErrorNegocio(`No sos responsable de Obra ${obra.nombre}.`);
    const paraCuando = aFecha(d.dia, d.franja === "HORA_EXACTA" ? d.hora! : FRANJA[d.franja].hora);
    const max = (await db.vehiculo.aggregate({ where: { activo: true }, _max: { capacidadCargaKg: true } }))._max.capacidadCargaKg ?? 0;

    const creados = await db.$transaction(async (tx) => {
      const ml = await tx.materialListo.findMany({ where: { id: { in: d.materiales } }, include: { pedidoMaterial: { select: { obraSedeId: true } }, proveedor: { select: { nombre: true } }, pedidoViaje: { select: { id: true, estado: true } } } });
      // Regla: solo material habilitado, LISTO, de esta obra y para retirar con chofer.
      if (ml.length !== new Set(d.materiales).size) throw new ErrorNegocio("Algún material ya no está. Actualizá la pantalla.");
      for (const m of ml) {
        if (m.obraId !== obra.id) throw new ErrorNegocio("Hay materiales de otra obra. Un viaje lleva a una sola obra.");
        if (m.modoEntrega !== "RETIRA_CHOFER") throw new ErrorNegocio(`${m.descripcion}: lo entrega el proveedor, no hace falta viaje.`);
        if (m.estado !== "LISTO") throw new ErrorNegocio(`${m.descripcion} ya tiene el retiro pedido.`);
      }
      // Varios lugares de retiro (proveedor y sucursal) = varios pedidos de viaje.
      const porProveedor = new Map<string, typeof ml>();
      for (const m of ml) porProveedor.set(m.sucursalId, [...(porProveedor.get(m.sucursalId) ?? []), m]);

      const out: { id: string; numero: number; proveedor: string }[] = [];
      for (const [sucursalId, grupo] of porProveedor) {
        const peso = grupo.reduce((s, m) => s + (m.pesoKg ?? 0), 0);
        if (peso > max) throw new ErrorNegocio(`Lo de ${grupo[0].proveedor.nombre} pesa ${peso.toLocaleString("es-AR")} kg y ningún vehículo carga más de ${max.toLocaleString("es-AR")} kg. Marcalo en dos viajes.`);
        // Si el material era para una sede de la obra, el viaje va a esa sede.
        const sede = grupo.map((m) => m.pedidoMaterial.obraSedeId).find(Boolean) ?? null;
        const puntos = await resolverPuntos(tx, { origenTipo: "PROVEEDOR", origenId: sucursalId, obraId: obra.id, destinoSedeId: sede });
        const primero = grupo[0];
        const proveedorId = primero.proveedorId;
        const p = await tx.pedidoViaje.create({
          data: {
            solicitanteId: yo.id, obraId: obra.id, tipo: "RETIRO_PROVEEDOR", origenTipo: "PROVEEDOR", esRetiroMaterial: true,
            ...puntos,
            origenId: sucursalId, sucursalId, proveedorId, destinoSedeId: sede,
            // Copiados de la habilitación (lo que Compras acordó con el proveedor).
            origenNombre: puntos.origenNombre, origenDireccion: primero.proveedorDireccion, origenLat: primero.proveedorLat, origenLng: primero.proveedorLng,
            descripcion: descripcionRetiro(grupo), ordenCompraLebane: [...new Set(grupo.map((m) => m.ordenCompraNumero).filter(Boolean))].join(", ").slice(0, 120) || null,
            pesoKg: peso || null, necesitaCamion: grupo.some((m) => m.necesitaCamion) || necesitaCamion("RETIRO_PROVEEDOR", peso),
            paraCuando, fechaNecesaria: aFecha(d.dia, "12:00"), franja: d.franja, prioridad: d.prioridad,
          },
          select: { id: true, numero: true },
        });
        await tx.materialListo.updateMany({ where: { id: { in: grupo.map((m) => m.id) }, estado: "LISTO" }, data: { estado: "RETIRO_PEDIDO", pedidoViajeId: p.id } });
        // Si había un viaje anterior que alguien soltó y quedó sin material, se cancela solo.
        for (const viejo of new Set(grupo.map((m) => m.pedidoViaje).filter((v) => v && v.estado === "PENDIENTE").map((v) => v!.id))) {
          if (!(await tx.materialListo.count({ where: { pedidoViajeId: viejo } }))) {
            await tx.pedidoViaje.update({ where: { id: viejo }, data: { estado: "CANCELADO", motivoCancelacion: "Se volvió a pedir el retiro", canceladoEn: new Date() } });
          }
        }
        for (const pmId of new Set(grupo.map((m) => m.pedidoMaterialId))) {
          await recalcular(tx, pmId, yo.id, `Viaje #${p.numero} pedido`);
          const pm = await tx.pedidoMaterial.findUniqueOrThrow({ where: { id: pmId }, include: { obra: { select: { nombre: true } } } });
          await notificarEvento(EVENTO.materialRetiroPedido({ ...deMaterial(pm), quien: yo.nombre, proveedor: primero.proveedor.nombre }), { tx, actor: yo.id });
        }
        await auditarBase(tx, {
          usuarioId: yo.id, accion: "pedido.crear", entidad: "PedidoViaje", entidadId: p.id,
          resumen: `${yo.nombre} pidió el retiro en ${primero.proveedor.nombre} de ${grupo.map((m) => queLleva(m.descripcion)).join(" + ")} para Obra ${obra.nombre}${d.prioridad === "URGENTE" ? " (urgente)" : ""}`,
          despues: { estado: "PENDIENTE", tipo: "RETIRO_PROVEEDOR", materiales: grupo.map((m) => m.id) },
        });
        out.push({ id: p.id, numero: p.numero, proveedor: primero.proveedor.nombre });
      }
      return out;
    });
    refrescar();
    for (const p of creados) await avisarSolicitudNueva(p.id, yo.id);
    return { pedidos: creados };
  });
}

/** Deshacer el pedido de retiro recién hecho: cancela los viajes y el material vuelve a LISTO. */
export async function deshacerRetiro(pedidoIds: string[]): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("pedidos.crear");
    await db.$transaction(async (tx) => {
      for (const id of pedidoIds) {
        const r = await tx.pedidoViaje.updateMany({
          where: { id, solicitanteId: yo.id, estado: "PENDIENTE", creadoEn: { gte: new Date(Date.now() - 2 * 60_000) } },
          data: { estado: "CANCELADO", motivoCancelacion: "Se deshizo al pedirlo", canceladoEn: new Date() },
        });
        if (!r.count) throw new ErrorNegocio("Ya no se puede deshacer.");
        await tx.materialListo.updateMany({ where: { pedidoViajeId: id, estado: "RETIRO_PEDIDO" }, data: { estado: "LISTO" } });
        const pms = await tx.materialListo.findMany({ where: { pedidoViajeId: id }, select: { pedidoMaterialId: true } });
        for (const pmId of new Set(pms.map((m) => m.pedidoMaterialId))) await recalcular(tx, pmId, yo.id, "Se deshizo el pedido del viaje");
        await auditarBase(tx, { usuarioId: yo.id, accion: "pedido.deshacer", entidad: "PedidoViaje", entidadId: id, resumen: `${yo.nombre} deshizo ${await describirPedido(tx, id)}`, antes: { estado: "PENDIENTE" }, despues: { estado: "CANCELADO" } });
      }
    });
    refrescar();
    return null;
  });
}
