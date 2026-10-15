"use server";

import { Prisma, type TipoOrden } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirSesion } from "@/lib/auth/sesion";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { revalidar } from "@/lib/revalidar";
import { reevaluar } from "@/lib/alertas/reevaluar";
import { engancharAdjuntos } from "@/lib/archivos";
import { notificarEvento } from "@/lib/notificaciones/enviar";
import { EVENTO } from "@/lib/notificaciones/eventos";
import { aFecha, diaISO } from "@/lib/formato";
import { cambiarEstado } from "@/lib/materiales/circuito";
import { auditar, deDocumento, describir, exigirEstado, primeraLinea } from "@/lib/materiales/comun";
import { asignarNumeroOC } from "./numerar";
import { estadoInicial, fuenteDe, nombreDoc } from "./documento";
import { CELDAS, esCelda, faltan, textoFaltan } from "./permisosCeldas";
import { puedeVerDocumento } from "./acceso";
import { incluirDocumento, textosDe, valoresDe } from "./celdas";
import { sincronizarTablero } from "./estadoTablero";
import { guardarPDF } from "./pdf";
import { guardarCeldaComo, type ResultadoCelda } from "./guardar-celda";

/**
 * ACCIONES DEL DOCUMENTO DE COMPRA (OC/PE). Todas verifican en el servidor quién puede (permisosCeldas.ts
 * y acceso.ts), auditan sobre la OrdenCompra (eso emite el tiempo real a los que la tienen abierta) y
 * avisan a quien corresponde (notificaciones/eventos.ts).
 */
const refrescar = () => {
  revalidar("materiales");
  reevaluar("materiales");
};
type Tx = Prisma.TransactionClient;

async function docConAcceso(tx: Tx, id: string, u: { id: string; rol: Parameters<typeof puedeVerDocumento>[0]["rol"] }) {
  const d = await tx.ordenCompra.findUnique({ where: { id }, include: incluirDocumento });
  if (!d || !(await puedeVerDocumento(u, d))) throw new ErrorNegocio("No existe esa orden o no la podés ver.");
  return d;
}

// ═══════════════════════════ Crear ═══════════════════════════

/**
 * "Armar orden de compra" / "Armar pedido especial": la plantilla en blanco. La gente de obra la empieza
 * en BORRADOR (con su obra si tiene una sola y "Solicitado por" ella misma); Compras y el dueño, en
 * EN_COMPRAS. La Empresa sale de la obra o es Signa Desarrollos.
 */
export async function crearDocumento(tipo: TipoOrden, obraId?: string): Promise<Resultado<{ id: string }>> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    if (yo.rol === "CHOFER" || yo.rol === "DEPOSITO") throw new ErrorNegocio("No tenés acceso a las órdenes de compra.");
    const obra = yo.rol === "RESPONSABLE_OBRA" || yo.rol === "CAPATAZ";
    let obraInicial: string | null = obraId ?? null;
    if (!obraInicial && yo.rol === "RESPONSABLE_OBRA") {
      const mias = await db.responsableObra.findMany({ where: { usuarioId: yo.id, activo: true, obra: { estado: "ACTIVA" } }, select: { obraId: true } });
      if (mias.length === 1) obraInicial = mias[0].obraId;
    }
    const o = obraInicial ? await db.obra.findUnique({ where: { id: obraInicial }, select: { id: true, razonSocialId: true, estado: true } }) : null;
    const empresa = o?.razonSocialId ?? (await db.razonSocial.findFirst({ where: { activa: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }], select: { id: true } }))?.id ?? null;
    const estado = estadoInicial(yo.rol, false);
    const d = await db.$transaction(async (tx) => {
      const d = await tx.ordenCompra.create({
        data: {
          tipo, estado, fuente: fuenteDe(yo.rol), creadaPorId: yo.id, fecha: aFecha(diaISO(), "12:00"),
          obraId: o && o.estado !== "FINALIZADA" ? o.id : null, empresaCompraId: empresa,
          solicitanteId: obra || yo.rol === "DIRECCION" ? yo.id : null, semaforoPE: tipo === "PE" ? "NADA_TODAVIA" : null,
          ...(yo.rol === "COMPRAS" ? { tomadoPorId: yo.id, tomadoEn: new Date() } : {}),
          cambios: { create: { de: null, a: estado, usuarioId: yo.id, nota: tipo === "PE" ? "Pedido especial" : null } },
        },
        select: { id: true, numeroInterno: true },
      });
      await auditar(tx, { usuarioId: yo.id, accion: "oc.crear", entidadId: d.id, resumen: `${yo.nombre} empezó ${tipo === "PE" ? "un pedido especial" : "una orden de compra"} (#${d.numeroInterno})` });
      return d;
    });
    refrescar();
    return { id: d.id };
  });
}

