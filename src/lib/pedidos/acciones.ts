"use server";

import { revalidar } from "@/lib/revalidar";
import { reevaluar } from "@/lib/alertas/reevaluar";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso, exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { aFecha, diaISO, hora } from "@/lib/formato";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { auditar, buscarDuplicado, choferesQueLoVen, describirPedido, necesitaCamion, validarChoferYVehiculo, type Duplicado } from "./reglas";
import { resolverPuntos } from "./puntos";
import { esObraDelUsuario } from "@/lib/alcance";
import { aPedidoParaParadas, armarParadas, crearViaje, quitarDelViaje, rearmarParadas, selectPedidoParadas } from "@/lib/viajes/paradas";
import { validarCombinacion } from "@/lib/viajes/sugerencias";
import { planificarOrden, reordenar } from "@/lib/viajes/combinar";
import { arrancarParadas } from "@/lib/viajes/motor";
import { cancelarRecordatorios, programarRecordatorios } from "@/lib/viajes/recordatorios-agenda";
import { bloqueoPorFecha, ddmm, diaSemana, diasEntre } from "@/lib/viajes/fecha";
import { conEtapa } from "@/lib/viajes/etapas";
import { avisarSolicitudNueva } from "./avisos";
import { baseViaje, notificarEvento } from "@/lib/notificaciones/enviar";
import { EVENTO } from "@/lib/notificaciones/eventos";
import { FRANJA } from "./presentacion";
import { alCambiarElViaje } from "@/lib/materiales/circuito";

/** Refresca pantallas y reevalúa las alertas del módulo (resuelve solas las que ya no aplican). */
const refrescar = () => {
  revalidar("pedidos", "herramientas", "materiales");
  reevaluar("pedidos", "materiales");
};
const vacio = (v: unknown) => (v === "" || v === null ? undefined : v);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// ═══════════════════════════════ Pedir ═══════════════════════════════


const esquemaPedido = z
  .object({
    tipo: z.enum(["RETIRO_PROVEEDOR", "TRASLADO_MAQUINARIA", "TRASLADO_HERRAMIENTAS", "LLEVAR_A_OBRA", "RETIRO_ESCOMBROS", "TRASLADO_PERSONAS"], { error: "Elegí qué hay que hacer." }),
    obraId: z.string().min(1, "Elegí la obra."),
    origenTipo: z.enum(["BASE", "PROVEEDOR", "DEPOSITO", "OBRA"], { error: "Elegí desde dónde." }),
    origenId: z.string().min(1, "Elegí desde dónde."),
    // Si la obra tiene sedes (más de un frente): a cuál va.
    destinoSedeId: z.preprocess(vacio, z.string().optional()),
    ordenCompraLebane: z.preprocess(vacio, z.string().trim().max(40).optional()),
    descripcion: z.string().trim().min(3, "Contá qué hay que llevar.").max(240),
    pesoKg: z.preprocess(vacio, z.coerce.number().int().positive().max(30_000).optional()),
    cantidadPersonas: z.preprocess(vacio, z.coerce.number().int().min(1).max(30).optional()),
    dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí el día."),
    franja: z.enum(["MANANA", "TARDE", "HORA_EXACTA"]),
    hora: z.preprocess(vacio, z.string().regex(HHMM, "Revisá la hora.").optional()),
    prioridad: z.enum(["NORMAL", "URGENTE"]),
    forzar: z.boolean().default(false), // "No, es otro pedido"
    clientId: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().uuid().optional()), // pedido hecho sin señal
    // Pedido hecho sin señal: la hora real en que lo pidió.
    ocurridoEn: z.coerce.date().optional(),
  })
  .superRefine((d, ctx) => {
    // Regla (CLAUDE.md, "Materiales y Compras"): el retiro en proveedor solo se pide desde lo que habilitó Compras.
    if (d.tipo === "RETIRO_PROVEEDOR") ctx.addIssue({ code: "custom", message: "El retiro en proveedor se pide desde los materiales que habilitó Compras: Pedir → Retiro en proveedor." });
    if (d.tipo === "TRASLADO_PERSONAS" && !d.cantidadPersonas) ctx.addIssue({ code: "custom", message: "¿Cuántas personas?" });
    if (d.franja === "HORA_EXACTA" && !d.hora) ctx.addIssue({ code: "custom", message: "Poné la hora." });
    if (d.origenTipo === "OBRA" && d.origenId === d.obraId && d.tipo !== "RETIRO_ESCOMBROS") {
      ctx.addIssue({ code: "custom", message: "El origen y el destino son la misma obra." });
    }
  });

export type DatosPedido = z.input<typeof esquemaPedido>;

export type RespuestaPedido =
  | { estado: "creado"; id: string; numero: number; choferes: string[] }
  | { estado: "duplicado"; existente: Duplicado };

