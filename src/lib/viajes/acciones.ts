"use server";

import { revalidatePath } from "next/cache";
import { reevaluar } from "@/lib/alertas/reevaluar";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { auditar, describirPedido, validarChoferYVehiculo } from "@/lib/pedidos/reglas";
import { responsablePrincipal } from "@/lib/alcance";
import { conEtapa } from "./etapas";
import { baseDe, CARGA_S, destinoDe, origenDe, rutaSegura, salirDelRetiro } from "./tramos";
import { notificar } from "@/lib/avisos/notificar";
import { metros } from "@/lib/rutas";
import { finDelDia, hora } from "@/lib/formato";
import { guardarArchivo } from "@/lib/archivos";
import { km as fmtKm } from "@/lib/formato";
import { alLlegarElViaje } from "@/lib/herramientas/servicio";

/** Refresca pantallas y reevalúa las alertas del módulo (resuelve solas las que ya no aplican). */
const refrescar = () => {
  revalidatePath("/", "layout");
  reevaluar("pedidos", "flota", "herramientas");
};
const vacio = (v: unknown) => (v === "" || v === null ? undefined : v);

/** Hora real del evento: la del teléfono si se guardó sin señal (nunca en el futuro). */
function momento(ocurridoEn: Date | undefined, noAntesDe?: Date | null) {
  const ahora = new Date();
  if (!ocurridoEn || ocurridoEn > ahora) return ahora;
  if (noAntesDe && ocurridoEn < noAntesDe) return noAntesDe;
  return ocurridoEn;
}

// ═══════════════════════════ Iniciar ═══════════════════════════

/** Dónde estaba el teléfono al tocar el botón (si dio permiso de ubicación). */
const posicion = {
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  precisionM: z.coerce.number().min(0).optional(),
};

const esquemaInicio = z.object({
  clientId: z.string().uuid(),
  pedidoId: z.string().min(1),
  kmSalida: z.coerce.number({ error: "Poné los km del tablero." }).int("Los km van sin decimales.").min(0),
  ocurridoEn: z.coerce.date().optional(),
  ...posicion,
});
export type DatosInicio = z.input<typeof esquemaInicio>;

