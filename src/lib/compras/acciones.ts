"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { revalidar } from "@/lib/revalidar";
import { reevaluar } from "@/lib/alertas/reevaluar";
import { engancharAdjuntos, leerBuffer } from "@/lib/archivos";
import { notificarEvento } from "@/lib/notificaciones/enviar";
import { EVENTO } from "@/lib/notificaciones/eventos";
import { aFecha, diaISO, plata } from "@/lib/formato";
import { cambiarEstado } from "@/lib/materiales/circuito";
import { auditar, deMaterial, describir, exigirEstado, pedidoOError } from "@/lib/materiales/comun";
import { asignarNumeroOC } from "./numerar";
import { calcularTotales, OC_VIGENTE, puedePasar, resumenRenglones } from "./estados";
import { guardarPDF } from "./servicio";
import { leerPlanilla, type Importacion } from "./importar";

const refrescar = () => {
  revalidar("materiales");
  reevaluar("materiales");
};
const vacio = (v: unknown) => (v === "" || v == null ? undefined : v);
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const numero = (max: number) => z.preprocess((v) => (v === "" || v == null ? undefined : typeof v === "string" ? v.replace(/\./g, "").replace(",", ".") : v), z.coerce.number().min(0).max(max).optional());

const esquemaOC = z.object({
  id: z.preprocess(vacio, z.string().optional()),
  pedidoMaterialId: z.string().min(1),
  fecha: z.string().regex(DIA, "Revisá la fecha de emisión."),
  fechaNecesaria: z.preprocess(vacio, z.string().regex(DIA, "Revisá la fecha necesaria.").optional()),
  proveedorId: z.preprocess(vacio, z.string().optional()),
  sucursalId: z.preprocess(vacio, z.string().optional()),
  renglones: z
    .array(z.object({
      descripcion: z.string().trim().max(200),
      cantidad: numero(1_000_000),
      unidad: z.string().trim().max(20),
      precioUnitario: numero(1e12),
    }))
    .max(200)
    .transform((r) => r.filter((x) => x.descripcion.length > 0)),
  metodoPago: z.preprocess(vacio, z.enum(["ACOPIO", "CUENTA_CORRIENTE", "TRANSFERENCIA", "EFECTIVO", "ECHEQ"]).optional()),
  moneda: z.enum(["ARS", "USD"]).default("ARS"),
  condiciones: z.preprocess(vacio, z.string().trim().max(300).optional()),
  // 21 por defecto; null: sin IVA.
  ivaPorcentaje: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().min(0).max(100).nullable().default(21)),
  observaciones: z.preprocess(vacio, z.string().trim().max(1500).optional()),
  notasInternas: z.preprocess(vacio, z.string().trim().max(2000).optional()),
  adjuntos: z.array(z.string()).max(20).default([]),
});
export type DatosOC = z.input<typeof esquemaOC>;

/** Lo que exige el envío a aprobación (el borrador se guarda incompleto). */
function validarParaEnviar(d: z.output<typeof esquemaOC>) {
  if (!d.proveedorId) throw new ErrorNegocio("Elegí el proveedor.");
  if (!d.sucursalId) throw new ErrorNegocio("Elegí la sucursal del proveedor.");
  if (!d.metodoPago) throw new ErrorNegocio("Elegí el método de pago.");
  if (!d.renglones.length) throw new ErrorNegocio("Cargá al menos un material.");
  const sinCantidad = d.renglones.find((r) => !r.cantidad);
  if (sinCantidad) throw new ErrorNegocio(`Poné la cantidad de "${sinCantidad.descripcion}".`);
  const sinUnidad = d.renglones.find((r) => !r.unidad);
  if (sinUnidad) throw new ErrorNegocio(`Poné la unidad de "${sinUnidad.descripcion}".`);
}

/**
 * Guarda la OC del pedido (borrador) y, con enviar, la manda a aprobación: toma el número OC-AAAA-NNNN
 * (transaccional, nunca se repite), el pedido pasa a "Esperando aprobación", al dueño le llega el aviso
 * y se genera el PDF. Los datos son la fuente: el PDF sale de ellos.
 */