export async function crearPedido(entrada: DatosPedido): Promise<Resultado<RespuestaPedido>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("pedidos.crear");
    const d = esquemaPedido.parse(entrada);

    // Idempotente: si el teléfono reenvía el pedido que guardó sin señal, no se duplica.
    if (d.clientId) {
      const ya = await db.pedidoViaje.findUnique({ where: { clientId: d.clientId }, select: { id: true, numero: true, necesitaCamion: true } });
      if (ya) return { estado: "creado", id: ya.id, numero: ya.numero, choferes: await choferesQueLoVen(ya.necesitaCamion) } as const;
    }

    const obra = await db.obra.findUnique({ where: { id: d.obraId }, select: { id: true, nombre: true, estado: true } });
    if (!obra || obra.estado !== "ACTIVA") throw new ErrorNegocio("Esa obra no está activa.");
    if (!(await esObraDelUsuario(yo, obra.id))) throw new ErrorNegocio(`No sos responsable de Obra ${obra.nombre}.`);

    // De dónde sale y a dónde va, resuelto una sola vez (el origen tiene que existir y ser del tipo que dice).
    const puntos = await resolverPuntos(db, { origenTipo: d.origenTipo, origenId: d.origenId, obraId: obra.id, destinoSedeId: d.destinoSedeId ?? null });
    const sedes = await db.obraSede.count({ where: { obraId: obra.id, activa: true } });
    if (sedes > 1 && !d.destinoSedeId) throw new ErrorNegocio(`Obra ${obra.nombre} tiene varias sedes: elegí a cuál va.`);

    // Peso: tiene que haber un vehículo de la cola que lo pueda llevar.
    if (d.pesoKg) {
      const max = (await db.vehiculo.aggregate({ where: { activo: true }, _max: { capacidadCargaKg: true } }))._max.capacidadCargaKg ?? 0;
      if (d.pesoKg > max) throw new ErrorNegocio(`Ningún vehículo carga más de ${max.toLocaleString("es-AR")} kg. Partilo en dos pedidos.`);
    }

    // Para cuándo, en hora argentina. Nunca en el pasado.
    const horaElegida = d.franja === "HORA_EXACTA" ? d.hora! : FRANJA[d.franja].hora;
    const paraCuando = aFecha(d.dia, horaElegida);
    if (d.dia < diaISO()) throw new ErrorNegocio("El día ya pasó. Elegí hoy o una fecha futura.");

    const proveedorId = puntos.proveedorId;

    // Lo que más valor tiene: no duplicar pedidos.
    if (!d.forzar) {
      const existente = await buscarDuplicado(yo, { obraId: d.obraId, tipo: d.tipo, proveedorId, descripcion: d.descripcion });
      if (existente) return { estado: "duplicado", existente } as const;
    }

    const camion = necesitaCamion(d.tipo, d.pesoKg);
    const pedido = await db.$transaction(async (tx) => {
      const p = await tx.pedidoViaje.create({
        data: {
          clientId: d.clientId ?? null,
          ...(d.ocurridoEn && d.ocurridoEn < new Date() ? { creadoEn: d.ocurridoEn } : {}),
          solicitanteId: yo.id,
          obraId: d.obraId,
          tipo: d.tipo,
          origenTipo: d.origenTipo,
          ...puntos,
          // Proveedor: el origen es la sucursal.
          origenId: puntos.sucursalId ?? d.origenId,
          destinoSedeId: d.destinoSedeId ?? null,
          proveedorId,
          ordenCompraLebane: d.ordenCompraLebane ?? null,
          descripcion: d.descripcion,
          pesoKg: d.pesoKg ?? null,
          cantidadPersonas: d.tipo === "TRASLADO_PERSONAS" ? d.cantidadPersonas ?? null : null,
          necesitaCamion: camion,
          paraCuando,
          fechaNecesaria: aFecha(d.dia, "12:00"),
          franja: d.franja,
          prioridad: d.prioridad,
        },
        select: { id: true, numero: true },
      });
      await auditar(tx, {
        usuarioId: yo.id, accion: d.forzar ? "pedido.crear.noEraDuplicado" : "pedido.crear", entidadId: p.id,
        resumen: `${yo.nombre} pidió ${d.descripcion} para Obra ${obra.nombre}${d.prioridad === "URGENTE" ? " (urgente)" : ""}${d.forzar ? ", aunque se parecía a otro pedido" : ""}`,
        despues: { estado: "PENDIENTE", tipo: d.tipo, obra: obra.nombre },
      });
      return p;
    });

    refrescar();
    await avisarSolicitudNueva(pedido.id, yo.id);
    return { estado: "creado", id: pedido.id, numero: pedido.numero, choferes: await choferesQueLoVen(camion) } as const;
  });
}

/** "Deshacer" justo después de pedir: queda cancelado (nada se borra). */
export async function deshacerPedido(pedidoId: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("pedidos.crear");
    const r = await db.pedidoViaje.updateMany({
      where: { id: pedidoId, solicitanteId: yo.id, estado: "PENDIENTE", creadoEn: { gte: new Date(Date.now() - 2 * 60_000) } },
      data: { estado: "CANCELADO", motivoCancelacion: "Se deshizo al pedirlo", canceladoEn: new Date() },
    });
    if (!r.count) throw new ErrorNegocio("Ya no se puede deshacer.");
    await db.$transaction((tx) => alCambiarElViaje(tx, pedidoId, "CANCELADO", yo.id));
    await auditar(db, { usuarioId: yo.id, accion: "pedido.deshacer", entidadId: pedidoId, resumen: `${yo.nombre} deshizo ${await describirPedido(db, pedidoId)}`, antes: { estado: "PENDIENTE" }, despues: { estado: "CANCELADO" } });
    refrescar();
    return null;
  });
}

