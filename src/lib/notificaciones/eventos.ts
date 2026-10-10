/**
 * MATRIZ DE AVISOS: el ÚNICO lugar con cada evento del sistema, quién lo recibe (push o solo
 * bandeja) y el texto. Las actions llaman a notificarEvento(EVENTO.x({...})) (enviar.ts).
 * Lo prueban los tests de src/lib/notificaciones/eventos.test.ts.
 *
 * Regla general (destinatarios.ts): nadie recibe un aviso de algo que no puede abrir, un
 * responsable de obra nunca recibe avisos de otra obra y quien hizo la acción no se avisa.
 *
 * ┌────────────────────────────┬──────────────────────────────────────────────────────────────┐
 * │ Evento                     │ Push                          │ Solo bandeja                  │
 * ├────────────────────────────┼───────────────────────────────┼───────────────────────────────┤
 * │ Solicitud nueva            │ choferes (si es urgente)      │ choferes (normal), Dirección  │
 * │ Aceptado/soltado/cancelado │ solicitante, chofer           │ Dirección                     │
 * │ Etapas del viaje           │ solicitante                   │ Dirección, Compras (material) │
 * │ Sin señal > 10 min         │ —                             │ solicitante, Dirección        │
 * │ Demora > 15 min            │ solicitante (una vez)         │ —                             │
 * │ Material nuevo             │ Compras                       │ Dirección                     │
 * │ Tomado / OC armada         │ —                             │ solicitante                   │
 * │ Esperando aprobación       │ Dirección                     │ —                             │
 * │ Aprobado / rechazado       │ Compras                       │ solicitante                   │
 * │ Habilitado                 │ solicitante, responsables obra│ Compras                       │
 * │ Retiro pedido              │ —                             │ Compras                       │
 * │ Material entregado         │ solicitante                   │ Compras                       │
 * │ Listo 3 días sin retirar   │ solicitante y responsables    │ Compras                       │
 * │ Material demorado          │ —                             │ Compras, Dirección            │
 * │ Aprobación demorada        │ Dirección                     │ —                             │
 * │ Herramienta duplicada      │ —                             │ el que pidió primero          │
 * │ Devolución vencida         │ —                             │ quien la tiene, Depósito, Dir.│
 * │ Documento/licencia x vencer│ — (vencido: todos con push)   │ Administración, Dir., chofer  │
 * └────────────────────────────┴───────────────────────────────┴───────────────────────────────┘
 */
import type { Rol, Severidad, TipoNotificacion } from "@prisma/client";
import type { Destinatario } from "./destinatarios";
import { queLleva, TEXTO, TEXTO_MATERIAL } from "./textos";
import { dia, hora, paraElDia } from "../formato";

export type Evento = {
  nombre: string;
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo: string;
  /** Enlace neutro: cada destinatario lo abre en su pantalla (destinatarios.ts → enlacePara). */
  enlace: string | null;
  /** Para colapsar dos avisos iguales en 60 s (mismo usuario, tipo y entidad). */
  entidad: string;
  /** Obra del evento: un responsable de otra obra nunca lo recibe. */
  obraId?: string | null;
  datos?: Record<string, unknown>;
  para: Destinatario[];
};

const push = true;
const bandeja = false;
const rol = (r: Rol, p: boolean, enlace?: string): Destinatario => ({ rol: r, push: p, enlace });
const usuario = (id: string | null | undefined, p: boolean, enlace?: string): Destinatario => ({ usuario: id, push: p, enlace });

// ═══════════════════════════════ Pedidos de viaje ═══════════════════════════════

/** Lo común de un pedido de viaje. Si retira material de Compras, pedidoMaterialId para el enlace de Compras. */
export type V = { pedidoId: string; numero?: number; solicitanteId: string; obraId: string; descripcion: string; destino: string; chofer: string; pedidoMaterialId?: string | null };

const enlacePedido = (id: string) => `/pedidos/${id}`;
/** Etapas del viaje: solicitante (push), Dirección (bandeja) y, si es material, Compras (bandeja). */
const etapaDelViaje = (v: V): Destinatario[] => [
  usuario(v.solicitanteId, push),
  rol("DIRECCION", bandeja),
  ...(v.pedidoMaterialId ? [rol("COMPRAS", bandeja, `/materiales/${v.pedidoMaterialId}`)] : []),
];