export async function guardarOC(entrada: DatosOC, enviar: boolean): Promise<Resultado<{ id: string; numero: string | null }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    const d = esquemaOC.parse(entrada);
    if (enviar) validarParaEnviar(d);

    // Proveedor y sucursal: la sucursal tiene que ser de ese proveedor y tener coordenadas.
    const suc = d.sucursalId ? await db.sucursalProveedor.findUnique({ where: { id: d.sucursalId }, include: { proveedor: { select: { id: true, nombre: true } } } }) : null;
    if (d.sucursalId && (!suc || suc.proveedorId !== d.proveedorId || !suc.activa)) throw new ErrorNegocio("Esa sucursal no es del proveedor elegido.");
    if (suc && (!Number.isFinite(suc.latitud) || !Number.isFinite(suc.longitud))) throw new ErrorNegocio("Esa sucursal no tiene ubicación en el mapa. Cargala de nuevo con la dirección.");

    const renglones = d.renglones.map((r, i) => {
      const cantidad = r.cantidad ?? 0;
      const precio = r.precioUnitario ?? null;
      return { orden: i + 1, descripcion: r.descripcion, cantidad, unidad: r.unidad || "u", precioUnitario: precio, subtotal: precio != null ? Math.round(cantidad * precio * 100) / 100 : null };
    });
    const tot = calcularTotales(renglones, d.ivaPorcentaje);
    const D = (x: number | null) => (x == null ? null : new Prisma.Decimal(x));

    const r = await db.$transaction(async (tx) => {
      const p = await pedidoOError(tx, d.pedidoMaterialId);
      exigirEstado(p, "EN_COMPRA");
      // Una sola OC vigente por pedido: si hay un borrador, es ese.
      const vigente = p.ordenCompraId ? await tx.ordenCompra.findUnique({ where: { id: p.ordenCompraId }, select: { id: true, estado: true } }) : null;
      if (vigente && vigente.estado !== "BORRADOR" && OC_VIGENTE.includes(vigente.estado)) throw new ErrorNegocio("Este pedido ya tiene una orden de compra enviada.");
      const id = d.id ?? (vigente?.estado === "BORRADOR" ? vigente.id : undefined);
      if (id) {
        const oc = await tx.ordenCompra.findUnique({ where: { id }, select: { estado: true, pedidoMaterialId: true } });
        if (!oc || oc.pedidoMaterialId !== p.id) throw new ErrorNegocio("Esa orden de compra no es de este pedido.");
        if (oc.estado !== "BORRADOR") throw new ErrorNegocio("La orden de compra ya se envió: no se puede editar.");
      }
      const datos = {
        fecha: aFecha(d.fecha, "12:00"), fechaNecesaria: d.fechaNecesaria ? aFecha(d.fechaNecesaria, "12:00") : null,
        proveedorId: suc?.proveedorId ?? d.proveedorId ?? null, sucursalId: suc?.id ?? null, metodoPago: d.metodoPago ?? null, moneda: d.moneda,
        condiciones: d.condiciones ?? null, observaciones: d.observaciones ?? null, notasInternas: d.notasInternas ?? null,
        ivaPorcentaje: tot.conPrecios ? D(d.ivaPorcentaje) : d.ivaPorcentaje == null ? null : D(d.ivaPorcentaje),
        subtotal: D(tot.subtotal), iva: D(tot.iva), total: D(tot.total),
      };
      const oc = id
        ? await tx.ordenCompra.update({ where: { id }, data: { ...datos, version: { increment: 1 } } })
        : await tx.ordenCompra.create({ data: { ...datos, pedidoMaterialId: p.id, obraId: p.obraId, solicitanteId: p.solicitanteId, creadaPorId: yo.id } });
      await tx.renglonOC.deleteMany({ where: { ordenCompraId: oc.id } });
      if (renglones.length) {
        await tx.renglonOC.createMany({ data: renglones.map((x) => ({ ...x, ordenCompraId: oc.id, cantidad: new Prisma.Decimal(x.cantidad), precioUnitario: D(x.precioUnitario), subtotal: D(x.subtotal) })) });
      }
      await engancharAdjuntos(tx, d.adjuntos, "ORDEN_COMPRA", oc.id, yo.id);
      if (!p.ordenCompraId || p.ordenCompraId !== oc.id) await tx.pedidoMaterial.update({ where: { id: p.id }, data: { ordenCompraId: oc.id } });
      if (!enviar) {
        if (!id) await auditar(tx, { usuarioId: yo.id, accion: "oc.borrador", entidadId: p.id, resumen: `${yo.nombre} empezó la orden de compra de ${describir(p)}` });
        return { id: oc.id, numero: null as string | null, aviso: null };
      }

      // ── Enviar a aprobación: número (fila del año bloqueada), estado y aviso, todo o nada ──
      if (!puedePasar("BORRADOR", "ESPERANDO_APROBACION")) throw new ErrorNegocio("No se puede enviar.");
      const n = await asignarNumeroOC(tx, oc.id);
      await tx.ordenCompra.update({ where: { id: oc.id }, data: { estado: "ESPERANDO_APROBACION", enviadaEn: new Date() } });
      const ok = await cambiarEstado(tx, p, "ESPERANDO_APROBACION", yo.id, `${n.numero} · ${suc!.proveedor.nombre}${tot.total != null ? ` · ${plata(tot.total)}` : ""}`, {
        ordenCompraNumero: n.numero, montoAprobado: D(tot.total), ...(p.tomadoPorId ? {} : { tomadoPorId: yo.id, tomadoEn: new Date() }),
      });
      if (!ok) throw new ErrorNegocio("El pedido cambió. Actualizá la pantalla.");
      const resumen = resumenRenglones(renglones);
      const solicitante = await tx.usuario.findUniqueOrThrow({ where: { id: p.solicitanteId }, select: { nombre: true } });
      await notificarEvento(EVENTO.ocParaAprobar({ ...deMaterial(p), numero: n.numero, proveedor: suc!.nombre === "Casa central" ? suc!.proveedor.nombre : `${suc!.proveedor.nombre} (${suc!.nombre})`, renglones: resumen, total: tot.total != null ? plata(tot.total) : null, quien: solicitante.nombre }), { tx, actor: yo.id });
      await notificarEvento(EVENTO.materialOcArmada(deMaterial(p)), { tx, actor: yo.id });
      await auditar(tx, {
        usuarioId: yo.id, accion: "oc.enviar", entidadId: p.id,
        resumen: `${yo.nombre} envió a aprobación la ${n.numero} de ${describir(p)} (${suc!.proveedor.nombre}, ${resumen}${tot.total != null ? `, ${plata(tot.total)}` : ""})`,
        antes: { estado: "EN_COMPRA" }, despues: { estado: "ESPERANDO_APROBACION", ordenCompra: n.numero, total: tot.total },
      });
      return { id: oc.id, numero: n.numero, aviso: null };
    });
    if (enviar) await guardarPDF(r.id, false);
    refrescar();
    return { id: r.id, numero: r.numero };
  });
}

