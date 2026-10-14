"use server";

import { Prisma, type EstadoTablero, type SemaforoPE } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso, exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { revalidar } from "@/lib/revalidar";
import { reevaluar } from "@/lib/alertas/reevaluar";
import { engancharAdjuntos, leerBuffer } from "@/lib/archivos";
import { auditar as auditarBase } from "@/lib/auditoria";
import { notificarEvento } from "@/lib/notificaciones/enviar";
import { EVENTO } from "@/lib/notificaciones/eventos";
import { aFecha, diaISO } from "@/lib/formato";
import { cotizacionParaOC } from "@/lib/dolar";
import { cambiarEstado } from "@/lib/materiales/circuito";
import { auditar, deMaterial, describir, exigirEstado, pedidoOError } from "@/lib/materiales/comun";
import { asignarNumeroOC } from "./numerar";
import { calcularTotales, cambioDeFondo, importeTexto, OC_VIGENTE, puedePasar, resumenRenglones, TIPO_ORDEN, type HuellaAprobacion } from "./estados";
import { ESTADO_TABLERO, sincronizarTablero } from "./estadoTablero";
import { esquemaOC, faltaParaEnviar, type DatosOC, type DatosOCValidos } from "./esquema";
import { guardarPDF } from "./servicio";
import { leerPlanilla, type Importacion } from "./importar";

const refrescar = () => {
  revalidar("materiales");
  reevaluar("materiales");
};
const D = (x: number | null | undefined) => (x == null ? null : new Prisma.Decimal(x));
const dia = (s: string | undefined) => (s ? aFecha(s, "12:00") : null);
type Tx = Prisma.TransactionClient;

/** Auditoría de una orden: con pedido, en el pedido (su línea de tiempo); sin pedido, en la orden. */
const auditarOC = (tx: Tx, oc: { id: string; pedidoMaterialId: string | null }, d: { usuarioId: string; accion: string; resumen: string; antes?: Prisma.InputJsonValue; despues?: Prisma.InputJsonValue }) =>
  oc.pedidoMaterialId ? auditar(tx, { ...d, entidadId: oc.pedidoMaterialId }) : auditarBase(tx, { entidad: "OrdenCompra", entidadId: oc.id, ...d });

const nombreOC = (o: { tipo: "OC" | "PE"; numero: string | null; versionAprobacion?: number }) =>
  o.numero ? `${o.numero}${o.versionAprobacion && o.versionAprobacion > 1 ? ` v${o.versionAprobacion}` : ""}` : `${TIPO_ORDEN[o.tipo].titulo.toLowerCase()} en borrador`;

/** Solicitado por: "u:<id>" usuario activo, "e:<id>" solicitante externo activo. */
async function resolverSolicitante(tx: Tx, valor: string | undefined) {
  if (!valor) return { solicitanteId: null, solicitanteExternoId: null, nombre: null as string | null };
  const id = valor.slice(2);
  if (valor.startsWith("u:")) {
    const u = await tx.usuario.findUnique({ where: { id }, select: { id: true, nombre: true, activo: true } });
    if (!u?.activo) throw new ErrorNegocio("Esa persona ya no está en el sistema. Elegí otra.");
    return { solicitanteId: u.id, solicitanteExternoId: null, nombre: u.nombre };
  }
  const e = await tx.solicitanteExterno.findUnique({ where: { id } });
  if (!e?.activo) throw new ErrorNegocio("Ese nombre ya no está en la lista. Elegí otro.");
  return { solicitanteId: null, solicitanteExternoId: e.id, nombre: e.nombre };
}