// ═══════════════════════════ Guardar una celda ═══════════════════════════

/**
 * Guardado por celda con número de versión (la plantilla guarda sola 800 ms después de escribir). Si la
 * versión que trae no es la actual, otro la cambió mientras tanto: devuelve el valor actual y quién fue
 * ("Alejandra cambió esto hace 10 s") sin pisarlo. El núcleo está en guardar-celda.ts (lo prueban los tests).
 */
export async function guardarCelda(ocId: string, celda: string, valor: string, version: number, opciones: { modificar?: boolean } = {}): Promise<Resultado<ResultadoCelda>> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    const { resultado, pdf } = await guardarCeldaComo(yo, ocId, celda, valor, version, opciones);
    if (pdf) await guardarPDF(ocId, false);
    if (!resultado.conflicto) refrescar();
    return resultado;
  });
}

// ═══════════════════════════ Recorrido ═══════════════════════════

/** "Enviar a Compras" (quien la armó): mínimo obra + detalle del pedido; lo demás puede ir vacío. */
export async function enviarACompras(ocId: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    await db.$transaction(async (tx) => {
      const d = await docConAcceso(tx, ocId, yo);
      exigirEstado(d, "BORRADOR");
      const falta = textoFaltan(faltan("enviarACompras", valoresDe(d)));
      if (falta) throw new ErrorNegocio(falta);
      const ok = await cambiarEstado(tx, d, "ENVIADA_A_COMPRAS", yo.id, d.notaDevolucion ? "Lo volvió a enviar" : undefined, { enviadaAComprasEn: new Date(), notaDevolucion: null, ...(d.solicitanteId || d.solicitanteExternoId ? {} : { solicitanteId: yo.id }) });
      if (!ok) throw new ErrorNegocio("La orden cambió. Actualizá la pantalla.");
      const adjuntos = await tx.adjunto.count({ where: { entidadTipo: "ORDEN_COMPRA", entidadId: ocId, interno: false } });
      await notificarEvento(EVENTO.materialNuevo({
        ...deDocumento(d), quien: d.solicitante?.nombre ?? yo.nombre, para: d.fechaNecesaria, urgente: d.prioridad === "URGENTE",
        observaciones: d.observacionesSolicitante, adjuntos, tipo: d.tipo,
      }), { tx, actor: yo.id });
      await auditar(tx, { usuarioId: yo.id, accion: "oc.enviarACompras", entidadId: ocId, resumen: `${yo.nombre} envió a Compras ${describir(d)}`, antes: { estado: "BORRADOR" }, despues: { estado: "ENVIADA_A_COMPRAS" } });
    });
    refrescar();
    return null;
  });
}

/** Compras la abre por primera vez: pasa a EN_COMPRAS y ella queda como responsable. (Lo llama la página.) */
export async function tomarAlAbrir(ocId: string): Promise<Resultado<{ tomada: boolean }>> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    if (yo.rol !== "COMPRAS") return { tomada: false };
    const tomada = await db.$transaction(async (tx) => {
      const d = await docConAcceso(tx, ocId, yo);
      if (d.estado !== "ENVIADA_A_COMPRAS") return false;
      const ok = await cambiarEstado(tx, d, "EN_COMPRAS", yo.id, undefined, { tomadoPorId: yo.id, tomadoEn: new Date() });
      if (!ok) return false;
      await notificarEvento(EVENTO.materialTomado({ ...deDocumento(d), comprador: yo.nombre }), { tx, actor: yo.id });
      await auditar(tx, { usuarioId: yo.id, accion: "oc.tomar", entidadId: ocId, resumen: `${yo.nombre} abrió ${describir(d)} y lo está comprando`, antes: { estado: "ENVIADA_A_COMPRAS" }, despues: { estado: "EN_COMPRAS" } });
      return true;
    });
    // Lo llama la página al pintarse: sin revalidar (el tiempo real refresca las listas de los demás).
    return { tomada };
  });
}