/** "Corregir y reenviar": OC nueva (número nuevo al enviarla) precargada con la rechazada o anulada. */
export async function corregirOC(ocId: string): Promise<Resultado<{ id: string; pedidoMaterialId: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    const r = await db.$transaction(async (tx) => {
      const vieja = await tx.ordenCompra.findUnique({ where: { id: ocId }, include: { renglones: true } });
      if (!vieja || !["RECHAZADA", "ANULADA"].includes(vieja.estado)) throw new ErrorNegocio("Solo se corrige una orden de compra rechazada o anulada.");
      const p = await pedidoOError(tx, vieja.pedidoMaterialId);
      exigirEstado(p, "EN_COMPRA");
      if (p.ordenCompraId) {
        const vig = await tx.ordenCompra.findUnique({ where: { id: p.ordenCompraId }, select: { estado: true } });
        if (vig?.estado === "BORRADOR") return { id: p.ordenCompraId, pedidoMaterialId: p.id };
        if (vig && OC_VIGENTE.includes(vig.estado)) throw new ErrorNegocio("Este pedido ya tiene otra orden de compra en curso.");
      }
      const nueva = await tx.ordenCompra.create({
        data: {
          pedidoMaterialId: vieja.pedidoMaterialId, obraId: vieja.obraId, solicitanteId: vieja.solicitanteId, proveedorId: vieja.proveedorId, sucursalId: vieja.sucursalId,
          fecha: aFecha(diaISO(), "12:00"), fechaNecesaria: vieja.fechaNecesaria, metodoPago: vieja.metodoPago, moneda: vieja.moneda, condiciones: vieja.condiciones,
          observaciones: vieja.observaciones, notasInternas: vieja.notasInternas, ivaPorcentaje: vieja.ivaPorcentaje, subtotal: vieja.subtotal, iva: vieja.iva, total: vieja.total, creadaPorId: yo.id,
          renglones: { create: vieja.renglones.map((x) => ({ orden: x.orden, descripcion: x.descripcion, cantidad: x.cantidad, unidad: x.unidad, precioUnitario: x.precioUnitario, subtotal: x.subtotal })) },
        },
      });
      // Los adjuntos de la anterior (presupuestos) siguen sirviendo.
      const adjuntos = await tx.adjunto.findMany({ where: { entidadTipo: "ORDEN_COMPRA", entidadId: vieja.id } });
      for (const a of adjuntos) await tx.adjunto.create({ data: { entidadTipo: a.entidadTipo, entidadId: nueva.id, nombre: a.nombre, url: a.url, tipoMime: a.tipoMime, tamanoBytes: a.tamanoBytes, interno: a.interno, subidoPorId: a.subidoPorId } });
      await tx.pedidoMaterial.update({ where: { id: p.id }, data: { ordenCompraId: nueva.id } });
      await auditar(tx, { usuarioId: yo.id, accion: "oc.corregir", entidadId: p.id, resumen: `${yo.nombre} empezó a corregir la ${vieja.numero ?? "orden de compra"} de ${describir(p)} (sale con número nuevo)` });
      return { id: nueva.id, pedidoMaterialId: p.id };
    });
    refrescar();
    return r;
  });
}