/** Lo que va a la base desde la plantilla (sin estado ni número). */
async function datosDeLaPlantilla(tx: Tx, d: DatosOCValidos) {
  const suc = d.sucursalId ? await tx.sucursalProveedor.findUnique({ where: { id: d.sucursalId }, include: { proveedor: { select: { id: true, nombre: true } } } }) : null;
  if (d.sucursalId && (!suc || suc.proveedorId !== d.proveedorId || !suc.activa)) throw new ErrorNegocio("Esa sucursal no es del proveedor elegido.");
  if (d.proveedorId && !suc && !(await tx.proveedor.findUnique({ where: { id: d.proveedorId }, select: { id: true } }))) throw new ErrorNegocio("No existe ese proveedor.");
  const sol = await resolverSolicitante(tx, d.solicitadoPor);
  for (const id of [d.empresaCompraId, d.empresaFacturarId].filter(Boolean) as string[]) {
    if (!(await tx.razonSocial.findUnique({ where: { id }, select: { activa: true } }))?.activa) throw new ErrorNegocio("Esa razón social no está activa.");
  }
  if (d.obraId && !(await tx.obra.findUnique({ where: { id: d.obraId }, select: { id: true } }))) throw new ErrorNegocio("No existe esa obra.");

  const renglones = d.renglones.map((r, i) => {
    const cantidad = r.cantidad ?? 0;
    const precio = r.precioUnitario ?? null;
    return { orden: i + 1, descripcion: r.descripcion, cantidad, unidad: r.unidad || "u", precioUnitario: precio, subtotal: precio != null ? Math.round(cantidad * precio * 100) / 100 : null };
  });
  const tot = calcularTotales(renglones, 21);
  // Importe: el que escribió; si no escribió y los renglones tienen precio, la suma.
  const importe = d.importe ?? (tot.conPrecios ? tot.subtotal : null);
  const datos = {
    tipo: d.tipo,
    empresaCompraId: d.empresaCompraId ?? null,
    fecha: aFecha(d.fecha, "12:00"), fechaNecesaria: dia(d.fechaNecesaria), fechaEntrega: dia(d.fechaEntrega),
    solicitanteId: sol.solicitanteId, solicitanteExternoId: sol.solicitanteExternoId, solicitadoPorTexto: null,
    obraId: d.obraId ?? null, obraTexto: null,
    detallePedido: d.detallePedido ?? null,
    proveedorSugerido: d.proveedorSugerido ?? null,
    proveedorId: suc?.proveedorId ?? d.proveedorId ?? null, sucursalId: suc?.id ?? null,
    presupuestoNumero: d.presupuestoNumero ?? null,
    importe: D(importe), importeAConfirmar: d.importeAConfirmar, moneda: d.moneda,
    formaPago: d.formaPago ?? null, condicionPago: d.condicionPago ?? null, condicionPagoTexto: d.condicionPagoTexto ?? null,
    observaciones: d.observaciones ?? null, notasInternas: d.notasInternas ?? null,
    semaforoPE: d.tipo === "PE" ? d.semaforoPE ?? "NADA_TODAVIA" : null,
    subtotal: D(tot.subtotal), iva: null, ivaPorcentaje: null, total: D(tot.subtotal),
    empresaFacturarId: d.empresaFacturarId ?? null, facturaNumero: d.facturaNumero ?? null, facturaImporte: D(d.facturaImporte), facturaFecha: dia(d.facturaFecha),
    facturaFormaPago: d.facturaFormaPago ?? null, facturaCondicion: d.facturaCondicion ?? null, facturaAdjuntoId: d.facturaAdjuntoId ?? null,
    fechaPago: dia(d.fechaPago), pagoImporte: D(d.pagoImporte), pagoObservaciones: d.pagoObservaciones ?? null,
  } satisfies Prisma.OrdenCompraUncheckedUpdateInput;
  return { datos, renglones, suc, sol, importe };
}

const huella = (o: { proveedorId: string | null; sucursalId: string | null; importe: Prisma.Decimal | number | null; importeAConfirmar: boolean; moneda: "ARS" | "USD"; detallePedido: string | null; formaPago: HuellaAprobacion["formaPago"]; condicionPago: HuellaAprobacion["condicionPago"]; condicionPagoTexto: string | null }, renglones: { descripcion: string; cantidad: Prisma.Decimal | number; unidad: string; precioUnitario: Prisma.Decimal | number | null }[]): HuellaAprobacion => ({
  proveedorId: o.proveedorId, sucursalId: o.sucursalId, importe: o.importe == null ? null : Number(o.importe), importeAConfirmar: o.importeAConfirmar, moneda: o.moneda,
  detallePedido: o.detallePedido, formaPago: o.formaPago, condicionPago: o.condicionPago, condicionPagoTexto: o.condicionPagoTexto,
  renglones: renglones.map((r) => ({ descripcion: r.descripcion, cantidad: Number(r.cantidad), unidad: r.unidad, precioUnitario: r.precioUnitario == null ? null : Number(r.precioUnitario) })),
});

async function guardarRenglones(tx: Tx, ocId: string, renglones: Awaited<ReturnType<typeof datosDeLaPlantilla>>["renglones"]) {
  await tx.renglonOC.deleteMany({ where: { ordenCompraId: ocId } });
  if (renglones.length) {
    await tx.renglonOC.createMany({ data: renglones.map((x) => ({ ...x, ordenCompraId: ocId, cantidad: new Prisma.Decimal(x.cantidad), precioUnitario: D(x.precioUnitario), subtotal: D(x.subtotal) })) });
  }
}