/** "Enviar a autorización" (solo Compras): número OC-NNNN / PE-NNNN, PDF y aviso al dueño. */
export async function enviarAAutorizacion(ocId: string): Promise<Resultado<{ numero: string }>> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    if (yo.rol !== "COMPRAS") throw new ErrorNegocio("Solo Compras envía a autorización.");
    const r = await db.$transaction(async (tx) => {
      const d = await docConAcceso(tx, ocId, yo);
      exigirEstado(d, "ENVIADA_A_COMPRAS", "EN_COMPRAS");
      const falta = textoFaltan(faltan("enviarAAutorizacion", valoresDe(d)));
      if (falta) throw new ErrorNegocio(falta);
      const n = await asignarNumeroOC(tx, ocId);
      const ok = await cambiarEstado(tx, d, "ESPERANDO_AUTORIZACION", yo.id, n.numero, {
        enviadaEn: new Date(), motivoRechazo: null, ...(d.tomadoPorId ? {} : { tomadoPorId: yo.id, tomadoEn: new Date() }),
        // Si la reenvía después de un rechazo: misma numeración, versión nueva.
        ...(d.rechazadaEn ? { versionAprobacion: { increment: 1 } } : {}),
      });
      if (!ok) throw new ErrorNegocio("La orden cambió. Actualizá la pantalla.");
      const t = textosDe(d);
      const numero = d.rechazadaEn ? `${n.numero} v${d.versionAprobacion + 1}` : n.numero;
      await notificarEvento(EVENTO.ocParaAprobar({ ...deDocumento(d), numero, proveedor: t.proveedorFinal || "proveedor a definir", renglones: primeraLinea(d.detallePedido), total: t.importe || null, quien: t.solicitadoPor || "—" }), { tx, actor: yo.id });
      await notificarEvento(EVENTO.materialOcArmada(deDocumento(d)), { tx, actor: yo.id });
      await auditar(tx, {
        usuarioId: yo.id, accion: "oc.enviar", entidadId: ocId,
        resumen: `${yo.nombre} envió a autorización la ${numero} (${t.proveedorFinal}, ${primeraLinea(d.detallePedido)}, ${t.importe})`,
        antes: { estado: d.estado }, despues: { estado: "ESPERANDO_AUTORIZACION", numero: n.numero },
      });
      return { numero };
    }, { timeout: 20_000 });
    await guardarPDF(ocId, false);
    refrescar();
    return r;
  });
}

/** "Devolver a quien pidió" (Compras): vuelve a BORRADOR de quien la armó, con la nota. */
export async function devolverASolicitante(ocId: string, nota: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    if (yo.rol !== "COMPRAS" && yo.rol !== "DIRECCION") throw new ErrorNegocio("Solo Compras devuelve una orden.");
    const n = nota.trim();
    if (n.length < 3) throw new ErrorNegocio("Contá qué falta o qué hay que cambiar.");
    await db.$transaction(async (tx) => {
      const d = await docConAcceso(tx, ocId, yo);
      exigirEstado(d, "ENVIADA_A_COMPRAS", "EN_COMPRAS");
      const quien = d.creadaPor.rol === "COMPRAS" || d.creadaPor.rol === "DIRECCION" ? d.solicitante : d.creadaPor;
      if (!quien) throw new ErrorNegocio("No hay a quién devolverla: la empezó Compras. Anulala si no sigue.");
      const ok = await cambiarEstado(tx, d, "BORRADOR", yo.id, `Devuelta: ${n}`, { notaDevolucion: n.slice(0, 1000), tomadoPorId: null, tomadoEn: null });
      if (!ok) throw new ErrorNegocio("La orden cambió. Actualizá la pantalla.");
      await notificarEvento(EVENTO.documentoDevuelto({ ...deDocumento(d), quien: yo.nombre, nota: n, creadorId: quien.id }), { tx, actor: yo.id });
      await auditar(tx, { usuarioId: yo.id, accion: "oc.devolver", entidadId: ocId, resumen: `${yo.nombre} le devolvió a ${quien.nombre} ${describir(d)}: ${n}`, antes: { estado: d.estado }, despues: { estado: "BORRADOR" } });
    });
    refrescar();
    return null;
  });
}