/** Anular una OC (Compras): borrador o enviada; aprobada solo si todavía no se habilitó nada. El número no se reutiliza. */
export async function anularOC(ocId: string, motivo: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    const m = motivo.trim();
    if (m.length < 3) throw new ErrorNegocio("Contá por qué se anula.");
    await db.$transaction(async (tx) => {
      const oc = await tx.ordenCompra.findUnique({ where: { id: ocId } });
      if (!oc || !puedePasar(oc.estado, "ANULADA")) throw new ErrorNegocio("Esta orden de compra ya no se puede anular.");
      const p = await pedidoOError(tx, oc.pedidoMaterialId);
      if (oc.estado === "APROBADA" && (await tx.materialListo.count({ where: { pedidoMaterialId: p.id, estado: { not: "CANCELADO" } } }))) throw new ErrorNegocio("Ya se habilitó material de esta orden: no se puede anular.");
      await tx.ordenCompra.update({ where: { id: ocId }, data: { estado: "ANULADA", motivoAnulacion: m } });
      if (p.ordenCompraId === ocId) {
        const limpiar = { ordenCompraId: null, ordenCompraNumero: null, montoAprobado: null };
        if (p.estado === "ESPERANDO_APROBACION" || p.estado === "APROBADO") await cambiarEstado(tx, p, "EN_COMPRA", yo.id, `${oc.numero ?? "OC"} anulada: ${m}`, { ...limpiar, aprobadoPorId: null, aprobadoEn: null });
        else await tx.pedidoMaterial.update({ where: { id: p.id }, data: limpiar });
      }
      await auditar(tx, { usuarioId: yo.id, accion: "oc.anular", entidadId: p.id, resumen: `${yo.nombre} anuló la ${oc.numero ?? "orden de compra en borrador"} de ${describir(p)}: ${m}`, antes: { estado: oc.estado }, despues: { estado: "ANULADA", motivo: m } });
    });
    refrescar();
    return null;
  });
}

/**
 * "Importar desde Excel/CSV": lee la planilla que adjuntó el que pidió y devuelve los renglones para
 * la vista previa (no guarda nada: Compras confirma y los ve en la tabla de la OC).
 */
export async function importarPlanilla(adjuntoId: string): Promise<Resultado<Importacion>> {
  return ejecutar(async () => {
    await exigirPermiso("materiales.gestionar");
    const a = await db.adjunto.findUnique({ where: { id: adjuntoId } });
    if (!a || !["PEDIDO_MATERIAL", "ORDEN_COMPRA"].includes(a.entidadTipo)) throw new ErrorNegocio("No existe ese archivo.");
    const datos = await leerBuffer(a.url);
    if (!datos) return { ok: false, motivo: "El archivo no está disponible. Cargá los renglones a mano." } as Importacion;
    return leerPlanilla(datos, a.nombre);
  });
}