/** Pedido de material "por detrás" para una orden creada directo desde Órdenes (Alejandra pide por la obra). */
async function crearPedidoPorDetras(tx: Tx, d: DatosOCValidos, yo: { id: string; nombre: string }, solicitanteId: string | null) {
  const primera = (d.detallePedido ?? d.renglones.map((r) => `${r.cantidad ?? ""} ${r.unidad} ${r.descripcion}`.trim()).join("\n")).split("\n").map((l) => l.trim()).filter(Boolean);
  const descripcion = (primera.length > 1 ? `${primera[0]} + ${primera.length - 1} más` : primera[0] ?? "Orden de compra").slice(0, 300);
  return tx.pedidoMaterial.create({
    data: {
      obraId: d.obraId!, obraSedeId: d.obraSedeId ?? null, solicitanteId: solicitanteId ?? yo.id, descripcion,
      renglones: d.renglones.length ? d.renglones.map((r) => ({ descripcion: r.descripcion, cantidad: r.cantidad ?? null, unidad: r.unidad || "u" })) : undefined,
      paraCuando: dia(d.fechaNecesaria) ?? aFecha(d.fecha, "12:00"), estado: "EN_COMPRA", tomadoPorId: yo.id, tomadoEn: new Date(),
      observaciones: d.observaciones ?? null,
      cambios: { create: [{ de: "SOLICITADO", a: "EN_COMPRA", usuarioId: yo.id, nota: `${yo.nombre} armó la orden desde Órdenes` }] },
    },
    include: { obra: { select: { nombre: true } }, tomadoPor: { select: { nombre: true } } },
  });
}

/**
 * LA PLANTILLA: guarda la orden (OC o PE) y, con enviar, la manda a aprobación: toma el número OC-NNNN
 * o PE-NNNN (transaccional, cada tipo con su numeración), el pedido pasa a "Esperando aprobación", al
 * dueño le llega el aviso con los datos escritos y se genera el PDF.
 *  - Sin pedido de material (directo desde Órdenes): el pedido se crea por detrás al tener obra.
 *  - Ya aprobada: si cambió proveedor final, importe, materiales, forma o condición de pago, vuelve a
 *    aprobación con el mismo número y "v2"; si no (facturación, orden de pago, observaciones…), no.
 */