/** Anular: Compras y el dueño (sin nada habilitado en curso); quien la pidió, la suya mientras no la tomó Compras. */
export async function anularDocumento(ocId: string, motivo: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    const m = motivo.trim();
    if (m.length < 3) throw new ErrorNegocio("Contá por qué se anula.");
    await db.$transaction(async (tx) => {
      const d = await docConAcceso(tx, ocId, yo);
      const gestiona = yo.rol === "COMPRAS" || yo.rol === "DIRECCION";
      if (!gestiona) {
        if (d.creadaPorId !== yo.id && d.solicitanteId !== yo.id) throw new ErrorNegocio("Solo quien la pidió (o Compras) la puede anular.");
        if (d.estado !== "BORRADOR" && d.estado !== "ENVIADA_A_COMPRAS") throw new ErrorNegocio(`Compras ya la está comprando. Hablá con ${d.tomadoPor?.nombre ?? "Compras"} para anularla.`);
      }
      if (d.estado === "ANULADA" || d.estado === "ENTREGADA") throw new ErrorNegocio(d.estado === "ANULADA" ? "Ya estaba anulada." : "Ya se entregó.");
      if (await tx.materialListo.count({ where: { ordenCompraId: ocId, estado: { in: ["RETIRO_PEDIDO", "EN_CAMINO"] } } })) throw new ErrorNegocio("Hay un viaje pedido para retirarla. Cancelá primero ese viaje.");
      const ok = await cambiarEstado(tx, d, "ANULADA", yo.id, m, { motivoAnulacion: m });
      if (!ok) throw new ErrorNegocio("La orden cambió mientras la anulabas.");
      await tx.materialListo.updateMany({ where: { ordenCompraId: ocId, estado: "LISTO" }, data: { estado: "CANCELADO" } });
      if (d.estado !== "BORRADOR") await notificarEvento(EVENTO.materialCancelado({ ...deDocumento(d), quien: yo.nombre, motivo: m, porCompras: gestiona, compradorId: d.tomadoPorId }), { tx, actor: yo.id });
      await auditar(tx, { usuarioId: yo.id, accion: "oc.anular", entidadId: ocId, resumen: `${yo.nombre} anuló ${describir(d)}: ${m}`, antes: { estado: d.estado }, despues: { estado: "ANULADA", motivo: m } });
    });
    refrescar();
    return null;
  });
}

// ═══════════════════════════ Autorización (el dueño) ═══════════════════════════

export async function aprobarDocumento(ocId: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    if (yo.rol !== "DIRECCION") throw new ErrorNegocio("Solo el dueño autoriza las órdenes de compra.");
    await db.$transaction(async (tx) => {
      const d = await docConAcceso(tx, ocId, yo);
      exigirEstado(d, "ESPERANDO_AUTORIZACION");
      const ok = await cambiarEstado(tx, d, "AUTORIZADA", yo.id, undefined, { aprobadaPorId: yo.id, aprobadaEn: new Date(), motivoRechazo: null });
      if (!ok) throw new ErrorNegocio("La orden cambió. Actualizá la pantalla.");
      const numero = nombreDoc(d);
      await notificarEvento(EVENTO.materialAprobado({ ...deDocumento(d), oc: numero, enPapel: false, compradorId: d.tomadoPorId }), { tx, actor: yo.id });
      await notificarEvento(EVENTO.ocAFacturar({ ...deDocumento(d), numero }), { tx, actor: yo.id });
      await auditar(tx, { usuarioId: yo.id, accion: "oc.aprobar", entidadId: ocId, resumen: `${yo.nombre} autorizó ${describir(d)}`, antes: { estado: "ESPERANDO_AUTORIZACION" }, despues: { estado: "AUTORIZADA" } });
    });
    await guardarPDF(ocId, true);
    refrescar();
    return null;
  });
}

