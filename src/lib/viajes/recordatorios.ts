import "server-only";
import type { Prisma, Recordatorio } from "@prisma/client";
import { db } from "@/lib/db";
import { aFecha, diaISO, finDelDia, inicioDelDia } from "@/lib/formato";
import { notificarEvento } from "@/lib/notificaciones/enviar";
import { EVENTO } from "@/lib/notificaciones/eventos";
import { PARAMETROS_RECORDATORIOS, sigueValiendo, TEXTO_RECORDATORIO, vigente, type ViajeRecordado } from "./recordatorios-plan";
import { DEL_VIAJE, programarRecordatorios } from "./recordatorios-agenda";

export { cancelarRecordatorios, programarRecordatorios } from "./recordatorios-agenda";

/** Los viajes aceptados de hoy y mañana que no tienen recordatorios (aceptados antes de que existiera esto). */
async function completarFaltantes(ahora: Date) {
  const hasta = finDelDia(new Date(ahora.getTime() + 86_400_000));
  const pedidos = await db.pedidoViaje.findMany({
    where: { estado: "TOMADO", paraCuando: { gte: inicioDelDia(ahora), lte: hasta }, viaje: { etapa: "PROGRAMADO" } },
    select: { id: true, tomadoPorId: true, paraCuando: true },
  });
  const faltan: string[] = [];
  for (const p of pedidos) {
    if (!p.tomadoPorId) continue;
    const hay = await db.recordatorio.count({ where: { entidadId: p.id, usuarioId: p.tomadoPorId, tipo: { in: [...DEL_VIAJE] } } });
    if (!hay) faltan.push(p.id);
  }
  if (faltan.length) await programarRecordatorios(db, faltan, { ahora });
  return faltan.length;
}

/** Toma el recordatorio para mandarlo (si dos corridas del cron se pisan, solo una lo manda). */
async function tomar(id: string, ahora: Date) {
  return (await db.recordatorio.updateMany({ where: { id, enviadoEn: null, canceladoEn: null }, data: { enviadoEn: ahora } })).count === 1;
}
const descartar = (ids: string[], ahora: Date) => (ids.length ? db.recordatorio.updateMany({ where: { id: { in: ids }, enviadoEn: null }, data: { canceladoEn: ahora } }) : null);

const seleccion = { id: true, origenTipo: true, origenNombre: true, destinoNombre: true, paraCuando: true, franja: true, estado: true, tomadoPorId: true, viaje: { select: { etapa: true } } } satisfies Prisma.PedidoViajeSelect;
type PedidoRec = Prisma.PedidoViajeGetPayload<{ select: typeof seleccion }>;
const aRecordado = (p: PedidoRec): ViajeRecordado => ({ origenTipo: p.origenTipo, origen: p.origenNombre, destino: p.destinoNombre, paraCuando: p.paraCuando, franja: p.franja });

/**
 * El job de cada minuto (/api/jobs/recordatorios): manda los recordatorios que llegaron a su hora y
 * siguen valiendo (el viaje sigue aceptado por ese chofer, sin iniciar y con la misma fecha). Los de
 * las 18:00 y las 7:00 de un mismo chofer salen en UN aviso con la lista en orden.
 */