export async function guardarOC(entrada: DatosOC, enviar: boolean): Promise<Resultado<{ id: string; numero: string | null; pedidoMaterialId: string | null; reaprobacion: boolean }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    const d = esquemaOC.parse(entrada);
    if (enviar) {
      const falta = faltaParaEnviar(d);
      if (falta) throw new ErrorNegocio(falta);
    }
    const cotizacion = d.moneda === "USD" ? await cotizacionParaOC() : null;

    const r = await db.$transaction(async (tx) => {
      const { datos, renglones, suc, sol, importe } = await datosDeLaPlantilla(tx, d);
      const existente = d.id ? await tx.ordenCompra.findUnique({ where: { id: d.id }, include: { renglones: true } }) : null;
      if (d.id && !existente) throw new ErrorNegocio("No existe esa orden.");
      if (existente && (existente.estado === "RECHAZADA" || existente.estado === "ANULADA")) throw new ErrorNegocio("Esta orden está anulada o rechazada: usá \"Corregir y reenviar\".");
      if (existente?.fuente === "IMPORTADA_EXCEL") throw new ErrorNegocio("Las órdenes importadas del Excel se editan desde el tablero.");
      if (existente && existente.tipo !== d.tipo && existente.numero) throw new ErrorNegocio("Una orden con número no cambia de tipo.");

      // ── Ya enviada o aprobada: edición con versión ──
      if (existente && existente.estado !== "BORRADOR") {
        const cambios = cambioDeFondo(huella(existente, existente.renglones), huella({ ...datos, importe }, renglones));
        const reaprobar = existente.estado === "APROBADA" && cambios.length > 0;
        let pedido = existente.pedidoMaterialId ? await pedidoOError(tx, existente.pedidoMaterialId) : null;
        if (reaprobar) {
          if (pedido && pedido.estado !== "APROBADO") throw new ErrorNegocio(`Ya se habilitó material de esta orden: no se puede cambiar ${cambios.join(", ")}. Anulala y armá una nueva.`);
        }
        await tx.ordenCompra.update({
          where: { id: existente.id },
          data: {
            ...datos, tipo: existente.tipo, version: { increment: 1 }, cotizacionUsd: d.moneda === "USD" ? D(cotizacion) ?? existente.cotizacionUsd : null,
            ...(reaprobar ? { estado: "ESPERANDO_APROBACION", versionAprobacion: { increment: 1 }, aprobadaPorId: null, aprobadaEn: null, pdfAprobadaUrl: null, enviadaEn: new Date() } : {}),
          },
        });
        await guardarRenglones(tx, existente.id, renglones);
        await engancharAdjuntos(tx, d.adjuntos, "ORDEN_COMPRA", existente.id, yo.id);
        const nueva = { tipo: existente.tipo, numero: existente.numero, versionAprobacion: existente.versionAprobacion + (reaprobar ? 1 : 0) };
        if (reaprobar && pedido) {
          const ok = await cambiarEstado(tx, pedido, "ESPERANDO_APROBACION", yo.id, `${nombreOC(nueva)}: cambió ${cambios.join(", ")}`, { aprobadoPorId: null, aprobadoEn: null, montoAprobado: D(importe) });
          if (!ok) throw new ErrorNegocio("El pedido cambió. Actualizá la pantalla.");
          pedido = await pedidoOError(tx, pedido.id);
          await notificarEvento(EVENTO.ocParaAprobar({
            ...deMaterial(pedido), numero: `${nombreOC(nueva)} (cambió ${cambios.join(", ")})`, proveedor: suc ? `${suc.proveedor.nombre}` : d.proveedorSugerido ?? "proveedor a definir",
            renglones: d.detallePedido?.split("\n")[0] ?? resumenRenglones(renglones), total: importeTexto(importe, d.moneda, d.importeAConfirmar), quien: sol.nombre ?? "—",
          }), { tx, actor: yo.id });
        }
        await sincronizarTablero(tx, existente.id);
        await auditarOC(tx, existente, {
          usuarioId: yo.id, accion: reaprobar ? "oc.reaprobacion" : "oc.editar",
          resumen: reaprobar
            ? `${yo.nombre} editó la ${nombreOC(existente)}: cambió ${cambios.join(", ")}. Vuelve a aprobación como ${nombreOC(nueva)}`
            : `${yo.nombre} actualizó la ${nombreOC(existente)}`,
          antes: { version: existente.version }, despues: { version: existente.version + 1, cambios },
        });
        return { id: existente.id, numero: existente.numero, pedidoMaterialId: existente.pedidoMaterialId, reaprobacion: reaprobar, pdf: existente.estado === "APROBADA" && !reaprobar ? ("ambos" as const) : ("original" as const) };
      }

      // ── Borrador (nuevo o existente) ──
      let pedidoId = existente?.pedidoMaterialId ?? d.pedidoMaterialId ?? null;
      if (pedidoId) {
        const p = await pedidoOError(tx, pedidoId);
        exigirEstado(p, "EN_COMPRA");
        if (d.obraId && d.obraId !== p.obraId) throw new ErrorNegocio("La obra de la orden tiene que ser la del pedido.");
        const vigente = p.ordenCompraId ? await tx.ordenCompra.findUnique({ where: { id: p.ordenCompraId }, select: { id: true, estado: true } }) : null;
        if (vigente && vigente.id !== existente?.id && OC_VIGENTE.includes(vigente.estado) && vigente.estado !== "BORRADOR") throw new ErrorNegocio("Este pedido ya tiene una orden enviada.");
      }
      // Directo desde Órdenes: el pedido de material se crea por detrás en cuanto hay obra (solicitante: quien ella indique).
      let creadoPorDetras = false;
      if (!pedidoId && d.obraId) {
        const p = await crearPedidoPorDetras(tx, d, yo, sol.solicitanteId);
        pedidoId = p.id;
        creadoPorDetras = true;
      }
      const base = { ...datos, pedidoMaterialId: pedidoId, cotizacionUsd: d.moneda === "USD" ? D(cotizacion) : null };
      const oc = existente
        ? await tx.ordenCompra.update({ where: { id: existente.id }, data: { ...base, version: { increment: 1 } } })
        : await tx.ordenCompra.create({ data: { ...base, creadaPorId: yo.id } });
      await guardarRenglones(tx, oc.id, renglones);
      await engancharAdjuntos(tx, d.adjuntos, "ORDEN_COMPRA", oc.id, yo.id);
      if (pedidoId) {
        const p = await pedidoOError(tx, pedidoId);
        if (p.ordenCompraId !== oc.id) await tx.pedidoMaterial.update({ where: { id: p.id }, data: { ordenCompraId: oc.id } });
      }
      if (!enviar) {
        await sincronizarTablero(tx, oc.id);
        if (!existente) await auditarOC(tx, oc, { usuarioId: yo.id, accion: "oc.borrador", resumen: `${yo.nombre} empezó ${d.tipo === "PE" ? "un pedido especial" : "una orden de compra"}${creadoPorDetras ? " desde Órdenes" : ""}` });
        return { id: oc.id, numero: null as string | null, pedidoMaterialId: pedidoId, reaprobacion: false, pdf: null };
      }

      // ── Enviar a aprobación: número (fila del tipo bloqueada), estado y aviso, todo o nada ──
      if (!puedePasar("BORRADOR", "ESPERANDO_APROBACION")) throw new ErrorNegocio("No se puede enviar.");
      const n = await asignarNumeroOC(tx, oc.id);
      await tx.ordenCompra.update({ where: { id: oc.id }, data: { estado: "ESPERANDO_APROBACION", enviadaEn: new Date() } });
      const p = await pedidoOError(tx, pedidoId!);
      const textoImporte = importeTexto(importe, d.moneda, d.importeAConfirmar);
      const proveedor = suc ? (suc.nombre === "Casa central" ? suc.proveedor.nombre : `${suc.proveedor.nombre} (${suc.nombre})`) : d.proveedorSugerido ? `${d.proveedorSugerido} (sugerido)` : "proveedor a definir";
      const ok = await cambiarEstado(tx, p, "ESPERANDO_APROBACION", yo.id, `${n.numero} · ${proveedor} · ${textoImporte}`, {
        ordenCompraNumero: n.numero, montoAprobado: D(importe), ...(p.tomadoPorId ? {} : { tomadoPorId: yo.id, tomadoEn: new Date() }),
      });
      if (!ok) throw new ErrorNegocio("El pedido cambió. Actualizá la pantalla.");
      const resumen = d.detallePedido?.split("\n").map((l) => l.trim()).filter(Boolean)[0] ?? resumenRenglones(renglones);
      await notificarEvento(EVENTO.ocParaAprobar({ ...deMaterial(p), numero: n.numero, proveedor, renglones: resumen, total: textoImporte, quien: sol.nombre ?? "—" }), { tx, actor: yo.id });
      if (!creadoPorDetras) await notificarEvento(EVENTO.materialOcArmada(deMaterial(p)), { tx, actor: yo.id });
      await sincronizarTablero(tx, oc.id);
      await auditar(tx, {
        usuarioId: yo.id, accion: "oc.enviar", entidadId: p.id,
        resumen: `${yo.nombre} envió a aprobación la ${n.numero} de ${describir(p)} (${proveedor}, ${resumen}, ${textoImporte})`,
        antes: { estado: "EN_COMPRA" }, despues: { estado: "ESPERANDO_APROBACION", ordenCompra: n.numero, importe },
      });
      return { id: oc.id, numero: n.numero, pedidoMaterialId: p.id, reaprobacion: false, pdf: "original" as const };
    }, { timeout: 20_000 });
    if (r.pdf) await guardarPDF(r.id, false);
    if (r.pdf === "ambos") await guardarPDF(r.id, true);
    refrescar();
    return { id: r.id, numero: r.numero, pedidoMaterialId: r.pedidoMaterialId, reaprobacion: r.reaprobacion };
  });
}