// ═══════════════════════════════ Tomar ═══════════════════════════════

const esquemaTomar = z.object({
  pedidoId: z.string().min(1),
  vehiculoId: z.string().min(1, "Elegí el vehículo."),
  salida: z.string().regex(HHMM, "Poné la hora de salida."),
  // "Ahora" o "En 1 h": sale hoy aunque el pedido sea para más adelante.
  saleHoy: z.boolean().optional(),
  // Aceptado sin señal: la hora real en que tocó "Aceptar".
  ocurridoEn: z.coerce.date().optional(),
  // "Aprovechá el viaje": otros pedidos que lleva en el mismo viaje (pendientes, o suyos del mismo día sin iniciar).
  extras: z.array(z.string().min(1)).max(10).optional(),
});

export type DatosTomar = z.input<typeof esquemaTomar>;

/**
 * Suma pedidos a un viaje (al aceptar o con "Agregar parada"): los pendientes pasan a ser del chofer y
 * los suyos de otro viaje programado se mudan a este. Valida capacidad, paradas y fechas. Devuelve los
 * que sumó (para los avisos).
 */
async function sumarAlViaje(tx: Prisma.TransactionClient, yo: { id: string }, base: { id: string; paraCuando: Date }[], extras: string[]) {
  if (!extras.length) return [];
  const dia = [diaISO(), ...base.map((p) => diaISO(p.paraCuando))].sort().pop()!;
  const filas = await tx.pedidoViaje.findMany({ where: { id: { in: extras } }, select: { id: true, estado: true, tomadoPorId: true, paraCuando: true, descripcion: true, tipo: true, pesoKg: true, tomadoPor: { select: { nombre: true } }, obra: { select: { nombre: true } }, viaje: { select: { estado: true } } } });
  for (const id of extras) {
    const p = filas.find((x) => x.id === id);
    if (!p) throw new ErrorNegocio("Uno de los pedidos ya no existe.");
    if (diaISO(p.paraCuando) > dia) throw new ErrorNegocio(`El pedido de ${p.descripcion} es para otro día: no se puede combinar.`);
    if (p.estado === "PENDIENTE") {
      const r = await tx.pedidoViaje.updateMany({ where: { id, estado: "PENDIENTE" }, data: { estado: "TOMADO", tomadoPorId: yo.id, tomadoEn: new Date() } });
      if (!r.count) {
        const ahora = await tx.pedidoViaje.findUniqueOrThrow({ where: { id }, select: { tomadoPor: { select: { nombre: true } } } });
        throw new ErrorNegocio(`Ya lo aceptó ${ahora.tomadoPor?.nombre ?? "otro chofer"}: ${p.descripcion} para ${p.obra.nombre}. Volvé a mirar las sugerencias.`);
      }
    } else if (p.estado === "TOMADO" && p.tomadoPorId === yo.id && p.viaje?.estado === "PROGRAMADO") {
      await quitarDelViaje(tx, id); // se muda a este viaje
    } else {
      throw new ErrorNegocio(p.tomadoPor ? `Ya lo aceptó ${p.tomadoPor.nombre}: ${p.descripcion}.` : `El pedido de ${p.descripcion} ya no está disponible.`);
    }
  }
  return filas;
}

/** Valida la combinación completa (capacidad del vehículo, máximo de paradas, personas con escombros). */
async function validarViajeCombinado(tx: Prisma.TransactionClient, pedidoIds: string[], vehiculo: { nombre: string; capacidadCargaKg: number }) {
  const pedidos = await tx.pedidoViaje.findMany({ where: { id: { in: pedidoIds } }, select: { ...selectPedidoParadas, tipo: true, pesoKg: true } });
  const paradas = armarParadas(pedidos.map((p) => aPedidoParaParadas(p))).paradas.length;
  const error = validarCombinacion(pedidos, vehiculo, paradas);
  if (error) throw new ErrorNegocio(error);
}

/** "lo combinó con otro retiro en el mismo lugar" o "con otros pedidos de la zona". */
async function textoCombinado(tx: Prisma.TransactionClient, pedidoId: string, viajeId: string) {
  const paradas = await tx.viajeParada.findMany({ where: { viajeId }, select: { tipo: true, _count: { select: { pedidosRetiro: true } } } });
  const vp = await tx.viajePedido.findFirst({ where: { viajeId, pedidoViajeId: pedidoId }, select: { paradaRetiro: { select: { _count: { select: { pedidosRetiro: true } } } } } });
  if (paradas.length <= 2) return null;
  return (vp?.paradaRetiro?._count.pedidosRetiro ?? 0) > 1 ? "lo combinó con otro retiro en el mismo lugar" : "lo combinó con otros pedidos de la zona";
}

/**
 * Día en que sale: el del pedido (nunca antes: un viaje para el lunes no se inicia hoy), o hoy si el
 * pedido era para antes. "Sale ahora" (saleHoy) solo vale si el pedido es para hoy o ya pasó.
 */