export async function iniciarViaje(entrada: DatosInicio): Promise<Resultado<{ vehiculo: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("viajes.ejecutar");
    const d = esquemaInicio.parse(entrada);

    // Idempotente: si el teléfono lo reenvía, no pasa nada.
    const ya = await db.viaje.findUnique({ where: { clientIdInicio: d.clientId }, select: { vehiculo: { select: { nombre: true } } } });
    if (ya) return { vehiculo: ya.vehiculo.nombre };

    // Ruta al punto de retiro desde donde está el teléfono (o la base del vehículo). Nunca traba: hay respaldo.
    const previo = await db.viaje.findUnique({ where: { pedidoId: d.pedidoId }, include: { vehiculo: { select: { baseId: true } }, pedido: true } });
    if (!previo) throw new ErrorNegocio("No existe ese viaje.");
    const gps = d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : null;
    const desde = gps ?? (await baseDe(previo.vehiculo)) ?? origenDe(previo.pedido);
    const [aRetiro, aDestino] = await Promise.all([rutaSegura(desde, origenDe(previo.pedido)), rutaSegura(origenDe(previo.pedido), destinoDe(previo.pedido))]);

    const r = await db.$transaction(async (tx) => {
      const viaje = await tx.viaje.findUnique({ where: { pedidoId: d.pedidoId }, include: { pedido: true } });
      if (!viaje || viaje.pedido.tomadoPorId !== yo.id || viaje.pedido.estado !== "TOMADO" || viaje.estado !== "PROGRAMADO") {
        throw new ErrorNegocio("Este viaje no está listo para salir.");
      }
      const enCurso = await tx.viaje.findFirst({ where: { estado: "EN_CURSO", OR: [{ choferId: yo.id }, { vehiculoId: viaje.vehiculoId }] }, select: { choferId: true } });
      if (enCurso) throw new ErrorNegocio(enCurso.choferId === yo.id ? "Ya tenés un viaje en curso. Terminalo antes de salir de nuevo." : "Ese vehículo está en otro viaje.");

      const { vehiculo } = await validarChoferYVehiculo(tx, yo.id, viaje.vehiculoId, viaje.pedido);
      if (d.kmSalida < vehiculo.kmActual) throw new ErrorNegocio(`${vehiculo.nombre} tiene registrados ${fmtKm(vehiculo.kmActual)}. Los km de salida no pueden ser menos.`);
      if (d.kmSalida > vehiculo.kmActual + 3000) throw new ErrorNegocio(`Son ${fmtKm(d.kmSalida - vehiculo.kmActual)} más que los registrados. Revisá el número.`);

      const salidaReal = momento(d.ocurridoEn);
      const etaRetiro = new Date(salidaReal.getTime() + aRetiro.duracionS * 1000);
      const etaDestino = new Date(etaRetiro.getTime() + (CARGA_S + aDestino.duracionS) * 1000);
      await tx.viaje.update({
        where: { id: viaje.id },
        data: {
          ...conEtapa("HACIA_RETIRO"), salidaReal, inicioEn: salidaReal, kmSalida: d.kmSalida, clientIdInicio: d.clientId,
          distanciaRetiroM: aRetiro.distanciaM, duracionRetiroS: aRetiro.duracionS, etaRetiro, etaDestino,
        },
      });
      if (gps) {
        await tx.posicionVehiculo.create({ data: { vehiculoId: viaje.vehiculoId, viajeId: viaje.id, usuarioId: yo.id, fuente: "TELEFONO", latitud: gps.lat, longitud: gps.lng, precisionM: d.precisionM ?? null, motorEncendido: true, fecha: salidaReal } });
      }
      await notificar({
        usuarioId: viaje.pedido.solicitanteId, tipo: "VIAJE_INICIADO",
        titulo: `${yo.nombre} salió a buscar tu pedido #${viaje.pedido.numero}`,
        cuerpo: `Va a ${viaje.pedido.origenNombre} (${metros(aRetiro.distanciaM)}). Llega a ${viaje.pedido.destinoNombre} a las ${hora(etaDestino)} aprox.`,
        enlace: `/mis-pedidos/${viaje.pedido.id}`, datos: { distanciaM: aRetiro.distanciaM + aDestino.distanciaM, eta: etaDestino.toISOString() },
      }, tx);
      await tx.pedidoViaje.update({ where: { id: d.pedidoId }, data: { estado: "EN_VIAJE" } });
      await tx.vehiculo.update({ where: { id: vehiculo.id }, data: { estado: "EN_VIAJE", kmActual: d.kmSalida } });
      await auditar(tx, { usuarioId: yo.id, accion: "viaje.iniciar", entidadId: d.pedidoId, resumen: `${yo.nombre} salió con ${vehiculo.nombre} para ${await describirPedido(tx, d.pedidoId)}`, antes: { estado: "TOMADO" }, despues: { estado: "EN_VIAJE", kmSalida: d.kmSalida, vehiculo: vehiculo.nombre } });
      return { vehiculo: vehiculo.nombre };
    });
    refrescar();
    return r;
  });
}

// ═══════════════════════════ Llegué al punto de retiro ═══════════════════════════

const esquemaTramo = z.object({ clientId: z.string().uuid(), pedidoId: z.string().min(1), ocurridoEn: z.coerce.date().optional(), ...posicion });
export type DatosTramo = z.input<typeof esquemaTramo>;