export async function enviarRecordatorios(o: { ahora?: Date; soloUsuarioId?: string } = {}) {
  const ahora = o.ahora ?? new Date();
  // soloUsuarioId: para las pruebas (no toca los recordatorios de nadie más).
  const completados = o.soloUsuarioId ? 0 : await completarFaltantes(ahora);
  const debidos = await db.recordatorio.findMany({ where: { programadoPara: { lte: ahora }, enviadoEn: null, canceladoEn: null, tipo: { in: [...DEL_VIAJE] }, ...(o.soloUsuarioId ? { usuarioId: o.soloUsuarioId } : {}) }, orderBy: { programadoPara: "asc" } });
  const pedidos = new Map((await db.pedidoViaje.findMany({ where: { id: { in: [...new Set(debidos.map((r) => r.entidadId))] } }, select: seleccion })).map((p) => [p.id, p]));

  const valen: { r: Recordatorio; p: PedidoRec }[] = [];
  const noValen: string[] = [];
  for (const r of debidos) {
    const p = pedidos.get(r.entidadId);
    const ok = p && p.estado === "TOMADO" && p.tomadoPorId === r.usuarioId && p.viaje?.etapa === "PROGRAMADO" && sigueValiendo(r, p.paraCuando) && vigente(r, ahora);
    if (ok) valen.push({ r, p });
    else noValen.push(r.id);
  }
  await descartar(noValen, ahora);

  let enviados = 0;
  // 18:00 y 7:00: agrupados por chofer y tipo.
  for (const tipo of ["VIAJE_MANANA", "VIAJE_HOY"] as const) {
    const porChofer = new Map<string, { r: Recordatorio; p: PedidoRec }[]>();
    for (const x of valen.filter((x) => x.r.tipo === tipo)) porChofer.set(x.r.usuarioId, [...(porChofer.get(x.r.usuarioId) ?? []), x]);
    for (const [choferId, xs] of porChofer) {
      const tomados = [];
      for (const x of xs) if (await tomar(x.r.id, ahora)) tomados.push(x);
      if (!tomados.length) continue;
      const vs = tomados.map((x) => aRecordado(x.p));
      const texto = tipo === "VIAJE_MANANA" ? TEXTO_RECORDATORIO.manana(vs) : TEXTO_RECORDATORIO.hoy(vs);
      const dia = diaISO(tomados[0].p.paraCuando);
      await notificarEvento(EVENTO.recordatorioChofer({ choferId, ...texto, entidad: `recordatorio:${tipo}:${choferId}:${dia}`, enlace: tipo === "VIAJE_MANANA" ? "/hoy?vista=proximos" : "/hoy", pedidoIds: tomados.map((x) => x.p.id) }));
      enviados++;
    }
  }
  // "Todavía no iniciaste": uno por viaje (si se juntaron varios atrasados del mismo viaje, solo el último).
  const sinIniciar = valen.filter((x) => x.r.tipo === "VIAJE_SIN_INICIAR");
  for (const x of sinIniciar) {
    const posterior = sinIniciar.some((y) => y.p.id === x.p.id && y.r.programadoPara > x.r.programadoPara);
    if (posterior) {
      await descartar([x.r.id], ahora);
      continue;
    }
    if (!(await tomar(x.r.id, ahora))) continue;
    await notificarEvento(EVENTO.recordatorioChofer({ choferId: x.r.usuarioId, ...TEXTO_RECORDATORIO.sinIniciar(aRecordado(x.p)), entidad: `recordatorio:${x.r.claveUnica}`, enlace: `/viaje/${x.p.id}`, pedidoIds: [x.p.id] }));
    enviados++;
  }

  const resumen = o.soloUsuarioId ? null : await resumenDireccion(ahora);
  return { completados, debidos: debidos.length, descartados: noValen.length, enviados, resumen };
}

/** 9:00: a Dirección (bandeja), los viajes de hoy que todavía no salieron. Una vez por día. */
async function resumenDireccion(ahora: Date) {
  const dia = diaISO(ahora);
  const desde = aFecha(dia, PARAMETROS_RECORDATORIOS.resumenDireccion);
  if (ahora < desde || ahora.getTime() - desde.getTime() > PARAMETROS_RECORDATORIOS.vigenciaMs) return null;
  const direccion = await db.usuario.findFirst({ where: { rol: "DIRECCION", activo: true }, select: { id: true }, orderBy: { creadoEn: "asc" } });
  if (!direccion) return null;
  const claveUnica = `RESUMEN_DIRECCION:${dia}`;
  if (await db.recordatorio.findUnique({ where: { claveUnica }, select: { id: true } })) return null;
  try {
    await db.recordatorio.create({ data: { usuarioId: direccion.id, tipo: "RESUMEN_DIRECCION", entidadId: dia, programadoPara: desde, enviadoEn: ahora, claveUnica } });
  } catch {
    return null; // otra corrida ya lo mandó
  }
  const pedidos = await db.pedidoViaje.findMany({
    where: { estado: "TOMADO", paraCuando: { lte: finDelDia(ahora) }, viaje: { etapa: "PROGRAMADO" } },
    select: { ...seleccion, tomadoPor: { select: { nombre: true } } },
  });
  if (!pedidos.length) return 0;
  await notificarEvento(EVENTO.resumenDireccion({ ...TEXTO_RECORDATORIO.resumenDireccion(pedidos.map((p) => ({ ...aRecordado(p), chofer: p.tomadoPor?.nombre ?? "Sin chofer" }))), dia }));
  return pedidos.length;
}