function salidaPara(paraCuando: Date, hhmm: string, saleHoy = false) {
  const diaPedido = diaISO(paraCuando);
  const hoy = diaISO();
  if (diaPedido > hoy) return saleHoy ? paraCuando : aFecha(diaPedido, hhmm);
  return aFecha(hoy, hhmm);
}

async function siguienteEnRuta(tx: Prisma.TransactionClient, choferId: string) {
  const max = await tx.viaje.aggregate({ where: { choferId, estado: "PROGRAMADO" }, _max: { ordenRuta: true } });
  return (max._max.ordenRuta ?? 0) + 1;
}

export async function tomarPedido(entrada: DatosTomar): Promise<Resultado<{ numero: number; vehiculo: string; salida: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("pedidos.tomar");
    const d = esquemaTomar.parse(entrada);

    const r = await db.$transaction(async (tx) => {
      const pedido = await tx.pedidoViaje.findUnique({ where: { id: d.pedidoId } });
      if (!pedido) throw new ErrorNegocio("No existe ese pedido.");
      const { vehiculo } = await validarChoferYVehiculo(tx, yo.id, d.vehiculoId, pedido);

      // Cerrojo: solo uno lo toma. El segundo ve quién se le adelantó.
      const tomado = await tx.pedidoViaje.updateMany({
        where: { id: d.pedidoId, estado: "PENDIENTE" },
        data: { estado: "TOMADO", tomadoPorId: yo.id, tomadoEn: d.ocurridoEn && d.ocurridoEn < new Date() ? d.ocurridoEn : new Date() },
      });
      if (!tomado.count) {
        const actual = await tx.pedidoViaje.findUniqueOrThrow({ where: { id: d.pedidoId }, select: { estado: true, tomadoPorId: true, tomadoPor: { select: { nombre: true } }, viaje: { select: { salidaEstimada: true, vehiculo: { select: { nombre: true } } } } } });
        // Reenvío de un "Aceptar" guardado sin señal (o doble toque): ya es suyo, no es un error.
        if (actual.tomadoPorId === yo.id) return { numero: pedido.numero, vehiculo: actual.viaje?.vehiculo.nombre ?? vehiculo.nombre, salida: actual.viaje?.salidaEstimada ? hora(actual.viaje.salidaEstimada) : d.salida };
        if (actual.estado === "CANCELADO") throw new ErrorNegocio("Este pedido fue cancelado.");
        throw new ErrorNegocio(`Ya lo aceptó ${actual.tomadoPor?.nombre ?? "otro chofer"}.`);
      }

      const salidaEstimada = salidaPara(pedido.paraCuando, d.salida, d.saleHoy);
      // "Aprovechá el viaje": los otros pedidos que lleva en el mismo viaje.
      const extras = [...new Set(d.extras ?? [])].filter((id) => id !== pedido.id);
      await sumarAlViaje(tx, yo, [pedido], extras);
      const ids = [pedido.id, ...extras];
      if (extras.length) await validarViajeCombinado(tx, ids, vehiculo);
      const viajeId = await crearViaje(tx, { pedidoIds: ids, vehiculoId: vehiculo.id, choferId: yo.id, salidaEstimada, ordenRuta: await siguienteEnRuta(tx, yo.id) });
      for (const id of ids) {
        await alCambiarElViaje(tx, id, "TOMADO", yo.id);
        await auditar(tx, {
          usuarioId: yo.id, accion: "pedido.tomar", entidadId: id,
          resumen: `${yo.nombre} aceptó ${await describirPedido(tx, id)} con ${vehiculo.nombre}${extras.length ? ` (viaje combinado: ${ids.length} pedidos)` : ""}`,
          antes: { estado: "PENDIENTE" }, despues: { estado: "TOMADO", chofer: yo.nombre, vehiculo: vehiculo.nombre, salida: salidaEstimada.toISOString() },
        });
        const combinado = extras.length ? await textoCombinado(tx, id, viajeId) : null;
        await notificarEvento(EVENTO.pedidoAceptado({ ...(await baseViaje(tx, id, yo.nombre)), choferId: yo.id, salida: salidaEstimada, vehiculo: vehiculo.nombre, combinado }), { tx, actor: yo.id });
      }
      return { numero: pedido.numero, vehiculo: vehiculo.nombre, salida: hora(salidaEstimada), viajeId, combinados: extras.length };
    });

    // Orden estratégico de las paradas (fuera de la transacción: consulta el ruteo).
    if ("viajeId" in r && r.viajeId) await planificarOrden(r.viajeId);
    refrescar();
    return { numero: r.numero, vehiculo: r.vehiculo, salida: r.salida };
  });
}