/** Botón 2: llegó a donde se carga. Calcula el tramo a la obra y le avisa al que pidió. Idempotente. */
export async function llegueAlRetiro(entrada: DatosTramo): Promise<Resultado<{ etapa: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("viajes.ejecutar");
    const d = esquemaTramo.parse(entrada);
    const v = await db.viaje.findUnique({ where: { pedidoId: d.pedidoId }, include: { pedido: true } });
    if (!v || v.choferId !== yo.id) throw new ErrorNegocio("Este viaje no es tuyo.");
    if (v.etapa !== "HACIA_RETIRO") {
      // Reenvío sin señal o doble toque: si ya pasó esta etapa, no hace nada.
      if (["EN_RETIRO", "HACIA_DESTINO", "FINALIZADO"].includes(v.etapa)) return { etapa: v.etapa };
      throw new ErrorNegocio("Primero iniciá el viaje.");
    }
    const aDestino = await rutaSegura(origenDe(v.pedido), destinoDe(v.pedido));
    const cuando = momento(d.ocurridoEn, v.inicioEn);
    const etaDestino = new Date(cuando.getTime() + (CARGA_S + aDestino.duracionS) * 1000);
    await db.$transaction(async (tx) => {
      const r = await tx.viaje.updateMany({
        where: { id: v.id, etapa: "HACIA_RETIRO" },
        data: { ...conEtapa("EN_RETIRO"), llegadaRetiroEn: cuando, distanciaDestinoM: aDestino.distanciaM, duracionDestinoS: aDestino.duracionS, etaDestino },
      });
      if (!r.count) return;
      await notificar({
        usuarioId: v.pedido.solicitanteId, tipo: "LLEGO_RETIRO",
        titulo: `${yo.nombre} está cargando en ${v.pedido.origenNombre}`,
        cuerpo: `Faltan ${metros(aDestino.distanciaM)} hasta ${v.pedido.destinoNombre}. Llega a las ${hora(etaDestino)} aprox.`,
        enlace: `/mis-pedidos/${v.pedido.id}`, datos: { distanciaM: aDestino.distanciaM, eta: etaDestino.toISOString() },
      }, tx);
      await auditar(tx, { usuarioId: yo.id, accion: "viaje.llegadaRetiro", entidadId: v.pedido.id, resumen: `${yo.nombre} llegó a ${v.pedido.origenNombre} a retirar ${await describirPedido(tx, v.pedido.id)}` });
    });
    refrescar();
    return { etapa: "EN_RETIRO" };
  });
}

/** Botón chico: "Salgo hacia el destino" (si no lo toca, lo hace el GPS al alejarse 300 m). */
export async function salgoHaciaDestino(entrada: DatosTramo): Promise<Resultado<{ etapa: string }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("viajes.ejecutar");
    const d = esquemaTramo.parse(entrada);
    const v = await db.viaje.findUnique({ where: { pedidoId: d.pedidoId }, select: { id: true, choferId: true, etapa: true, llegadaRetiroEn: true } });
    if (!v || v.choferId !== yo.id) throw new ErrorNegocio("Este viaje no es tuyo.");
    if (v.etapa !== "EN_RETIRO") return { etapa: v.etapa };
    await db.$transaction((tx) => salirDelRetiro(tx, v.id, momento(d.ocurridoEn, v.llegadaRetiroEn), false, yo.id));
    refrescar();
    return { etapa: "HACIA_DESTINO" };
  });
}

// ═══════════════════════════ Finalizar ═══════════════════════════

const esquemaFin = z.object({
  clientId: z.string().uuid(),
  pedidoId: z.string().min(1),
  kmLlegada: z.coerce.number({ error: "Poné los km del tablero." }).int("Los km van sin decimales.").min(0),
  peajes: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().min(0, "Los peajes no pueden ser negativos.").max(1_000_000)),
  observaciones: z.preprocess(vacio, z.string().trim().max(500).optional()),
  foto: z.preprocess(vacio, z.string().optional()), // data URL del remito
  ocurridoEn: z.coerce.date().optional(),
});
export type DatosFin = z.input<typeof esquemaFin>;

export type ResultadoFin = {
  km: number;
  costo: number;
  obra: string;
  /** Quién pidió: "Daniela ya sabe que llegó". */
  solicitante: string;
  siguiente: { pedidoId: string; descripcion: string; obra: string; origen: string; salida: string | null } | null;
};