/** "Corregir y reenviar": orden nueva (número nuevo al enviarla) precargada con la rechazada o anulada. */
export async function corregirOC(ocId: string): Promise<Resultado<{ id: string; pedidoMaterialId: string | null }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    const r = await db.$transaction(async (tx) => {
      const vieja = await tx.ordenCompra.findUnique({ where: { id: ocId }, include: { renglones: true } });
      if (!vieja || !["RECHAZADA", "ANULADA"].includes(vieja.estado)) throw new ErrorNegocio("Solo se corrige una orden rechazada o anulada.");
      if (!vieja.pedidoMaterialId) throw new ErrorNegocio("Esta orden no tiene pedido de material: armá una nueva desde Órdenes.");
      const p = await pedidoOError(tx, vieja.pedidoMaterialId);
      exigirEstado(p, "EN_COMPRA");
      if (p.ordenCompraId) {
        const vig = await tx.ordenCompra.findUnique({ where: { id: p.ordenCompraId }, select: { estado: true } });
        if (vig?.estado === "BORRADOR") return { id: p.ordenCompraId, pedidoMaterialId: p.id };
        if (vig && OC_VIGENTE.includes(vig.estado)) throw new ErrorNegocio("Este pedido ya tiene otra orden en curso.");
      }
      const copiar = {
        tipo: vieja.tipo, pedidoMaterialId: vieja.pedidoMaterialId, obraId: vieja.obraId, solicitanteId: vieja.solicitanteId, solicitanteExternoId: vieja.solicitanteExternoId,
        empresaCompraId: vieja.empresaCompraId, proveedorId: vieja.proveedorId, sucursalId: vieja.sucursalId, proveedorSugerido: vieja.proveedorSugerido,
        fecha: aFecha(diaISO(), "12:00"), fechaNecesaria: vieja.fechaNecesaria, fechaEntrega: vieja.fechaEntrega, detallePedido: vieja.detallePedido,
        presupuestoNumero: vieja.presupuestoNumero, importe: vieja.importe, importeAConfirmar: vieja.importeAConfirmar, moneda: vieja.moneda,
        formaPago: vieja.formaPago, condicionPago: vieja.condicionPago, condicionPagoTexto: vieja.condicionPagoTexto, observaciones: vieja.observaciones,
        notasInternas: vieja.notasInternas, semaforoPE: vieja.semaforoPE, subtotal: vieja.subtotal, total: vieja.total, creadaPorId: yo.id,
      };
      const nueva = await tx.ordenCompra.create({
        data: { ...copiar, renglones: { create: vieja.renglones.map((x) => ({ orden: x.orden, descripcion: x.descripcion, cantidad: x.cantidad, unidad: x.unidad, precioUnitario: x.precioUnitario, subtotal: x.subtotal })) } },
      });
      // Los adjuntos de la anterior (presupuestos) siguen sirviendo.
      const adjuntos = await tx.adjunto.findMany({ where: { entidadTipo: "ORDEN_COMPRA", entidadId: vieja.id } });
      for (const a of adjuntos) await tx.adjunto.create({ data: { entidadTipo: a.entidadTipo, entidadId: nueva.id, nombre: a.nombre, url: a.url, tipoMime: a.tipoMime, tamanoBytes: a.tamanoBytes, interno: a.interno, subidoPorId: a.subidoPorId } });
      await tx.pedidoMaterial.update({ where: { id: p.id }, data: { ordenCompraId: nueva.id } });
      await auditar(tx, { usuarioId: yo.id, accion: "oc.corregir", entidadId: p.id, resumen: `${yo.nombre} empezó a corregir la ${vieja.numero ?? "orden"} de ${describir(p)} (sale con número nuevo)` });
      return { id: nueva.id, pedidoMaterialId: p.id };
    });
    refrescar();
    return r;
  });
}