/** Soltar: vuelve a la cola. El viaje programado queda registrado como cancelado. */
export async function soltarPedido(pedidoId: string): Promise<Resultado<{ vehiculoId: string; salida: string } | null>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("pedidos.tomar");
    let viajeId: string | null = null;
    const r = await db.$transaction(async (tx) => {
      const soltado = await tx.pedidoViaje.updateMany({
        where: { id: pedidoId, estado: "TOMADO", tomadoPorId: yo.id },
        data: { estado: "PENDIENTE", tomadoPorId: null, tomadoEn: null },
      });
      if (!soltado.count) throw new ErrorNegocio("Ya no se puede soltar: el viaje empezó o el pedido cambió.");
      const viaje = await quitarDelViaje(tx, pedidoId);
      viajeId = viaje?.id ?? null;
      await alCambiarElViaje(tx, pedidoId, "LIBERADO", yo.id);
      await notificarEvento(EVENTO.pedidoSoltado(await baseViaje(tx, pedidoId, yo.nombre)), { tx, actor: yo.id });
      await auditar(tx, { usuarioId: yo.id, accion: "pedido.soltar", entidadId: pedidoId, resumen: `${yo.nombre} soltó ${await describirPedido(tx, pedidoId)}: vuelve a las solicitudes`, antes: { estado: "TOMADO", chofer: yo.nombre }, despues: { estado: "PENDIENTE" } });
      // Para poder deshacer: con qué vehículo y a qué hora iba a salir.
      return viaje ? { vehiculoId: viaje.vehiculoId, salida: viaje.salidaEstimada ? hora(viaje.salidaEstimada) : "08:00" } : null;
    });
    // Si el viaje sigue con otros pedidos, se vuelve a ordenar sin este.
    if (viajeId) await planificarOrden(viajeId);
    refrescar();
    return r;
  });
}

// ═══════════════════════════ Cancelar ═══════════════════════════

export async function cancelarPedido(pedidoId: string, motivo: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    const m = motivo.trim();
    if (m.length < 3) throw new ErrorNegocio("Contá por qué se cancela.");
    const pedido = await db.pedidoViaje.findUnique({ where: { id: pedidoId }, select: { estado: true, solicitanteId: true, tomadoPorId: true, descripcion: true, destinoNombre: true, tomadoPor: { select: { nombre: true } } } });
    if (!pedido) throw new ErrorNegocio("No existe ese pedido.");

    const cualquiera = puede(yo.rol, "pedidos.cancelarCualquiera");
    const propio = pedido.solicitanteId === yo.id && puede(yo.rol, "pedidos.cancelarPropios");
    if (!cualquiera && !propio) throw new ErrorNegocio("Solo quien lo pidió puede cancelarlo.");
    const estados = cualquiera ? (["PENDIENTE", "TOMADO"] as const) : (["PENDIENTE"] as const);
    if (!(estados as readonly string[]).includes(pedido.estado)) {
      throw new ErrorNegocio(pedido.estado === "TOMADO" ? `Ya lo tomó ${pedido.tomadoPor?.nombre}. Hablá con él para cancelarlo.` : "Este pedido ya no se puede cancelar.");
    }

    await db.$transaction(async (tx) => {
      const r = await tx.pedidoViaje.updateMany({
        where: { id: pedidoId, estado: { in: [...estados] } },
        data: { estado: "CANCELADO", motivoCancelacion: m, canceladoEn: new Date() },
      });
      if (!r.count) throw new ErrorNegocio("El pedido cambió mientras lo cancelabas.");
      await quitarDelViaje(tx, pedidoId, true);
      await alCambiarElViaje(tx, pedidoId, "CANCELADO", yo.id);
      // Al que lo pidió (si no fue él) y al chofer que lo había aceptado: que no tiene que ir.
      await notificarEvento(EVENTO.pedidoCancelado({ ...(await baseViaje(tx, pedidoId)), quien: yo.nombre, motivo: m, choferId: pedido.tomadoPorId }), { tx, actor: yo.id });
      await auditar(tx, { usuarioId: yo.id, accion: "pedido.cancelar", entidadId: pedidoId, resumen: `${yo.nombre} canceló ${await describirPedido(tx, pedidoId)}: ${m}`, antes: { estado: pedido.estado }, despues: { estado: "CANCELADO", motivo: m } });
    });
    refrescar();
    return null;
  });
}