/** Deshacer la autorización (10 s en pantalla, 2 min de margen) mientras no se encargó ni habilitó. */
export async function deshacerAprobacion(ocId: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    await db.$transaction(async (tx) => {
      const d = await docConAcceso(tx, ocId, yo);
      if (d.estado !== "AUTORIZADA" || d.aprobadaPorId !== yo.id || !d.aprobadaEn || Date.now() - d.aprobadaEn.getTime() > 120_000) throw new ErrorNegocio("Ya no se puede deshacer.");
      await cambiarEstado(tx, d, "ESPERANDO_AUTORIZACION", yo.id, "Se deshizo la autorización", { aprobadaPorId: null, aprobadaEn: null, pdfAprobadaUrl: null });
      await auditar(tx, { usuarioId: yo.id, accion: "oc.deshacerAprobacion", entidadId: ocId, resumen: `${yo.nombre} deshizo la autorización de ${describir(d)}`, antes: { estado: "AUTORIZADA" }, despues: { estado: "ESPERANDO_AUTORIZACION" } });
    });
    refrescar();
    return null;
  });
}

/** Rechazar: vuelve a EN_COMPRAS con el motivo (arriba de la plantilla); al reenviarla, mismo número y versión nueva. */
export async function rechazarDocumento(ocId: string, motivo: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    if (yo.rol !== "DIRECCION") throw new ErrorNegocio("Solo el dueño rechaza las órdenes de compra.");
    const m = motivo.trim();
    if (m.length < 3) throw new ErrorNegocio("Contá por qué se rechaza.");
    await db.$transaction(async (tx) => {
      const d = await docConAcceso(tx, ocId, yo);
      exigirEstado(d, "ESPERANDO_AUTORIZACION");
      const ok = await cambiarEstado(tx, d, "EN_COMPRAS", yo.id, `Rechazada: ${m}`, { motivoRechazo: m.slice(0, 1000), rechazadaEn: new Date() });
      if (!ok) throw new ErrorNegocio("La orden cambió. Actualizá la pantalla.");
      await notificarEvento(EVENTO.materialRechazado({ ...deDocumento(d), oc: nombreDoc(d), motivo: m, compradorId: d.tomadoPorId }), { tx, actor: yo.id });
      await auditar(tx, { usuarioId: yo.id, accion: "oc.rechazar", entidadId: ocId, resumen: `${yo.nombre} rechazó ${describir(d)}: ${m}`, antes: { estado: "ESPERANDO_AUTORIZACION" }, despues: { estado: "EN_COMPRAS", motivo: m } });
    });
    refrescar();
    return null;
  });
}

// ═══════════════════════════ Compras: encargada, presupuesto ═══════════════════════════

/** "Marcar como encargada": la autorizada ya se le pidió al proveedor. */
export async function marcarEncargada(ocId: string, encargada: boolean): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    if (yo.rol !== "COMPRAS" && yo.rol !== "DIRECCION") throw new ErrorNegocio("Lo marca Compras.");
    await db.$transaction(async (tx) => {
      const d = await docConAcceso(tx, ocId, yo);
      if (encargada) {
        exigirEstado(d, "AUTORIZADA");
        await cambiarEstado(tx, d, "ENCARGADA", yo.id, d.proveedor ? `A ${d.proveedor.nombre}` : undefined, { encargadaEn: new Date() });
      } else {
        exigirEstado(d, "ENCARGADA");
        await cambiarEstado(tx, d, "AUTORIZADA", yo.id, "Desmarcó encargada", { encargadaEn: null });
      }
      await auditar(tx, { usuarioId: yo.id, accion: "oc.encargar", entidadId: ocId, resumen: encargada ? `${yo.nombre} encargó al proveedor ${describir(d)}` : `${yo.nombre} desmarcó "encargada" en ${describir(d)}` });
    });
    refrescar();
    return null;
  });
}

