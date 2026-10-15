import "server-only";
import type { Rol } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirSesion } from "@/lib/auth/sesion";
import { adjuntosDe } from "@/lib/archivos";
import { proveedoresConSucursales } from "@/lib/proveedores/consultas";
import { filtroObras } from "@/lib/alcance";
import { lineaARenglon } from "./renglones";
import { contextoCeldas, puedeVerDocumento } from "./acceso";
import { celdasEditables, pasoSiguiente } from "./permisosCeldas";
import { incluirDocumento, textosDe, valoresDe } from "./celdas";
import { hojaDe } from "./hoja";
import { ESTADO_DOC, fraseDocumento, nombreDoc } from "./documento";
import { CONDICION_PAGO, FORMA_PAGO } from "./estados";

const fechaLarga = (d: Date) => new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "numeric" }).format(d);

/** Las listas de los selectores de la plantilla (la gente de obra elige entre sus obras). */
async function listasPlantilla(u: { id: string; rol: Rol }) {
  const [razones, obras, usuarios, externos, proveedores] = await Promise.all([
    db.razonSocial.findMany({ where: { activa: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }], select: { id: true, nombre: true, cuit: true } }),
    db.obra.findMany({ where: { estado: { not: "FINALIZADA" }, ...filtroObras(u) }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, latitud: true, longitud: true, sedes: { where: { activa: true }, select: { id: true, nombre: true } } } }),
    db.usuario.findMany({ where: { activo: true, rol: { in: ["RESPONSABLE_OBRA", "CAPATAZ", "DIRECCION", "COMPRAS", "ADMINISTRACION"] } }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, rol: true } }),
    db.solicitanteExterno.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    proveedoresConSucursales(),
  ]);
  return {
    razones,
    obras: obras.map((o) => ({ id: o.id, nombre: o.nombre, destino: { lat: o.latitud, lng: o.longitud }, sedes: o.sedes })),
    personas: [
      ...usuarios.map((x) => ({ valor: `u:${x.id}`, nombre: x.nombre, detalle: "usuario" })),
      ...externos.map((x) => ({ valor: `e:${x.id}`, nombre: x.nombre, detalle: "sin usuario" })),
    ].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    proveedores,
    formas: Object.entries(FORMA_PAGO).map(([valor, nombre]) => ({ valor, nombre })),
    condiciones: Object.entries(CONDICION_PAGO).map(([valor, nombre]) => ({ valor, nombre })),
  };
}
export type ListasPlantilla = Awaited<ReturnType<typeof listasPlantilla>>;

/**
 * Todo lo que necesita la plantilla de un documento (/compras/oc/[id]): valores y versiones de cada
 * celda, qué celdas edita quien mira (y cuáles con "Modificar"), qué acciones tiene, las listas de los
 * selectores, adjuntos, habilitaciones y la línea de tiempo. null si no existe o no la puede ver.
 */