/** Deshacer una cancelación (10 segundos en pantalla; 2 minutos de margen en el servidor). */
export async function deshacerCancelacion(pedidoId: string): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    const ultima = await db.auditoria.findFirst({ where: { entidad: "PedidoViaje", entidadId: pedidoId, accion: "pedido.cancelar" }, orderBy: { fecha: "desc" } });
    const p = await db.pedidoViaje.findUnique({ where: { id: pedidoId }, select: { estado: true, canceladoEn: true, tomadoPorId: true } });
    if (!p || p.estado !== "CANCELADO" || !ultima || ultima.usuarioId !== yo.id || !p.canceladoEn || Date.now() - p.canceladoEn.getTime() > 120_000) {
      throw new ErrorNegocio("Ya no se puede deshacer.");
    }
    const vuelveA = (ultima.antes as { estado?: string } | null)?.estado === "TOMADO" && p.tomadoPorId ? "TOMADO" : "PENDIENTE";
    await db.$transaction(async (tx) => {
      await tx.pedidoViaje.update({
        where: { id: pedidoId },
        data: { estado: vuelveA, motivoCancelacion: null, canceladoEn: null, ...(vuelveA === "PENDIENTE" ? { tomadoPorId: null, tomadoEn: null } : {}) },
      });
      // Vuelve su viaje (si quedó cancelado con él; si se había combinado con otros, ya siguió sin él).
      const pv = await tx.pedidoViaje.findUniqueOrThrow({ where: { id: pedidoId }, select: { viajeId: true } });
      if (vuelveA === "TOMADO" && pv.viajeId) await tx.viaje.updateMany({ where: { id: pv.viajeId, estado: "CANCELADO" }, data: conEtapa("PROGRAMADO") });
      if (vuelveA === "TOMADO") await programarRecordatorios(tx, [pedidoId]);
      // El material que se iba a retirar vuelve a "retiro pedido".
      await alCambiarElViaje(tx, pedidoId, "TOMADO", yo.id);
      await auditar(tx, { usuarioId: yo.id, accion: "pedido.deshacerCancelacion", entidadId: pedidoId, resumen: `${yo.nombre} deshizo la cancelación de ${await describirPedido(tx, pedidoId)}`, antes: { estado: "CANCELADO" }, despues: { estado: vuelveA } });
    });
    refrescar();
    return null;
  });
}

// ═══════════════════════════ Agregar parada / reordenar ═══════════════════════════

/**
 * "Agregar parada": suma pedidos a un viaje propio mientras está PROGRAMADO o en el primer tramo (todavía
 * no llegó a ninguna parada). Se rearman las paradas y se vuelve a calcular el orden.
 */
export async function agregarParadas(entrada: { pedidoId: string; extras: string[] }): Promise<Resultado<{ agregados: number }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("pedidos.tomar");
    const d = z.object({ pedidoId: z.string().min(1), extras: z.array(z.string().min(1)).min(1, "Elegí al menos un pedido.").max(10) }).parse(entrada);
    const r = await db.$transaction(async (tx) => {
      const v = await tx.viaje.findFirst({
        where: { pedidos: { some: { id: d.pedidoId } } },
        include: { pedidos: { select: { id: true, paraCuando: true } }, paradas: { select: { estado: true } }, vehiculo: { select: { nombre: true, capacidadCargaKg: true } } },
      });
      if (!v || v.choferId !== yo.id) throw new ErrorNegocio("Este viaje no es tuyo.");
      const empezo = v.paradas.some((p) => p.estado === "LLEGO" || p.estado === "COMPLETADA");
      if (!(v.estado === "PROGRAMADO" || (v.estado === "EN_CURSO" && !empezo))) throw new ErrorNegocio("Ya llegaste a la primera parada: no se pueden sumar más.");
      const extras = [...new Set(d.extras)].filter((id) => !v.pedidos.some((p) => p.id === id));
      await sumarAlViaje(tx, yo, v.pedidos, extras);
      const ids = [...v.pedidos.map((p) => p.id), ...extras];
      await validarViajeCombinado(tx, ids, v.vehiculo);
      await tx.pedidoViaje.updateMany({ where: { id: { in: extras } }, data: { viajeId: v.id } });
      await rearmarParadas(tx, v.id, ids);
      if (v.estado === "EN_CURSO") {
        await arrancarParadas(tx, v.id, null, new Date());
        await tx.pedidoViaje.updateMany({ where: { id: { in: extras } }, data: { estado: "EN_VIAJE" } });
      } else {
        await programarRecordatorios(tx, extras);
      }
      for (const id of extras) {
        await alCambiarElViaje(tx, id, v.estado === "EN_CURSO" ? "EN_VIAJE" : "TOMADO", yo.id);
        await auditar(tx, { usuarioId: yo.id, accion: "pedido.tomar", entidadId: id, resumen: `${yo.nombre} sumó ${await describirPedido(tx, id)} a su viaje con ${v.vehiculo.nombre} (${ids.length} pedidos)`, antes: { estado: "PENDIENTE" }, despues: { estado: "TOMADO", chofer: yo.nombre } });
        await notificarEvento(EVENTO.pedidoAceptado({ ...(await baseViaje(tx, id, yo.nombre)), choferId: yo.id, salida: v.salidaEstimada ?? new Date(), vehiculo: v.vehiculo.nombre, combinado: await textoCombinado(tx, id, v.id) }), { tx, actor: yo.id });
      }
      return { viajeId: v.id, agregados: extras.length };
    });
    await planificarOrden(r.viajeId);
    refrescar();
    return { agregados: r.agregados };
  });
}

/** "Reordenar": el chofer cambia el orden de las paradas (se valida que cada entrega vaya después de su retiro). */
export async function reordenarParadas(pedidoId: string, orden: string[]): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("pedidos.tomar");
    const v = await db.viaje.findFirst({ where: { pedidos: { some: { id: pedidoId } } }, select: { id: true, choferId: true, paradas: { orderBy: { orden: "asc" }, select: { nombre: true } } } });
    if (!v || v.choferId !== yo.id) throw new ErrorNegocio("Este viaje no es tuyo.");
    const error = await reordenar(v.id, z.array(z.string().min(1)).max(20).parse(orden));
    if (error) throw new ErrorNegocio(error);
    const nuevo = await db.viajeParada.findMany({ where: { viajeId: v.id }, orderBy: { orden: "asc" }, select: { nombre: true } });
    await auditar(db, { usuarioId: yo.id, accion: "viaje.reordenar", entidadId: pedidoId, resumen: `${yo.nombre} reordenó las paradas: ${nuevo.map((p) => p.nombre).join(" → ")}`, antes: { orden: v.paradas.map((p) => p.nombre) }, despues: { orden: nuevo.map((p) => p.nombre) } });
    refrescar();
    return null;
  });
}