/** "Pedí presupuesto" (Compras): en el tablero queda como Solicitud de presupuesto mientras la arma. */
export async function marcarPresupuestoSolicitado(ocId: string, si: boolean): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    if (yo.rol !== "COMPRAS" && yo.rol !== "DIRECCION") throw new ErrorNegocio("Lo marca Compras.");
    await db.$transaction(async (tx) => {
      const d = await docConAcceso(tx, ocId, yo);
      exigirEstado(d, "ENVIADA_A_COMPRAS", "EN_COMPRAS");
      await tx.ordenCompra.update({ where: { id: ocId }, data: { presupuestoSolicitado: si } });
      await sincronizarTablero(tx, ocId);
      await auditar(tx, { usuarioId: yo.id, accion: "oc.presupuesto", entidadId: ocId, resumen: si ? `${yo.nombre} pidió presupuesto para ${describir(d)}` : `${yo.nombre} desmarcó "presupuesto pedido" en ${describir(d)}` });
    });
    refrescar();
    return null;
  });
}

// ═══════════════════════════ 4. Orden de pago ═══════════════════════════

/** Administración pide la autorización del pago (con la facturación completa). */
export async function pedirAutorizacionPago(ocId: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    if (yo.rol !== "ADMINISTRACION" && yo.rol !== "DIRECCION") throw new ErrorNegocio("Lo pide Administración.");
    await db.$transaction(async (tx) => {
      const d = await docConAcceso(tx, ocId, yo);
      if (!["AUTORIZADA", "ENCARGADA", "HABILITADA", "ENTREGADA"].includes(d.estado)) throw new ErrorNegocio("Primero el dueño tiene que autorizar la orden.");
      if (d.ordenPagoAutorizadaEn) throw new ErrorNegocio("El pago ya está autorizado.");
      const falta = textoFaltan(faltan("facturar", valoresDe(d)));
      if (falta) throw new ErrorNegocio(falta);
      await tx.ordenCompra.update({ where: { id: ocId }, data: { pagoSolicitadoPorId: yo.id, pagoSolicitadoEn: new Date() } });
      await tx.cambioEstadoOC.create({ data: { ordenCompraId: ocId, de: d.estado, a: d.estado, usuarioId: yo.id, nota: "Pidió autorizar el pago" } });
      const t = textosDe(d);
      await notificarEvento(EVENTO.pagoParaAutorizar({ ...deDocumento(d), numero: nombreDoc(d), quien: yo.nombre, importe: t.facturaImporte || t.importe || null, proveedorFinal: t.proveedorFinal || null }), { tx, actor: yo.id });
      await auditar(tx, { usuarioId: yo.id, accion: "oc.pago.pedir", entidadId: ocId, resumen: `${yo.nombre} pidió autorizar el pago de ${describir(d)}` });
    });
    refrescar();
    return null;
  });
}

/** El dueño autoriza la orden de pago (sección 4). */
export async function autorizarPago(ocId: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    if (yo.rol !== "DIRECCION") throw new ErrorNegocio("Solo el dueño autoriza la orden de pago.");
    await db.$transaction(async (tx) => {
      const d = await docConAcceso(tx, ocId, yo);
      if (d.ordenPagoAutorizadaEn) throw new ErrorNegocio("Ya estaba autorizada.");
      if (!["AUTORIZADA", "ENCARGADA", "HABILITADA", "ENTREGADA"].includes(d.estado)) throw new ErrorNegocio("Primero hay que autorizar la orden.");
      await tx.ordenCompra.update({ where: { id: ocId }, data: { ordenPagoAutorizadaPorId: yo.id, ordenPagoAutorizadaEn: new Date(), estadoPago: d.fechaPago ? "PAGADO" : "AUTORIZADO" } });
      await tx.cambioEstadoOC.create({ data: { ordenCompraId: ocId, de: d.estado, a: d.estado, usuarioId: yo.id, nota: "Autorizó el pago" } });
      await notificarEvento(EVENTO.pagoAutorizado({ ...deDocumento(d), numero: nombreDoc(d), quien: yo.nombre }), { tx, actor: yo.id });
      await auditar(tx, { usuarioId: yo.id, accion: "oc.pago.autorizar", entidadId: ocId, resumen: `${yo.nombre} autorizó el pago de ${describir(d)}` });
    });
    await guardarPDF(ocId, true);
    refrescar();
    return null;
  });
}

