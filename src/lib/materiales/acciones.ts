"use server";

import { precargaMaterial } from "@/lib/historial/consultas";
import { engancharAdjuntos } from "@/lib/archivos";
import { z } from "zod";
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
import { aFecha, diaISO, fecha } from "@/lib/formato";
import { nombreSucursal, resolverPuntos, sucursalDe } from "@/lib/pedidos/puntos";
import { describirPedido, necesitaCamion } from "@/lib/pedidos/reglas";
import { avisarSolicitudNueva } from "@/lib/pedidos/avisos";
import { FRANJA } from "@/lib/pedidos/presentacion";
import { estadoInicial, fuenteDe } from "@/lib/compras/documento";
import { cambiarEstado, recalcular } from "./circuito";
import { auditar, deDocumento, describir, documentoOError } from "./comun";


const refrescar = () => {
  revalidar("materiales", "pedidos");
  reevaluar("materiales", "pedidos");
};
const vacio = (v: unknown) => (v === "" || v === null ? undefined : v);
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;


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
    // "Repetir": el pedido de origen y sus adjuntos que se copian como referencia (sin volver a subirlos).
    repiteDe: z.preprocess(vacio, z.string().optional()),
    adjuntosRepetidos: z.array(z.string()).max(20).default([]),
  })
  .superRefine((d, ctx) => {
    if (!d.renglones.length && !d.adjuntos.length && !d.adjuntosRepetidos.length) ctx.addIssue({ code: "custom", message: "Escribí qué necesitás o adjuntá la lista de materiales." });
  });
export type DatosPedirMateriales = z.input<typeof esquemaPedir>;

/** "40 bolsas cemento" a partir de un renglón. */
const textoRenglon = (r: { descripcion: string; cantidad?: number; unidad?: string }) =>
  r.cantidad ? `${r.cantidad.toLocaleString("es-AR")}${r.unidad ? ` ${r.unidad}` : ""} ${r.descripcion}` : r.descripcion;

/**
 * "Pedir materiales" (rápido): obra, detalle (texto o adjuntos), observaciones, para cuándo y prioridad.
 * Crea el documento (OC) con esas celdas y lo ENVÍA A COMPRAS en el acto (Compras o el dueño lo cargan
 * directo en Compras).
 */