// ═══════════════════════════ Fecha: adelantar y reprogramar ═══════════════════════════

/** "mañana (sábado 11/10)", "el lunes 13/10", "hoy". */
function elDia(d: Date) {
  const n = diasEntre(d);
  return n === 0 ? "hoy" : n === 1 ? `mañana (${diaSemana(d)} ${ddmm(d)})` : n === -1 ? "ayer" : `el ${diaSemana(d)} ${ddmm(d)}`;
}

/**
 * El chofer aceptó un viaje para otro día y lo puede hacer antes: avisa al que pidió y a Dirección
 * (push) para que lo reprogramen. No cambia nada por sí solo.
 */
export async function pedirAdelantar(pedidoId: string): Promise<Resultado<{ para: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("viajes.ejecutar");
    const p = await db.pedidoViaje.findUnique({ where: { id: pedidoId }, select: { estado: true, tomadoPorId: true, paraCuando: true } });
    if (!p || p.tomadoPorId !== yo.id || p.estado !== "TOMADO") throw new ErrorNegocio("Este viaje no es tuyo.");
    if (!bloqueoPorFecha(p.paraCuando)) throw new ErrorNegocio("Este viaje ya es para hoy: lo podés iniciar.");
    const para = elDia(p.paraCuando);
    await db.$transaction(async (tx) => {
      await notificarEvento(EVENTO.pedirAdelantar({ ...(await baseViaje(tx, pedidoId, yo.nombre)), para }), { tx, actor: yo.id });
      await auditar(tx, { usuarioId: yo.id, accion: "pedido.pedirAdelantar", entidadId: pedidoId, resumen: `${yo.nombre} pidió adelantar ${await describirPedido(tx, pedidoId)} (era para ${para})` });
    });
    return { para };
  });
}

const esquemaReprogramar = z
  .object({
    pedidoId: z.string().min(1),
    dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí el día."),
    franja: z.enum(["MANANA", "TARDE", "HORA_EXACTA"]),
    hora: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.franja === "HORA_EXACTA" && !d.hora) ctx.addIssue({ code: "custom", message: "Poné la hora.", path: ["hora"] });
  });
export type DatosReprogramar = z.input<typeof esquemaReprogramar>;

/**
 * Cambia la fecha de un pedido pendiente o aceptado (todavía sin salir). Lo pueden hacer Dirección y
 * quien lo pidió. Si ya tiene chofer, se le avisa y se reprograman sus recordatorios.
 */
export async function reprogramarPedido(entrada: DatosReprogramar): Promise<Resultado<{ para: string }>> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    const d = esquemaReprogramar.parse(entrada);
    const p = await db.pedidoViaje.findUnique({ where: { id: d.pedidoId }, select: { estado: true, solicitanteId: true, tomadoPorId: true, paraCuando: true, viaje: { select: { id: true, etapa: true } } } });
    if (!p) throw new ErrorNegocio("No existe ese pedido.");
    if (!puede(yo.rol, "pedidos.reprogramar") && p.solicitanteId !== yo.id) throw new ErrorNegocio("Solo quien lo pidió o Dirección pueden cambiar la fecha.");
    if (p.estado !== "PENDIENTE" && !(p.estado === "TOMADO" && (!p.viaje || p.viaje.etapa === "PROGRAMADO"))) throw new ErrorNegocio("El viaje ya salió: no se puede cambiar la fecha.");
    if (d.dia < diaISO()) throw new ErrorNegocio("El día ya pasó. Elegí hoy o una fecha futura.");
    const paraCuando = aFecha(d.dia, d.franja === "HORA_EXACTA" ? d.hora! : FRANJA[d.franja].hora);
    const antes = elDia(p.paraCuando);
    const ahora = elDia(paraCuando);
    await db.$transaction(async (tx) => {
      const r = await tx.pedidoViaje.updateMany({ where: { id: d.pedidoId, estado: p.estado }, data: { paraCuando, franja: d.franja, fechaNecesaria: aFecha(d.dia, "12:00") } });
      if (!r.count) throw new ErrorNegocio("El pedido cambió mientras lo reprogramabas. Volvé a intentar.");
      if (p.viaje && p.estado === "TOMADO") {
        await tx.viaje.update({ where: { id: p.viaje.id }, data: { salidaEstimada: paraCuando } });
        await cancelarRecordatorios(tx, [d.pedidoId]);
        await programarRecordatorios(tx, [d.pedidoId]);
      }
      await notificarEvento(EVENTO.pedidoReprogramado({ ...(await baseViaje(tx, d.pedidoId)), quien: yo.nombre, antes, ahora, choferId: p.estado === "TOMADO" ? p.tomadoPorId : null }), { tx, actor: yo.id });
      await auditar(tx, { usuarioId: yo.id, accion: "pedido.reprogramar", entidadId: d.pedidoId, resumen: `${yo.nombre} reprogramó ${await describirPedido(tx, d.pedidoId)}: era para ${antes}, ahora para ${ahora}`, antes: { paraCuando: p.paraCuando.toISOString() }, despues: { paraCuando: paraCuando.toISOString(), franja: d.franja } });
    });
    refrescar();
    return { para: ahora };
  });
}