// ═══════════════════════════ Documento compartido ═══════════════════════════

/** Presencia: "Alejandra, Camila están viendo". Se renueva cada 20 s mientras la plantilla está abierta. */
export async function latido(ocId: string): Promise<Resultado<{ viendo: { id: string; nombre: string }[] }>> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    await db.presenciaDocumento.upsert({ where: { ordenCompraId_usuarioId: { ordenCompraId: ocId, usuarioId: yo.id } }, create: { ordenCompraId: ocId, usuarioId: yo.id }, update: { vistoEn: new Date() } });
    const otros = await db.presenciaDocumento.findMany({ where: { ordenCompraId: ocId, usuarioId: { not: yo.id }, vistoEn: { gte: new Date(Date.now() - 45_000) } }, include: { usuario: { select: { id: true, nombre: true } } }, orderBy: { vistoEn: "desc" } });
    return { viendo: otros.map((o) => o.usuario) };
  });
}

/** Lo que trae la plantilla cuando otro cambió algo (tiempo real): valores, versiones y estado. */
export async function leerDocumentoVivo(ocId: string): Promise<Resultado<{ valores: Record<string, string>; textos: Record<string, string>; versiones: Record<string, number>; estado: string; version: number }>> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    const d = await docConAcceso(db as unknown as Tx, ocId, yo);
    return { valores: valoresDe(d), textos: textosDe(d), versiones: (d.versionesCeldas as Record<string, number>) ?? {}, estado: d.estado, version: d.version };
  });
}

/** Historial de cambios por celda (panel "Cambios"). */
export async function historialCeldas(ocId: string): Promise<Resultado<{ celda: string; etiqueta: string; anterior: string | null; nuevo: string | null; quien: string; fecha: string }[]>> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    await docConAcceso(db as unknown as Tx, ocId, yo);
    const c = await db.cambioCelda.findMany({ where: { ordenCompraId: ocId }, orderBy: { fecha: "desc" }, take: 200, include: { usuario: { select: { nombre: true } } } });
    return c.map((x) => ({ celda: x.celda, etiqueta: esCelda(x.celda) ? CELDAS[x.celda].etiqueta : x.celda, anterior: x.anterior, nuevo: x.nuevo, quien: x.usuario.nombre, fecha: x.fecha.toISOString() }));
  });
}

/** Adjuntos del documento (lista de materiales, presupuestos). Los de Compras pueden ser internos. */
export async function adjuntarADocumento(ocId: string, adjuntoIds: string[], interno = false): Promise<Resultado<{ cantidad: number }>> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    const n = await db.$transaction(async (tx) => {
      const d = await docConAcceso(tx, ocId, yo);
      if (d.estado === "ANULADA") throw new ErrorNegocio("La orden está anulada.");
      const n = await engancharAdjuntos(tx, adjuntoIds, "ORDEN_COMPRA", ocId, yo.id);
      if (n && interno && (yo.rol === "COMPRAS" || yo.rol === "DIRECCION")) await tx.adjunto.updateMany({ where: { id: { in: adjuntoIds }, entidadId: ocId }, data: { interno: true } });
      if (n) await auditar(tx, { usuarioId: yo.id, accion: "oc.adjuntar", entidadId: ocId, resumen: `${yo.nombre} adjuntó ${n} ${n === 1 ? "archivo" : "archivos"} a ${describir(d)}` });
      return n;
    });
    refrescar();
    return { cantidad: n };
  });
}

/** Notas internas de Compras (quien pidió no las ve). */
export async function guardarNotasInternas(ocId: string, notas: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    if (yo.rol !== "COMPRAS" && yo.rol !== "DIRECCION") throw new ErrorNegocio("Las notas internas son de Compras.");
    await db.$transaction(async (tx) => {
      const d = await docConAcceso(tx, ocId, yo);
      await tx.ordenCompra.update({ where: { id: ocId }, data: { notasInternas: notas.trim().slice(0, 3000) || null } });
      await auditar(tx, { usuarioId: yo.id, accion: "oc.notasInternas", entidadId: ocId, resumen: `${yo.nombre} actualizó las notas internas de ${describir(d)}` });
    });
    revalidar("materiales");
    return null;
  });
}