/** Anular una orden (Compras): borrador o enviada; aprobada solo si todavía no se habilitó nada. El número no se reutiliza. */
export async function anularOC(ocId: string, motivo: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    const m = motivo.trim();
    if (m.length < 3) throw new ErrorNegocio("Contá por qué se anula.");
    await db.$transaction(async (tx) => {
      const oc = await tx.ordenCompra.findUnique({ where: { id: ocId } });
      if (!oc || !puedePasar(oc.estado, "ANULADA")) throw new ErrorNegocio("Esta orden ya no se puede anular.");
      if (oc.pedidoMaterialId) {
        const p = await pedidoOError(tx, oc.pedidoMaterialId);
        if (oc.estado === "APROBADA" && (await tx.materialListo.count({ where: { pedidoMaterialId: p.id, estado: { not: "CANCELADO" } } }))) throw new ErrorNegocio("Ya se habilitó material de esta orden: no se puede anular.");
        await tx.ordenCompra.update({ where: { id: ocId }, data: { estado: "ANULADA", motivoAnulacion: m } });
        if (p.ordenCompraId === ocId) {
          const limpiar = { ordenCompraId: null, ordenCompraNumero: null, montoAprobado: null };
          if (p.estado === "ESPERANDO_APROBACION" || p.estado === "APROBADO") await cambiarEstado(tx, p, "EN_COMPRA", yo.id, `${oc.numero ?? "Orden"} anulada: ${m}`, { ...limpiar, aprobadoPorId: null, aprobadoEn: null });
          else await tx.pedidoMaterial.update({ where: { id: p.id }, data: limpiar });
        }
      } else {
        await tx.ordenCompra.update({ where: { id: ocId }, data: { estado: "ANULADA", motivoAnulacion: m } });
      }
      await sincronizarTablero(tx, ocId);
      await auditarOC(tx, oc, { usuarioId: yo.id, accion: "oc.anular", resumen: `${yo.nombre} anuló la ${nombreOC(oc)}: ${m}`, antes: { estado: oc.estado }, despues: { estado: "ANULADA", motivo: m } });
    });
    refrescar();
    return null;
  });
}