export async function documentoParaPlantilla(id: string) {
  const u = await exigirSesion();
  const d = await db.ordenCompra.findUnique({
    where: { id },
    include: {
      ...incluirDocumento,
      cambios: { orderBy: { fecha: "asc" }, include: { usuario: { select: { nombre: true } } } },
      materialesListos: { orderBy: { habilitadoEn: "asc" }, include: { proveedor: { select: { nombre: true } }, sucursal: { select: { nombre: true } }, pedidoViaje: { select: { id: true, numero: true, estado: true, tomadoPor: { select: { nombre: true } } } } } },
    },
  });
  if (!d || !(await puedeVerDocumento(u, d))) return null;
  const ctx = await contextoCeldas(u, d);
  const editables = celdasEditables(ctx);
  const modificables = u.rol === "COMPRAS" && ["ESPERANDO_AUTORIZACION", "AUTORIZADA", "ENCARGADA", "HABILITADA"].includes(d.estado) ? celdasEditables({ ...ctx, modificar: true }).filter((c) => !editables.includes(c)) : [];
  const gestiona = u.rol === "COMPRAS" || u.rol === "DIRECCION";
  const esDeQuienPide = ctx.esCreador || ctx.esDeSuObra;
  const [listas, adjuntos, factura] = await Promise.all([
    listasPlantilla(u),
    adjuntosDe("ORDEN_COMPRA", id, gestiona),
    d.facturaAdjuntoId ? db.adjunto.findUnique({ where: { id: d.facturaAdjuntoId }, select: { id: true, nombre: true } }) : null,
  ]);
  const activas = d.materialesListos.filter((m) => m.estado !== "CANCELADO");
  const pendiente = activas.find((m) => m.estado !== "ENTREGADO");
  // La barra verde de la orden habilitada: dónde se retira (o cuándo lo trae el proveedor).
  const barraHabilitada = pendiente
    ? pendiente.modoEntrega === "ENTREGA_PROVEEDOR"
      ? `Entrega el proveedor${pendiente.fechaEntregaEstimada ? ` el ${fechaLarga(pendiente.fechaEntregaEstimada)}` : ""}`
      : `LISTO PARA RETIRAR en ${pendiente.proveedor.nombre}${pendiente.sucursal.nombre !== "Casa central" ? ` (${pendiente.sucursal.nombre})` : ""}${pendiente.horarioRetiro ? ` · ${pendiente.horarioRetiro}` : ""}`
    : null;
  const listoParaViaje = activas.find((m) => m.estado === "LISTO" && m.modoEntrega === "RETIRA_CHOFER");
  const e = d.estado;
  return {
    id: d.id, tipo: d.tipo, numeroInterno: d.numeroInterno, nombre: nombreDoc(d), estado: e, estadoTitulo: ESTADO_DOC[e].titulo, estadoTono: ESTADO_DOC[e].tono,
    frase: fraseDocumento(e, { proveedor: listoParaViaje?.proveedor.nombre, retiro: pendiente?.estado ?? null }),
    fuente: d.fuente, importada: d.fuente === "IMPORTADA",
    yo: { id: u.id, nombre: u.nombre, rol: u.rol },
    valores: valoresDe(d), textos: textosDe(d), versiones: (d.versionesCeldas as Record<string, number>) ?? {},
    editables, modificables, paso: pasoSiguiente(u.rol, e),
    hoja: hojaDe(d),
    motivoRechazo: e === "EN_COMPRAS" ? d.motivoRechazo : null,
    notaDevolucion: e === "BORRADOR" ? d.notaDevolucion : null,
    motivoAnulacion: e === "ANULADA" ? d.motivoAnulacion : null,
    acciones: {
      enviarACompras: e === "BORRADOR" && (esDeQuienPide || u.rol === "ADMINISTRACION" || u.rol === "DIRECCION"),
      enviarAAutorizacion: u.rol === "COMPRAS" && (e === "ENVIADA_A_COMPRAS" || e === "EN_COMPRAS"),
      devolver: gestiona && (e === "ENVIADA_A_COMPRAS" || e === "EN_COMPRAS") && !(d.creadaPor.rol === "COMPRAS" && !d.solicitanteId),
      anular: (gestiona && !["ANULADA", "ENTREGADA", "RECHAZADA"].includes(e)) || (esDeQuienPide && (e === "BORRADOR" || e === "ENVIADA_A_COMPRAS")),
      presupuesto: gestiona && (e === "ENVIADA_A_COMPRAS" || e === "EN_COMPRAS") ? d.presupuestoSolicitado : null,
      modificar: modificables.length > 0,
      aprobar: u.rol === "DIRECCION" && e === "ESPERANDO_AUTORIZACION",
      encargar: gestiona && e === "AUTORIZADA",
      desencargar: gestiona && e === "ENCARGADA",
      habilitar: gestiona && ["AUTORIZADA", "ENCARGADA", "HABILITADA"].includes(e) && !d.completo,
      pedirViaje: listoParaViaje && (u.rol === "RESPONSABLE_OBRA" || u.rol === "CAPATAZ" || u.rol === "DIRECCION") ? { obraId: d.obraId!, materialId: listoParaViaje.id } : null,
      pedirPago: (u.rol === "ADMINISTRACION" || u.rol === "DIRECCION") && ["AUTORIZADA", "ENCARGADA", "HABILITADA", "ENTREGADA"].includes(e) && !d.ordenPagoAutorizadaEn && !d.pagoSolicitadoEn,
      autorizarPago: u.rol === "DIRECCION" && ["AUTORIZADA", "ENCARGADA", "HABILITADA", "ENTREGADA"].includes(e) && !d.ordenPagoAutorizadaEn,
      pagoPedido: d.pagoSolicitadoEn ? `${d.pagoSolicitadoPor?.nombre ?? "Administración"} pidió autorizar el pago` : null,
    },
    barraHabilitada,
    listas,
    adjuntos,
    factura,
    notasInternas: gestiona ? d.notasInternas ?? "" : null,
    habilitaciones: d.materialesListos.map((m) => ({
      id: m.id, estado: m.estado, descripcion: m.descripcion, proveedor: m.proveedor.nombre, sucursal: m.sucursal.nombre, horario: m.horarioRetiro,
      modo: m.modoEntrega, entrega: m.fechaEntregaEstimada ? fechaLarga(m.fechaEntregaEstimada) : null, viaje: m.pedidoViaje ? { id: m.pedidoViaje.id, numero: m.pedidoViaje.numero, chofer: m.pedidoViaje.tomadoPor?.nombre ?? null } : null,
    })),
    // Para la hoja "Habilitar para retirar": lo de la orden autorizada viene cargado.
    habilitar: {
      proveedorId: d.proveedorId, sucursalId: d.sucursalId, numero: d.numero,
      renglones: (d.detallePedido ?? "").split("\n").map((l) => lineaARenglon(l)).filter((r): r is NonNullable<typeof r> => !!r).map((r) => ({ descripcion: r.descripcion, cantidad: r.cantidad ?? 1, unidad: r.unidad ?? "u" })),
      descripcion: d.detallePedido ?? "",
      destino: d.obraId ? listas.obras.find((o) => o.id === d.obraId)?.destino ?? null : null,
    },
    lineaDeTiempo: d.cambios.map((c) => ({ fecha: c.fecha.toISOString(), de: c.de, a: c.a, nota: c.nota, quien: c.usuario?.nombre ?? null })),
  };
}
export type DocumentoPlantilla = NonNullable<Awaited<ReturnType<typeof documentoParaPlantilla>>>;