export async function pedirMateriales(entrada: DatosPedirMateriales): Promise<Resultado<{ id: string; numero: number }>> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    const comoCompras = puede(yo.rol, "materiales.gestionar") && !!entrada.solicitanteId;
    if (!puede(yo.rol, "materiales.pedir") && !comoCompras) throw new ErrorNegocio("No tenés permiso para pedir materiales.");
    const d = esquemaPedir.parse(entrada);
    if (d.dia < diaISO()) throw new ErrorNegocio("El día ya pasó. Elegí hoy o una fecha futura.");

    const obra = await db.obra.findUnique({ where: { id: d.obraId }, select: { id: true, nombre: true, estado: true, razonSocialId: true, sedes: { where: { activa: true }, select: { id: true, nombre: true } } } });
    if (!obra || obra.estado !== "ACTIVA") throw new ErrorNegocio("Esa obra no está activa.");
    if (!comoCompras && !(await esObraDelUsuario(yo, obra.id))) throw new ErrorNegocio(`No sos responsable de Obra ${obra.nombre}.`);
    const sede = d.obraSedeId ? obra.sedes.find((x) => x.id === d.obraSedeId) : null;
    if (d.obraSedeId && !sede) throw new ErrorNegocio("Esa sede no es de la obra.");
    if (obra.sedes.length > 1 && !sede) throw new ErrorNegocio(`Obra ${obra.nombre} tiene varias sedes: elegí para cuál es.`);
    const solicitante = comoCompras ? await db.usuario.findFirst({ where: { id: d.solicitanteId, activo: true }, select: { id: true, nombre: true } }) : { id: yo.id, nombre: yo.nombre };
    if (!solicitante) throw new ErrorNegocio("Elegí quién lo pidió.");

    // Los archivos tienen que ser de esta persona, recién subidos y sin enganchar.
    const encontrados = d.adjuntos.length ? await db.adjunto.findMany({ where: { id: { in: d.adjuntos }, subidoPorId: yo.id, entidadTipo: "ORDEN_COMPRA", entidadId: null }, select: { id: true, nombre: true, tipoMime: true } }) : [];
    // En el orden en que se adjuntaron, con las planillas y los PDF antes que las fotos (la descripción nombra el primero).
    const adjuntos = [...encontrados].sort((a, b) => Number(a.tipoMime.startsWith("image/")) - Number(b.tipoMime.startsWith("image/")) || d.adjuntos.indexOf(a.id) - d.adjuntos.indexOf(b.id));
    if (adjuntos.length !== d.adjuntos.length) throw new ErrorNegocio("Algún archivo no se terminó de subir. Quitalo y adjuntalo de nuevo.");
    // Repetir: el pedido de origen tiene que ser uno que puede ver; sus adjuntos se copian como referencia.
    const origen = d.repiteDe ? await precargaMaterial(d.repiteDe, comoCompras) : null;
    if (d.repiteDe && !origen) throw new ErrorNegocio("El pedido que querés repetir ya no está disponible.");
    const repetidos = origen ? await db.adjunto.findMany({ where: { id: { in: d.adjuntosRepetidos }, entidadTipo: "ORDEN_COMPRA", entidadId: origen.origen.id, interno: false } }) : [];
    if (repetidos.length !== d.adjuntosRepetidos.length) throw new ErrorNegocio("Algún archivo del pedido anterior ya no está. Quitalo y volvé a intentar.");
    const todos = [...adjuntos, ...repetidos];
    if (!d.renglones.length && !todos.length) throw new ErrorNegocio("Escribí qué necesitás o adjuntá la lista de materiales.");

    const lineas = d.renglones.map(textoRenglon);
    const detalle = lineas.length
      ? lineas.join("\n")
      : `Ver lista adjunta (${todos[0].nombre}${todos.length > 1 ? ` y ${todos.length - 1} más` : ""})`;
    // Compras o el dueño lo cargan directo en Compras; el resto lo envía a Compras.
    const estado = estadoInicial(yo.rol, true);
    const observaciones = [comoCompras ? `Lo cargó ${yo.nombre} (Compras) por pedido de ${solicitante.nombre}.` : null, d.observaciones].filter(Boolean).join(" ") || null;
    const empresa = obra.razonSocialId ?? (await db.razonSocial.findFirst({ where: { activa: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }], select: { id: true } }))?.id ?? null;
    const p = await db.$transaction(async (tx) => {
      const p = await tx.ordenCompra.create({
        data: {
          tipo: "OC", estado, fuente: fuenteDe(yo.rol), creadaPorId: yo.id, fecha: aFecha(diaISO(), "12:00"), empresaCompraId: empresa,
          obraId: obra.id, obraSedeId: sede?.id ?? null, solicitanteId: solicitante.id, detallePedido: detalle, fechaNecesaria: aFecha(d.dia, "12:00"),
          prioridad: d.prioridad, observacionesSolicitante: observaciones, enviadaAComprasEn: new Date(),
          ...(yo.rol === "COMPRAS" ? { tomadoPorId: yo.id, tomadoEn: new Date() } : {}),
          renglones: d.renglones.length ? { create: d.renglones.map((r, i) => ({ orden: i + 1, descripcion: r.descripcion, cantidad: r.cantidad ?? 1, unidad: r.unidad ?? "u" })) } : undefined,
          // Para que Compras cotice igual y más rápido: con quién se compró la vez anterior (nota interna).
          notasInternas: origen ? `Repite el pedido #${origen.origen.numero}.${origen.origen.oc ? ` La vez anterior lo compró ${origen.origen.oc.proveedor}, ${origen.origen.oc.numero}.` : ""}` : null,
          cambios: { create: { de: null, a: estado, usuarioId: yo.id, nota: comoCompras ? `Cargado por Compras a pedido de ${solicitante.nombre}` : "Pedir materiales" } },
        },
        select: { id: true, numeroInterno: true },
      });
      await engancharAdjuntos(tx, adjuntos.map((a) => a.id), "ORDEN_COMPRA", p.id, yo.id);
      if (repetidos.length) {
        await tx.adjunto.createMany({
          data: repetidos.map((a) => ({ entidadTipo: "ORDEN_COMPRA" as const, entidadId: p.id, nombre: a.nombre, url: a.url, tipoMime: a.tipoMime, tamanoBytes: a.tamanoBytes, subidoPorId: yo.id, referenciaDe: `del pedido #${origen!.origen.numero}` })),
        });
      }
      await auditar(tx, {
        usuarioId: yo.id, accion: "material.pedir", entidadId: p.id,
        resumen: `${yo.nombre} pidió a Compras ${queLleva(detalle)}${lineas.length > 1 ? ` y ${lineas.length - 1} más` : ""} para Obra ${obra.nombre}${sede ? ` (${sede.nombre})` : ""}${todos.length ? ` con ${todos.length} ${todos.length === 1 ? "archivo adjunto" : "archivos adjuntos"}` : ""}${d.prioridad === "URGENTE" ? " (urgente)" : ""}${comoCompras ? ` a nombre de ${solicitante.nombre}` : ""}${origen ? ` (repite el pedido #${origen.origen.numero})` : ""}`,
        despues: { estado, renglones: d.renglones, adjuntos: adjuntos.map((a) => a.nombre), dia: d.dia, prioridad: d.prioridad, observaciones: d.observaciones ?? null },
      });
      // A Compras (push) y al dueño (bandeja). Si lo cargó Compras, no se avisa a sí mismo.
      if (estado === "ENVIADA_A_COMPRAS") {
        await notificarEvento(EVENTO.materialNuevo({
          ordenCompraId: p.id, solicitanteId: solicitante.id, obraId: obra.id, obra: obra.nombre, quien: solicitante.nombre, para: aFecha(d.dia, "12:00"), urgente: d.prioridad === "URGENTE",
          que: lineas.length ? detalle : `materiales (lista adjunta: ${todos[0].nombre})`,
          observaciones: d.observaciones ?? null, adjuntos: todos.length,
        }), { tx, actor: yo.id });
      }
      return p;
    });
    refrescar();
    return { id: p.id, numero: p.numeroInterno };
  });
}