// ───────────────────────────── Tablero ─────────────────────────────

const CELDAS = { proximosPasos: "Próximos pasos", comentarios: "Comentarios" } as const;

/** Celdas editables en línea del tablero ("Observaciones en OC / Próximos pasos" y "Comentarios"). */
export async function editarCeldaTablero(ocId: string, campo: keyof typeof CELDAS, valor: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    if (!(campo in CELDAS)) throw new ErrorNegocio("Esa columna no se edita.");
    const v = valor.trim().slice(0, 2000) || null;
    await db.$transaction(async (tx) => {
      const oc = await tx.ordenCompra.findUnique({ where: { id: ocId }, select: { id: true, tipo: true, numero: true, pedidoMaterialId: true, proximosPasos: true, comentarios: true } });
      if (!oc) throw new ErrorNegocio("No existe esa orden.");
      if ((oc[campo] ?? null) === v) return;
      await tx.ordenCompra.update({ where: { id: ocId }, data: { [campo]: v } });
      await auditarOC(tx, oc, { usuarioId: yo.id, accion: `oc.tablero.${campo}`, resumen: `${yo.nombre} anotó en ${CELDAS[campo]} de la ${nombreOC(oc)}: ${v ?? "(vacío)"}`, antes: { [campo]: oc[campo] }, despues: { [campo]: v } });
    });
    revalidar("materiales");
    return null;
  });
}

/** Ajuste a mano del ESTADO del tablero (vale hasta el próximo cambio real; ver estadoTablero.ts). */
export async function ajustarEstadoTablero(ocId: string, estado: EstadoTablero | null): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    await db.$transaction(async (tx) => {
      const oc = await tx.ordenCompra.findUnique({ where: { id: ocId }, select: { id: true, tipo: true, numero: true, pedidoMaterialId: true, estadoTablero: true, fuente: true } });
      if (!oc) throw new ErrorNegocio("No existe esa orden.");
      if (oc.estadoTablero === estado) return;
      await tx.ordenCompra.update({ where: { id: ocId }, data: { estadoTablero: estado, ...(oc.fuente === "IMPORTADA_EXCEL" ? { estadoTableroAuto: estado } : {}) } });
      const t = (e: EstadoTablero | null) => (e ? ESTADO_TABLERO[e].titulo : "sin estado");
      await auditarOC(tx, oc, { usuarioId: yo.id, accion: "oc.tablero.estado", resumen: `${yo.nombre} cambió a mano el estado de la ${nombreOC(oc)} en el tablero: ${t(oc.estadoTablero)} → ${t(estado)}`, antes: { estadoTablero: oc.estadoTablero }, despues: { estadoTablero: estado } });
    });
    revalidar("materiales");
    return null;
  });
}

/** "Encargado al proveedor": la orden aprobada ya se le pidió al proveedor (sin habilitación todavía). */
export async function marcarEncargada(ocId: string, encargada: boolean): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    await db.$transaction(async (tx) => {
      const oc = await tx.ordenCompra.findUnique({ where: { id: ocId }, select: { id: true, tipo: true, numero: true, estado: true, pedidoMaterialId: true } });
      if (!oc || oc.estado !== "APROBADA") throw new ErrorNegocio("Solo se encarga una orden autorizada.");
      await tx.ordenCompra.update({ where: { id: ocId }, data: { encargadaEn: encargada ? new Date() : null } });
      await sincronizarTablero(tx, ocId);
      await auditarOC(tx, oc, { usuarioId: yo.id, accion: "oc.encargar", resumen: encargada ? `${yo.nombre} encargó al proveedor la ${nombreOC(oc)}` : `${yo.nombre} desmarcó "encargado" en la ${nombreOC(oc)}` });
    });
    refrescar();
    return null;
  });
}

/** Semáforo de los pedidos especiales ("ESTADO DE LA ORDEN" arriba de cada PE). */
export async function cambiarSemaforoPE(ocId: string, semaforo: SemaforoPE): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    await db.$transaction(async (tx) => {
      const oc = await tx.ordenCompra.findUnique({ where: { id: ocId }, select: { id: true, tipo: true, numero: true, pedidoMaterialId: true, semaforoPE: true } });
      if (!oc || oc.tipo !== "PE") throw new ErrorNegocio("El semáforo es de los pedidos especiales.");
      await tx.ordenCompra.update({ where: { id: ocId }, data: { semaforoPE: semaforo } });
      await auditarOC(tx, oc, { usuarioId: yo.id, accion: "oc.semaforo", resumen: `${yo.nombre} marcó el ${nombreOC(oc)} como ${semaforo}`, antes: { semaforoPE: oc.semaforoPE }, despues: { semaforoPE: semaforo } });
    });
    revalidar("materiales");
    return null;
  });
}