/** Para la hoja impresa (con sesión o con el token de Chromium): solo la hoja. */
export async function hojaParaImprimir(id: string) {
  const d = await db.ordenCompra.findUnique({ where: { id }, include: incluirDocumento });
  return d ? hojaDe(d) : null;
}

/** /aprobaciones: cada orden esperando, con TODOS los datos escritos y sus adjuntos (las importadas, nunca). */
export async function paraAutorizar() {
  const u = await exigirSesion();
  if (u.rol !== "DIRECCION") throw new Error("Sin permiso");
  const ds = await db.ordenCompra.findMany({ where: { estado: "ESPERANDO_AUTORIZACION", fuente: { not: "IMPORTADA" } }, orderBy: { enviadaEn: "asc" }, include: incluirDocumento });
  return Promise.all(ds.map(async (d) => ({ id: d.id, nombre: nombreDoc(d), tipo: d.tipo, textos: textosDe(d), enviadaEn: d.enviadaEn?.toISOString() ?? null, prioridad: d.prioridad, observacionesSolicitante: d.observacionesSolicitante, adjuntos: await adjuntosDe("ORDEN_COMPRA", d.id, true), comprador: d.tomadoPor?.nombre ?? null })));
}

/** /aprobaciones, pestaña Pagos: lo que Administración pidió autorizar. */
export async function pagosParaAutorizar() {
  const u = await exigirSesion();
  if (u.rol !== "DIRECCION") throw new Error("Sin permiso");
  const ds = await db.ordenCompra.findMany({ where: { pagoSolicitadoEn: { not: null }, ordenPagoAutorizadaEn: null, estado: { not: "ANULADA" } }, orderBy: { pagoSolicitadoEn: "asc" }, include: incluirDocumento });
  return ds.map((d) => ({ id: d.id, nombre: nombreDoc(d), textos: textosDe(d), pedidoPor: d.pagoSolicitadoPor?.nombre ?? "Administración", pedidoEn: d.pagoSolicitadoEn!.toISOString(), facturaAdjuntoId: d.facturaAdjuntoId }));
}