/** "Deshacer" justo después de pedir (10 s en pantalla, 2 min de margen): queda anulado. */
export async function deshacerPedidoMaterial(id: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    await db.$transaction(async (tx) => {
      const p = await documentoOError(tx, id);
      if (!["ENVIADA_A_COMPRAS", "EN_COMPRAS"].includes(p.estado) || p.creadaPorId !== yo.id || Date.now() - p.creadoEn.getTime() > 120_000) throw new ErrorNegocio("Ya no se puede deshacer.");
      await cambiarEstado(tx, p, "ANULADA", yo.id, "Se deshizo al pedirlo", { motivoAnulacion: "Se deshizo al pedirlo" });
      await auditar(tx, { usuarioId: yo.id, accion: "material.deshacer", entidadId: id, resumen: `${yo.nombre} deshizo ${describir(p)}`, antes: { estado: p.estado }, despues: { estado: "ANULADA" } });
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

/**
 * "Habilitar para retirar" (Compras, desde la barra de la orden autorizada): crea el MaterialListo (sucursal
 * confirmada, horario, contacto, qué parte, peso, retira chofer o entrega el proveedor), la orden pasa a
 * HABILITADA y al que pidió le llega "Listo para retirar" con "Pedir el viaje". Se puede habilitar en partes.
 */
export async function habilitarRetiro(entrada: DatosHabilitar): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("materiales.gestionar");
    const d = esquemaHabilitar.parse(entrada);
    await db.$transaction(async (tx) => {
      const p = await documentoOError(tx, d.id);
      if (!["AUTORIZADA", "ENCARGADA", "HABILITADA"].includes(p.estado)) {
        throw new ErrorNegocio(p.estado === "ESPERANDO_AUTORIZACION" ? "Falta la autorización del dueño." : "Esta orden no está para habilitar.");
      }
      if (!p.obraId) throw new ErrorNegocio("La orden no tiene obra.");
      if (p.completo) throw new ErrorNegocio("Ya se habilitó todo de esta orden.");
      const suc = await sucursalDe(tx, d.sucursalId ?? d.proveedorId);
      if (!suc || suc.proveedorId !== d.proveedorId) throw new ErrorNegocio("Elegí la sucursal del proveedor donde se retira.");
      if (!Number.isFinite(suc.latitud) || !Number.isFinite(suc.longitud)) throw new ErrorNegocio("Esa sucursal no tiene ubicación en el mapa. Cargala de nuevo con la dirección.");
      const prov = { id: suc.proveedorId, nombre: nombreSucursal(suc) };
      const max = (await tx.vehiculo.aggregate({ where: { activo: true }, _max: { capacidadCargaKg: true } }))._max.capacidadCargaKg ?? 0;
      if (d.modo === "RETIRA_CHOFER" && d.pesoKg > max) throw new ErrorNegocio(`Ningún vehículo carga más de ${max.toLocaleString("es-AR")} kg. Habilitalo en dos partes.`);

      const ml = await tx.materialListo.create({
        data: {
          ordenCompraId: p.id, obraId: p.obraId, proveedorId: prov.id, sucursalId: suc.id, proveedorDireccion: `${suc.direccion}, ${suc.localidad}`, proveedorLat: suc.latitud, proveedorLng: suc.longitud,
          horarioRetiro: d.horario ?? suc.horarioRetiro ?? null, contactoRetiro: d.contacto ?? suc.contacto ?? null, renglones: d.renglones?.length ? d.renglones : undefined, ordenCompraNumero: d.ordenCompra ?? p.numero, descripcion: d.descripcion,
          pesoKg: d.pesoKg, necesitaCamion: necesitaCamion("RETIRO_PROVEEDOR", d.pesoKg), modoEntrega: d.modo,
          fechaEntregaEstimada: d.fechaEstimada ? aFecha(d.fechaEstimada, "12:00") : null,
          // Lo entrega el proveedor: ya viene en camino, no hace falta viaje.
          estado: d.modo === "ENTREGA_PROVEEDOR" ? "EN_CAMINO" : "LISTO", habilitadoPorId: yo.id,
        },
      });
      if (d.completo) await tx.ordenCompra.update({ where: { id: p.id }, data: { completo: true } });
      await recalcular(tx, p.id, yo.id, `${d.descripcion} · ${prov.nombre}${d.completo ? " · No falta nada" : ""}`);

      // Al que pidió y a los demás responsables de la obra (push, con "Pedir el viaje"); a Compras, bandeja.
      await notificarEvento(EVENTO.materialHabilitado({
        ...deDocumento(p), materialListoId: ml.id, que: d.descripcion, proveedor: prov.nombre, horario: d.horario ?? ml.horarioRetiro ?? null,
        entregaProveedor: d.modo === "ENTREGA_PROVEEDOR", cuando: d.fechaEstimada ? `el ${fecha(aFecha(d.fechaEstimada, "12:00"))}` : null,
      }), { tx, actor: yo.id });
      await auditar(tx, {
        usuarioId: yo.id, accion: "material.habilitar", entidadId: p.id,
        resumen: `${yo.nombre} habilitó ${queLleva(d.descripcion)} en ${prov.nombre} para Obra ${p.obra?.nombre ?? ""}${d.modo === "ENTREGA_PROVEEDOR" ? " (lo entrega el proveedor)" : ""}${d.completo ? "; no falta nada" : ""}`,
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
      const ml = await tx.materialListo.findUnique({ where: { id: materialListoId }, include: { proveedor: { select: { nombre: true } }, ordenCompra: { include: { obra: { select: { nombre: true } } } } } });
      if (!ml || ml.modoEntrega !== "ENTREGA_PROVEEDOR") throw new ErrorNegocio("No existe esa entrega.");
      const gestiona = puede(yo.rol, "materiales.gestionar");
      if (!gestiona && !(puede(yo.rol, "materiales.pedir") && (await esObraDelUsuario(yo, ml.obraId)))) throw new ErrorNegocio("No es de tus obras.");
      const r = await tx.materialListo.updateMany({ where: { id: ml.id, estado: "EN_CAMINO" }, data: { estado: "ENTREGADO", entregadoEn: new Date() } });
      if (!r.count) throw new ErrorNegocio("Ya estaba marcado.");
      const cambio = await recalcular(tx, ml.ordenCompraId, yo.id, `Recibido en obra: ${ml.descripcion}`);
      await notificarEvento(EVENTO.materialEntregado({ ...deDocumento(ml.ordenCompra), que: ml.descripcion, completo: cambio?.a === "ENTREGADA" }), { tx, actor: yo.id });
      await auditar(tx, { usuarioId: yo.id, accion: "material.recibido", entidadId: ml.ordenCompraId, resumen: `${yo.nombre} recibió en Obra ${ml.ordenCompra.obra?.nombre ?? ""} ${queLleva(ml.descripcion)} que entregó ${ml.proveedor.nombre}` });
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
  // Compras coordina el retiro para alguien de obra: el pedido de viaje queda a su nombre.
  paraUsuarioId: z.preprocess(vacio, z.string().optional()),
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
    const d = esquemaRetiro.parse(entrada);
    const yo = await exigirPermiso(d.paraUsuarioId ? "pedidos.coordinar" : "pedidos.crear");
    const para = d.paraUsuarioId ? await db.usuario.findUnique({ where: { id: d.paraUsuarioId }, select: { id: true, nombre: true, rol: true, activo: true } }) : null;
    if (d.paraUsuarioId && (!para?.activo || !["RESPONSABLE_OBRA", "CAPATAZ", "DIRECCION"].includes(para.rol))) throw new ErrorNegocio("Elegí para quién es el viaje (un responsable de la obra).");
    const solicitante = para ?? yo;
    if (d.franja === "HORA_EXACTA" && !d.hora) throw new ErrorNegocio("Poné la hora.");
    if (d.dia < diaISO()) throw new ErrorNegocio("El día ya pasó. Elegí hoy o una fecha futura.");
    const obra = await db.obra.findUnique({ where: { id: d.obraId }, select: { id: true, nombre: true, estado: true } });
    if (!obra || obra.estado !== "ACTIVA") throw new ErrorNegocio("Esa obra no está activa.");
    if (!(await esObraDelUsuario(solicitante, obra.id))) throw new ErrorNegocio(para ? `${para.nombre} no es responsable de Obra ${obra.nombre}.` : `No sos responsable de Obra ${obra.nombre}.`);
    const paraCuando = aFecha(d.dia, d.franja === "HORA_EXACTA" ? d.hora! : FRANJA[d.franja].hora);
    const max = (await db.vehiculo.aggregate({ where: { activo: true }, _max: { capacidadCargaKg: true } }))._max.capacidadCargaKg ?? 0;

    const creados = await db.$transaction(async (tx) => {
      const ml = await tx.materialListo.findMany({ where: { id: { in: d.materiales } }, include: { ordenCompra: { select: { obraSedeId: true } }, proveedor: { select: { nombre: true } }, pedidoViaje: { select: { id: true, estado: true } } } });
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
        const sede = grupo.map((m) => m.ordenCompra.obraSedeId).find(Boolean) ?? null;
        const puntos = await resolverPuntos(tx, { origenTipo: "PROVEEDOR", origenId: sucursalId, obraId: obra.id, destinoSedeId: sede });
        const primero = grupo[0];
        const proveedorId = primero.proveedorId;
        const p = await tx.pedidoViaje.create({
          data: {
            solicitanteId: solicitante.id, coordinadoPorId: para ? yo.id : null, obraId: obra.id, tipo: "RETIRO_PROVEEDOR", origenTipo: "PROVEEDOR", esRetiroMaterial: true,
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
        for (const ocId of new Set(grupo.map((m) => m.ordenCompraId))) {
          await recalcular(tx, ocId, yo.id, `Viaje #${p.numero} pedido`);
          const oc = await tx.ordenCompra.findUniqueOrThrow({ where: { id: ocId }, include: { obra: { select: { nombre: true } } } });
          await notificarEvento(EVENTO.materialRetiroPedido({ ...deDocumento(oc), quien: yo.nombre, proveedor: primero.proveedor.nombre }), { tx, actor: yo.id });
        }
        await auditarBase(tx, {
          usuarioId: yo.id, accion: "pedido.crear", entidad: "PedidoViaje", entidadId: p.id,
          resumen: `${yo.nombre} ${para ? `coordinó para ${para.nombre}` : "pidió"} el retiro en ${primero.proveedor.nombre} de ${grupo.map((m) => queLleva(m.descripcion)).join(" + ")} para Obra ${obra.nombre}${d.prioridad === "URGENTE" ? " (urgente)" : ""}`,
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
        const ocs = await tx.materialListo.findMany({ where: { pedidoViajeId: id }, select: { ordenCompraId: true } });
        for (const ocId of new Set(ocs.map((m) => m.ordenCompraId))) await recalcular(tx, ocId, yo.id, "Se deshizo el pedido del viaje");
        await auditarBase(tx, { usuarioId: yo.id, accion: "pedido.deshacer", entidad: "PedidoViaje", entidadId: id, resumen: `${yo.nombre} deshizo ${await describirPedido(tx, id)}`, antes: { estado: "PENDIENTE" }, despues: { estado: "CANCELADO" } });
      }
    });
    refrescar();
    return null;
  });
}