export async function finalizarViaje(entrada: DatosFin): Promise<Resultado<ResultadoFin>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("viajes.ejecutar");
    const d = esquemaFin.parse(entrada);

    const r = await db.$transaction(async (tx) => {
      const viaje = await tx.viaje.findUnique({ where: { pedidoId: d.pedidoId }, include: { vehiculo: true, pedido: { include: { obra: true, solicitante: { select: { nombre: true } } } } } });
      if (!viaje) throw new ErrorNegocio("No existe ese viaje.");
      if (viaje.choferId !== yo.id) throw new ErrorNegocio("Este viaje no es tuyo.");

      // Reenvío del mismo cierre (sin señal): devolver lo ya calculado.
      if (viaje.clientIdFin === d.clientId) {
        return { km: (viaje.kmLlegada ?? 0) - (viaje.kmSalida ?? 0), costo: Number(viaje.costoCalculado ?? 0), obra: viaje.pedido.obra.nombre, solicitante: viaje.pedido.solicitante.nombre, siguiente: null };
      }
      if (viaje.estado !== "EN_CURSO") throw new ErrorNegocio(viaje.estado === "FINALIZADO" ? "Este viaje ya terminó." : "Este viaje todavía no salió.");
      const kmSalida = viaje.kmSalida ?? viaje.vehiculo.kmActual;
      if (d.kmLlegada < kmSalida) throw new ErrorNegocio(`Los km de llegada no pueden ser menores que los de salida (${fmtKm(kmSalida)}).`);
      const recorridos = d.kmLlegada - kmSalida;
      if (recorridos > 2000) throw new ErrorNegocio("Son más de 2.000 km en un viaje. Revisá el número.");

      // costo = km recorridos × costoKm del vehículo + peajes
      const peajes = new Prisma.Decimal(d.peajes);
      const costo = viaje.vehiculo.costoKm.mul(recorridos).add(peajes);
      const remitoUrl = d.foto ? await guardarArchivo(tx, d.foto, yo.id, `remito-pedido-${viaje.pedido.numero}`) : null;

      await tx.viaje.update({
        where: { id: viaje.id },
        data: {
          // Si la llegada ya la marcó el GPS (geocerca), vale esa hora.
          ...conEtapa("FINALIZADO"), llegadaReal: viaje.llegadaReal ?? momento(d.ocurridoEn, viaje.salidaReal), kmLlegada: d.kmLlegada, peajes, costoCalculado: costo,
          llegadaDestinoEn: viaje.llegadaDestinoEn ?? viaje.llegadaReal ?? momento(d.ocurridoEn, viaje.salidaReal),
          salidaRetiroEn: viaje.salidaRetiroEn ?? viaje.llegadaRetiroEn ?? viaje.salidaReal, etaDestino: null, etaRetiro: null,
          remitoUrl, observaciones: d.observaciones ?? null, clientIdFin: d.clientId,
        },
      });
      await tx.pedidoViaje.update({ where: { id: d.pedidoId }, data: { estado: "ENTREGADO" } });
      // Si el viaje llevaba una máquina o herramienta y nadie registró la entrega, queda en la obra.
      if (viaje.pedido.herramientaId) {
        await alLlegarElViaje(tx, { usuarioId: yo.id, viajeId: viaje.id, herramientaId: viaje.pedido.herramientaId, obraId: viaje.pedido.obraId, recibidoPorId: (await responsablePrincipal(tx, viaje.pedido.obraId))?.id ?? null });
      }
      await tx.vehiculo.update({
        where: { id: viaje.vehiculoId },
        data: { kmActual: Math.max(viaje.vehiculo.kmActual, d.kmLlegada), ...(viaje.vehiculo.estado === "EN_VIAJE" ? { estado: "DISPONIBLE" } : {}) },
      });
      const llego = viaje.llegadaDestinoEn ?? viaje.llegadaReal ?? momento(d.ocurridoEn, viaje.salidaReal);
      await notificar({
        usuarioId: viaje.pedido.solicitanteId, tipo: "LLEGO_DESTINO",
        titulo: `Llegó tu pedido #${viaje.pedido.numero} a Obra ${viaje.pedido.obra.nombre}`,
        cuerpo: `${yo.nombre} lo entregó a las ${hora(llego)}.`,
        enlace: `/mis-pedidos/${viaje.pedido.id}`, datos: { distanciaM: 0, eta: llego.toISOString() },
      }, tx);
      await auditar(tx, {
        usuarioId: yo.id, accion: "viaje.finalizar", entidadId: d.pedidoId,
        resumen: `${yo.nombre} entregó ${await describirPedido(tx, d.pedidoId)}: ${recorridos} km`,
        antes: { estado: "EN_VIAJE" }, despues: { estado: "ENTREGADO", kmLlegada: d.kmLlegada, km: recorridos, peajes: d.peajes, costo: costo.toString(), obra: viaje.pedido.obra.nombre },
      });

      // Lo que sigue en su ruta.
      // Lo que sigue hoy en su ruta.
      const sig = await tx.viaje.findFirst({
        where: { choferId: yo.id, estado: "PROGRAMADO", pedido: { estado: "TOMADO", paraCuando: { lte: finDelDia() } } },
        orderBy: [{ ordenRuta: { sort: "asc", nulls: "last" } }, { salidaEstimada: "asc" }],
        include: { pedido: { include: { obra: { select: { nombre: true } } } } },
      });
      return {
        km: recorridos,
        costo: costo.toNumber(),
        obra: viaje.pedido.obra.nombre,
        solicitante: viaje.pedido.solicitante.nombre,
        siguiente: sig ? { pedidoId: sig.pedidoId, descripcion: sig.pedido.descripcion, obra: sig.pedido.obra.nombre, origen: sig.pedido.origenNombre, salida: sig.salidaEstimada ? hora(sig.salidaEstimada) : null } : null,
      };
    });
    refrescar();
    return r;
  });
}