/** Compras pidió presupuesto antes de armar la OC: el pedido aparece como "Solicitud de presupuesto". */
export async function marcarPresupuestoSolicitado(pedidoId: string, solicitado: boolean): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    await db.$transaction(async (tx) => {
      const p = await pedidoOError(tx, pedidoId);
      exigirEstado(p, "EN_COMPRA");
      await tx.pedidoMaterial.update({ where: { id: p.id }, data: { presupuestoSolicitado: solicitado } });
      // El tablero tiene una fila por orden: si todavía no hay, se empieza el borrador con lo del pedido.
      let ocId = p.ordenCompraId;
      if (!ocId && solicitado) {
        const obra = await tx.obra.findUnique({ where: { id: p.obraId }, select: { razonSocialId: true } });
        const empresa = obra?.razonSocialId ?? (await tx.razonSocial.findFirst({ where: { activa: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }], select: { id: true } }))?.id ?? null;
        const renglones = (Array.isArray(p.renglones) ? p.renglones : []) as { descripcion?: string; cantidad?: number | null; unidad?: string | null }[];
        const oc = await tx.ordenCompra.create({
          data: {
            pedidoMaterialId: p.id, obraId: p.obraId, solicitanteId: p.solicitanteId, empresaCompraId: empresa, fecha: aFecha(diaISO(), "12:00"), fechaNecesaria: p.paraCuando,
            detallePedido: p.descripcion, observaciones: p.observaciones, notasInternas: p.notasCompras, creadaPorId: yo.id,
            renglones: { create: renglones.filter((r) => r.descripcion).map((r, i) => ({ orden: i + 1, descripcion: r.descripcion!, cantidad: new Prisma.Decimal(r.cantidad ?? 0), unidad: r.unidad || "u" })) },
          },
        });
        await tx.pedidoMaterial.update({ where: { id: p.id }, data: { ordenCompraId: oc.id } });
        ocId = oc.id;
      }
      if (ocId) await sincronizarTablero(tx, ocId);
      await auditar(tx, { usuarioId: yo.id, accion: "material.presupuesto", entidadId: p.id, resumen: solicitado ? `${yo.nombre} pidió presupuesto para ${describir(p)}` : `${yo.nombre} desmarcó el pedido de presupuesto de ${describir(p)}` });
    });
    refrescar();
    return null;
  });
}

// ───────────────────────────── 4. Orden de pago ─────────────────────────────

/** "Autorización a la Orden de Pago": solo el dueño, con fecha y usuario. Se puede deshacer. */
export async function autorizarOrdenPago(ocId: string, autorizar = true): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    if (!puede(yo.rol, "materiales.aprobar")) throw new ErrorNegocio("Solo el dueño autoriza la orden de pago.");
    let regenerar = false;
    await db.$transaction(async (tx) => {
      const oc = await tx.ordenCompra.findUnique({ where: { id: ocId }, select: { id: true, tipo: true, numero: true, estado: true, pedidoMaterialId: true, ordenPagoAutorizadaEn: true } });
      if (!oc) throw new ErrorNegocio("No existe esa orden.");
      if (autorizar && oc.estado !== "APROBADA" && oc.estado !== "ESPERANDO_APROBACION") throw new ErrorNegocio("Primero hay que autorizar la orden.");
      await tx.ordenCompra.update({ where: { id: ocId }, data: autorizar ? { ordenPagoAutorizadaPorId: yo.id, ordenPagoAutorizadaEn: new Date() } : { ordenPagoAutorizadaPorId: null, ordenPagoAutorizadaEn: null } });
      await auditarOC(tx, oc, { usuarioId: yo.id, accion: "oc.ordenPago", resumen: autorizar ? `${yo.nombre} autorizó la orden de pago de la ${nombreOC(oc)}` : `${yo.nombre} quitó la autorización de la orden de pago de la ${nombreOC(oc)}` });
      regenerar = oc.estado === "APROBADA";
    });
    if (regenerar) await guardarPDF(ocId, true);
    refrescar();
    return null;
  });
}

/**
 * "Importar desde Excel/CSV": lee la planilla que adjuntó el que pidió y devuelve los renglones para
 * la vista previa (no guarda nada: Compras confirma y los ve en la tabla de la orden).
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