export const EVENTO = {
  solicitudNueva: (p: { pedidoId: string; obraId: string; quien: string; descripcion: string; destino: string; origen: string; paraCuando: Date; urgente: boolean }): Evento => ({
    nombre: "solicitud.nueva", tipo: p.urgente ? "SOLICITUD_URGENTE" : "NUEVA_SOLICITUD",
    ...(p.urgente
      ? TEXTO.urgente(p.quien, { descripcion: p.descripcion, destino: p.destino, origen: p.origen, paraCuando: p.paraCuando })
      : { titulo: "Solicitud nueva", cuerpo: `${p.quien} necesita ${queLleva(p.descripcion)} en ${p.destino} para ${dia(p.paraCuando)} ${hora(p.paraCuando)}. Retirar en ${p.origen}.` }),
    enlace: `/solicitudes/${p.pedidoId}`, entidad: `pedido:${p.pedidoId}`, obraId: p.obraId, datos: { pedidoId: p.pedidoId },
    para: [rol("CHOFER", p.urgente), rol("DIRECCION", bandeja)],
  }),

  pedidoAceptado: (v: V & { choferId: string; salida: Date; vehiculo: string }): Evento => ({
    nombre: "pedido.aceptado", tipo: "PEDIDO_ACEPTADO",
    ...TEXTO.aceptado(v.chofer, { descripcion: v.descripcion, destino: v.destino, salida: v.salida, vehiculo: v.vehiculo }),
    enlace: enlacePedido(v.pedidoId), entidad: `pedido:${v.pedidoId}`, obraId: v.obraId, datos: { pedidoId: v.pedidoId, salida: v.salida.toISOString() },
    // El chofer recibe push cuando no lo aceptó él (lo asignó Dirección).
    para: [usuario(v.solicitanteId, push), usuario(v.choferId, push, `/viaje/${v.pedidoId}`), rol("DIRECCION", bandeja)],
  }),

  pedidoSoltado: (v: V): Evento => ({
    nombre: "pedido.soltado", tipo: "PEDIDO_SOLTADO", ...TEXTO.soltado(v.chofer),
    enlace: enlacePedido(v.pedidoId), entidad: `pedido:${v.pedidoId}`, obraId: v.obraId, datos: { pedidoId: v.pedidoId },
    para: [usuario(v.solicitanteId, push), rol("DIRECCION", bandeja)],
  }),

  pedidoCancelado: (v: V & { quien: string; motivo: string; choferId: string | null }): Evento => ({
    nombre: "pedido.cancelado", tipo: "PEDIDO_CANCELADO",
    ...TEXTO.cancelado(v.quien, { descripcion: v.descripcion, destino: v.destino, motivo: v.motivo }),
    enlace: enlacePedido(v.pedidoId), entidad: `pedido:${v.pedidoId}`, obraId: v.obraId, datos: { pedidoId: v.pedidoId },
    para: [usuario(v.solicitanteId, push), usuario(v.choferId, push, "/hoy"), rol("DIRECCION", bandeja)],
  }),

  viajeSalio: (v: V & { origen: string; distanciaM: number; etaRetiro: Date | null; etaDestino: Date; directo: boolean }): Evento => ({
    nombre: "viaje.salio", tipo: "VIAJE_INICIADO",
    ...(v.directo || !v.etaRetiro
      ? TEXTO.salioDelRetiro(v.chofer, { descripcion: v.descripcion, destino: v.destino, distanciaM: v.distanciaM, etaDestino: v.etaDestino })
      : TEXTO.iniciado(v.chofer, { descripcion: v.descripcion, destino: v.destino, origen: v.origen, distanciaM: v.distanciaM, etaRetiro: v.etaRetiro, etaDestino: v.etaDestino })),
    enlace: enlacePedido(v.pedidoId), entidad: `viaje:${v.pedidoId}:salio`, obraId: v.obraId,
    datos: { pedidoId: v.pedidoId, distanciaM: v.distanciaM, eta: v.etaDestino.toISOString() }, para: etapaDelViaje(v),
  }),

  viajeEnRetiro: (v: V & { origen: string; distanciaM: number; etaDestino: Date }): Evento => ({
    nombre: "viaje.enRetiro", tipo: "LLEGO_RETIRO",
    ...TEXTO.enRetiro(v.chofer, { descripcion: v.descripcion, destino: v.destino, origen: v.origen, distanciaM: v.distanciaM, etaDestino: v.etaDestino }),
    enlace: enlacePedido(v.pedidoId), entidad: `viaje:${v.pedidoId}:enRetiro`, obraId: v.obraId,
    datos: { pedidoId: v.pedidoId, distanciaM: v.distanciaM, eta: v.etaDestino.toISOString() }, para: etapaDelViaje(v),
  }),

  viajeSalioRetiro: (v: V & { distanciaM: number; etaDestino: Date }): Evento => ({
    nombre: "viaje.salioRetiro", tipo: "SALIO_RETIRO",
    ...TEXTO.salioDelRetiro(v.chofer, { descripcion: v.descripcion, destino: v.destino, distanciaM: v.distanciaM, etaDestino: v.etaDestino }),
    enlace: enlacePedido(v.pedidoId), entidad: `viaje:${v.pedidoId}:salioRetiro`, obraId: v.obraId,
    datos: { pedidoId: v.pedidoId, distanciaM: v.distanciaM, eta: v.etaDestino.toISOString() }, para: etapaDelViaje(v),
  }),

  viajeEnDestino: (v: V & { llego: Date }): Evento => ({
    nombre: "viaje.enDestino", tipo: "LLEGO_DESTINO",
    ...TEXTO.llegoAlDestino(v.chofer, { descripcion: v.descripcion, destino: v.destino, llego: v.llego }),
    enlace: enlacePedido(v.pedidoId), entidad: `viaje:${v.pedidoId}:enDestino`, obraId: v.obraId,
    datos: { pedidoId: v.pedidoId, distanciaM: 0, eta: v.llego.toISOString() }, para: etapaDelViaje(v),
  }),

  viajeTerminado: (v: V & { llego: Date; km: number }): Evento => ({
    nombre: "viaje.terminado", tipo: "LLEGO_DESTINO",
    titulo: `Entregado: ${queLleva(v.descripcion)}`,
    cuerpo: `${v.chofer} terminó el viaje a ${v.destino}: tu pedido de ${queLleva(v.descripcion)} quedó entregado (${hora(v.llego)}).`,
    enlace: enlacePedido(v.pedidoId), entidad: `viaje:${v.pedidoId}:terminado`, obraId: v.obraId,
    datos: { pedidoId: v.pedidoId, distanciaM: 0, eta: v.llego.toISOString() }, para: etapaDelViaje(v),
  }),

  viajeSinSenal: (v: V & { vehiculo: string; desde: Date }): Evento => ({
    nombre: "viaje.sinSenal", tipo: "SIN_SENAL", ...TEXTO.sinSenal(v.vehiculo, v.desde),
    enlace: enlacePedido(v.pedidoId), entidad: `viaje:${v.pedidoId}:sinSenal`, obraId: v.obraId, datos: { pedidoId: v.pedidoId },
    para: [usuario(v.solicitanteId, bandeja), rol("DIRECCION", bandeja)],
  }),

  viajeDemora: (v: V & { eta: Date }): Evento => ({
    nombre: "viaje.demora", tipo: "GENERAL", ...TEXTO.demora(v.chofer, v.eta),
    enlace: enlacePedido(v.pedidoId), entidad: `viaje:${v.pedidoId}:demora`, obraId: v.obraId,
    datos: { pedidoId: v.pedidoId, eta: v.eta.toISOString(), demora: true },
    para: [usuario(v.solicitanteId, push)],
  }),

  resumenChofer: (p: { choferId: string; viajes: { salida: Date | null; descripcion: string; destino: string }[] }): Evento => ({
    nombre: "chofer.resumenDia", tipo: "GENERAL", ...TEXTO.resumenDia(p.viajes),
    enlace: "/hoy", entidad: `resumen:${p.choferId}`, datos: { resumen: true }, para: [usuario(p.choferId, push)],
  }),

  // ═══════════════════════════════ Materiales y Compras ═══════════════════════════════

  materialNuevo: (m: M & { quien: string; para: Date; urgente: boolean; observaciones?: string | null; adjuntos?: number }): Evento => ({
    nombre: "material.nuevo", tipo: "MATERIAL",
    ...TEXTO_MATERIAL.nuevo(m.quien, { que: m.que, obra: m.obra, para: paraElDia(m.para), urgente: m.urgente, observaciones: m.observaciones, adjuntos: m.adjuntos }),
    ...material(m, "nuevo"), para: [rol("COMPRAS", push), rol("DIRECCION", bandeja)],
  }),

  materialTomado: (m: M & { comprador: string }): Evento => ({
    nombre: "material.tomado", tipo: "MATERIAL", ...TEXTO_MATERIAL.tomado(m.comprador, m),
    ...material(m, "tomado"), para: [usuario(m.solicitanteId, bandeja)],
  }),

  materialOcArmada: (m: M): Evento => ({
    nombre: "material.ocArmada", tipo: "MATERIAL", ...TEXTO_MATERIAL.esperando(m),
    ...material(m, "ocArmada"), para: [usuario(m.solicitanteId, bandeja)],
  }),

  materialParaAprobar: (m: M & { oc: string | null; monto: string | null }): Evento => ({
    nombre: "material.paraAprobar", tipo: "MATERIAL", ...TEXTO_MATERIAL.paraAprobar(m),
    ...material(m, "paraAprobar"), enlace: "/aprobaciones", para: [rol("DIRECCION", push)],
  }),

  materialAprobado: (m: M & { oc: string | null; enPapel: boolean; compradorId: string | null }): Evento => ({
    nombre: "material.aprobado", tipo: "MATERIAL", ...TEXTO_MATERIAL.aprobado(m),
    ...material(m, "aprobado"), para: [m.compradorId ? usuario(m.compradorId, push) : rol("COMPRAS", push), usuario(m.solicitanteId, bandeja)],
  }),

  materialRechazado: (m: M & { oc: string | null; motivo: string; compradorId: string | null }): Evento => ({
    nombre: "material.rechazado", tipo: "MATERIAL", ...TEXTO_MATERIAL.rechazado(m),
    ...material(m, "rechazado"), para: [m.compradorId ? usuario(m.compradorId, push) : rol("COMPRAS", push), usuario(m.solicitanteId, bandeja)],
  }),

  materialHabilitado: (m: M & { proveedor: string; horario: string | null; entregaProveedor: boolean; cuando: string | null }): Evento => ({
    nombre: "material.habilitado", tipo: "MATERIAL",
    ...(m.entregaProveedor ? TEXTO_MATERIAL.loLlevaElProveedor(m) : TEXTO_MATERIAL.listo(m)),
    ...material(m, `habilitado:${m.proveedor}`), para: [usuario(m.solicitanteId, push), { obra: m.obraId, push }, rol("COMPRAS", bandeja)],
  }),

  materialRetiroPedido: (m: M & { quien: string; proveedor: string }): Evento => ({
    nombre: "material.retiroPedido", tipo: "MATERIAL",
    titulo: `Retiro pedido: ${queLleva(m.que)}`,
    cuerpo: `${m.quien} pidió el viaje para retirar ${queLleva(m.que)} en ${m.proveedor} para Obra ${m.obra}.`,
    ...material(m, "retiroPedido"), para: [rol("COMPRAS", bandeja)],
  }),

  materialEntregado: (m: M & { completo: boolean }): Evento => ({
    nombre: "material.entregado", tipo: "MATERIAL", ...TEXTO_MATERIAL.entregado(m),
    ...material(m, "entregado"), para: [usuario(m.solicitanteId, push), rol("COMPRAS", bandeja)],
  }),

  materialVuelveAListo: (m: M & { proveedor: string; motivo: string }): Evento => ({
    nombre: "material.vuelveAListo", tipo: "MATERIAL", ...TEXTO_MATERIAL.vuelveAListo(m),
    ...material(m, "vuelveAListo"), para: [usuario(m.solicitanteId, bandeja), rol("COMPRAS", bandeja)],
  }),

  /** Lo cancela Compras o el dueño → le llega a la obra; lo cancela quien pidió → a Compras. */
  materialCancelado: (m: M & { quien: string; motivo: string; porCompras: boolean; compradorId: string | null }): Evento => ({
    nombre: "material.cancelado", tipo: "MATERIAL", ...TEXTO_MATERIAL.cancelado(m.quien, m),
    ...material(m, "cancelado"),
    para: m.porCompras ? [usuario(m.solicitanteId, push), { obra: m.obraId, push: bandeja }] : [m.compradorId ? usuario(m.compradorId, push) : rol("COMPRAS", push)],
  }),

  // ═══════════════════════════════ Herramientas ═══════════════════════════════

  herramientaDuplicada: (p: { primeroId: string; pedidoPrimeroId: string; pedidoId: string; obraId: string; quien: string; herramienta: string; obra: string; cuando: Date; motivo: string | null }): Evento => ({
    nombre: "herramienta.duplicada", tipo: "DUPLICADO",
    titulo: `${p.quien} también pidió ${p.herramienta} para Obra ${p.obra}`,
    cuerpo: `Es ${paraElDia(p.cuando)}, igual que el tuyo.${p.motivo ? ` Motivo: ${p.motivo}` : ""}`,
    enlace: enlacePedido(p.pedidoPrimeroId), entidad: `pedido:${p.pedidoId}:duplicado`, obraId: p.obraId, datos: { pedidoId: p.pedidoId },
    para: [usuario(p.primeroId, bandeja)],
  }),

  herramientaPedidaEnTuObra: (p: { usuarioIds: string[]; herramientaId: string; pedidoId: string; quien: string; herramienta: string; desdeObra: string; obra: string; cuando: Date }): Evento => ({
    nombre: "herramienta.pedidaEnTuObra", tipo: "GENERAL",
    titulo: `${p.quien} pidió ${p.herramienta} que está en Obra ${p.desdeObra}`,
    cuerpo: `La van a buscar para llevarla a Obra ${p.obra} ${paraElDia(p.cuando)}.`,
    enlace: `/herramientas/${p.herramientaId}`, entidad: `pedido:${p.pedidoId}:enTuObra`, datos: { pedidoId: p.pedidoId },
    para: p.usuarioIds.map((id) => usuario(id, bandeja)),
  }),

  // ═══════════════════════════════ Alertas automáticas ═══════════════════════════════

  /**
   * Una alerta del cron, al crearse (o al pasar a crítica): UNA sola vez, nunca al reevaluarse.
   * "personas" son las que nombra la regla (el que pidió, quien tiene la herramienta, el chofer…).
   */
  alerta: (a: { regla: string; severidad: Severidad; titulo: string; detalle: string; enlace: string | null; claveUnica: string; obraId: string | null; personas: string[] }): Evento | null => {
    const vencido = a.severidad === "CRITICA";
    const personas = (p: boolean, enlace?: string) => a.personas.map((id) => usuario(id, p, enlace));
    const para: Record<string, Destinatario[]> = {
      MATERIAL_SIN_RETIRAR: [...personas(push), rol("COMPRAS", bandeja)],
      MATERIAL_DEMORADO: [rol("COMPRAS", bandeja), rol("DIRECCION", bandeja)],
      APROBACION_DEMORADA: [rol("DIRECCION", push)],
      DEVOLUCION_VENCIDA: [...personas(bandeja), rol("DEPOSITO", bandeja), rol("DIRECCION", bandeja)],
      // El chofer no abre Flota: su aviso lleva a su bandeja, donde ve la alerta.
      DOCUMENTO: [rol("ADMINISTRACION", vencido), rol("DIRECCION", vencido), ...personas(vencido, "/avisos")],
      LICENCIA: [rol("ADMINISTRACION", vencido), rol("DIRECCION", vencido), ...personas(vencido, "/avisos")],
    };
    if (!para[a.regla]) return null; // el resto de las alertas se ven en Alertas, sin aviso aparte
    return {
      nombre: `alerta.${a.regla}`, tipo: "GENERAL", titulo: a.titulo, cuerpo: a.detalle, enlace: a.enlace,
      entidad: `alerta:${a.claveUnica}:${a.severidad}`, obraId: a.obraId, datos: { alerta: a.claveUnica }, para: para[a.regla],
    };
  },
};

// ─────────────────────────── Materiales: lo común ───────────────────────────

type M = { pedidoMaterialId: string; solicitanteId: string; obraId: string; que: string; obra: string; proveedor?: string; horario?: string | null; cuando?: string | null };
const material = (m: M, que: string) => ({
  enlace: `/materiales/${m.pedidoMaterialId}`, entidad: `material:${m.pedidoMaterialId}:${que}`, obraId: m.obraId, datos: { pedidoMaterialId: m.pedidoMaterialId },
});