// ═══════════════════════════ Combustible ═══════════════════════════

const esquemaCarga = z.object({
  clientId: z.string().uuid(),
  vehiculoId: z.string().min(1, "Elegí el vehículo."),
  litros: z.coerce.number({ error: "Poné los litros." }).positive("Los litros tienen que ser más de cero.").max(600, "Revisá los litros."),
  monto: z.coerce.number({ error: "Poné cuánto pagaste." }).positive("Poné cuánto pagaste.").max(5_000_000),
  km: z.preprocess(vacio, z.coerce.number().int().min(0).optional()),
  foto: z.preprocess(vacio, z.string().optional()),
  ocurridoEn: z.coerce.date().optional(),
});
export type DatosCarga = z.input<typeof esquemaCarga>;

export async function registrarCarga(entrada: DatosCarga): Promise<Resultado<{ obra: string | null }>> {
  return ejecutar(async () => {
    const yo = await exigirPermiso("combustible.cargar");
    const d = esquemaCarga.parse(entrada);
    const ya = await db.cargaCombustible.findUnique({ where: { clientId: d.clientId }, select: { obra: { select: { nombre: true } } } });
    if (ya) return { obra: ya.obra?.nombre ?? null };

    const r = await db.$transaction(async (tx) => {
      const v = await tx.vehiculo.findUnique({ where: { id: d.vehiculoId } });
      if (!v || !v.activo) throw new ErrorNegocio("Ese vehículo no está activo.");
      if (d.km != null && d.km < v.kmActual - 2000) throw new ErrorNegocio(`${v.nombre} tiene ${fmtKm(v.kmActual)}. Revisá el número.`);
      if (d.km != null && d.km > v.kmActual + 3000) throw new ErrorNegocio(`Son ${fmtKm(d.km - v.kmActual)} más que los registrados. Revisá el número.`);

      // Si el vehículo está en un viaje, la carga se imputa a esa obra.
      const enViaje = await tx.viaje.findFirst({ where: { vehiculoId: v.id, estado: "EN_CURSO" }, select: { pedido: { select: { obraId: true, obra: { select: { nombre: true } } } } } });
      const comprobanteUrl = d.foto ? await guardarArchivo(tx, d.foto, yo.id, `ticket-${v.patente}`) : null;
      const c = await tx.cargaCombustible.create({
        data: {
          clientId: d.clientId, vehiculoId: v.id, usuarioId: yo.id, fecha: momento(d.ocurridoEn),
          litros: new Prisma.Decimal(d.litros), monto: new Prisma.Decimal(d.monto), km: d.km ?? v.kmActual,
          comprobanteUrl, obraId: enViaje?.pedido.obraId ?? null,
        },
      });
      if (d.km != null && d.km > v.kmActual) await tx.vehiculo.update({ where: { id: v.id }, data: { kmActual: d.km } });
      await auditar(tx, { usuarioId: yo.id, accion: "combustible.cargar", entidad: "CargaCombustible", entidadId: c.id, resumen: `${yo.nombre} cargó ${d.litros} l en ${v.nombre}${enViaje ? ` (Obra ${enViaje.pedido.obra.nombre})` : ""}`, despues: { vehiculo: v.nombre, litros: d.litros, monto: d.monto, obra: enViaje?.pedido.obra.nombre ?? null } });
      return { obra: enViaje?.pedido.obra.nombre ?? null };
    });
    refrescar();
    return r;
  });
}