// ═══════════════════════════ Reasignar (dirección) ═══════════════════════════

const esquemaReasignar = esquemaTomar.extend({ choferId: z.string().min(1, "Elegí el chofer.") });
export type DatosReasignar = z.input<typeof esquemaReasignar>;

export async function reasignarPedido(entrada: DatosReasignar): Promise<Resultado<{ chofer: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("pedidos.reasignar");
    const d = esquemaReasignar.parse(entrada);
    const r = await db.$transaction(async (tx) => {
      const pedido = await tx.pedidoViaje.findUnique({ where: { id: d.pedidoId }, include: { tomadoPor: { select: { nombre: true } } } });
      if (!pedido || !["PENDIENTE", "TOMADO"].includes(pedido.estado)) throw new ErrorNegocio("Solo se reasignan pedidos pendientes o tomados.");
      const { chofer, vehiculo } = await validarChoferYVehiculo(tx, d.choferId, d.vehiculoId, pedido);

      const cambio = await tx.pedidoViaje.updateMany({
        where: { id: pedido.id, estado: pedido.estado, tomadoPorId: pedido.tomadoPorId },
        data: { estado: "TOMADO", tomadoPorId: d.choferId, tomadoEn: new Date() },
      });
      if (!cambio.count) throw new ErrorNegocio("El pedido cambió mientras lo reasignabas. Probá de nuevo.");
      const salidaEstimada = salidaPara(pedido.paraCuando, d.salida);
      // Si ya tenía viaje programado, sale de ese (el viaje sigue con sus otros pedidos) y va en uno nuevo del chofer elegido.
      if (pedido.viajeId) await quitarDelViaje(tx, pedido.id);
      await crearViaje(tx, { pedidoIds: [pedido.id], vehiculoId: vehiculo.id, choferId: d.choferId, salidaEstimada, ordenRuta: await siguienteEnRuta(tx, d.choferId) });
      await alCambiarElViaje(tx, pedido.id, "TOMADO", yo.id);
      // Al que pidió y al chofer al que se lo asignaron (push a los dos).
      await notificarEvento(EVENTO.pedidoAceptado({ ...(await baseViaje(tx, pedido.id, chofer.nombre)), choferId: d.choferId, salida: salidaEstimada, vehiculo: vehiculo.nombre }), { tx, actor: yo.id });
      await auditar(tx, {
        usuarioId: yo.id, accion: "pedido.reasignar", entidadId: pedido.id,
        resumen: `${yo.nombre} le pasó ${await describirPedido(tx, pedido.id)} a ${chofer.nombre}${pedido.tomadoPor ? ` (lo tenía ${pedido.tomadoPor.nombre})` : ""}`,
        antes: { estado: pedido.estado, chofer: pedido.tomadoPor?.nombre ?? null }, despues: { estado: "TOMADO", chofer: chofer.nombre, vehiculo: vehiculo.nombre },
      });
      return { chofer: chofer.nombre };
    });
    refrescar();
    return r;
  });
}

// ═══════════════════════════ Ruta del día ═══════════════════════════

/** Sube o baja un viaje programado en la ruta del chofer. */
export async function moverEnRuta(viajeId: string, sentido: "arriba" | "abajo"): Promise<Resultado> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("pedidos.tomar");
    await db.$transaction(async (tx) => {
      const ruta = await tx.viaje.findMany({
        where: { choferId: yo.id, estado: "PROGRAMADO" },
        orderBy: [{ ordenRuta: { sort: "asc", nulls: "last" } }, { salidaEstimada: "asc" }],
        select: { id: true },
      });
      const i = ruta.findIndex((v) => v.id === viajeId);
      if (i < 0) throw new ErrorNegocio("Ese viaje no está en tu ruta.");
      const j = sentido === "arriba" ? i - 1 : i + 1;
      if (j < 0 || j >= ruta.length) return;
      [ruta[i], ruta[j]] = [ruta[j], ruta[i]];
      for (const [k, v] of ruta.entries()) await tx.viaje.update({ where: { id: v.id }, data: { ordenRuta: k + 1 } });
      const movido = await tx.viaje.findUniqueOrThrow({ where: { id: viajeId }, select: { pedidoId: true } });
      await auditar(tx, {
        usuarioId: yo.id, accion: "ruta.mover", entidadId: movido.pedidoId,
        resumen: `${yo.nombre} ${sentido === "arriba" ? "adelantó" : "atrasó"} en su ruta ${await describirPedido(tx, movido.pedidoId)}`,
      });
    });
    refrescar();
    return null;
  });
}

