import "server-only";
import type { EtapaViaje, Franja, Prisma, TipoPedido } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { conAlcance, viajesVisibles } from "@/lib/alcance";
import { finDelDia } from "@/lib/formato";
import { vehiculosParaTomar } from "@/lib/pedidos/consultas";
import { ETAPAS_EN_CURSO } from "./etapas";
import { estadoMotor, pendientes, senalDe } from "./motor";
import { PARAMETROS_MOTOR } from "./parametros";
import { baseDe, rutaSegura } from "./tramos";
import { textoLlegue, textoSalgo, type LugarManual } from "./manual";
import type { Punto } from "@/lib/geo";

/** Lo que muestra cada tarjeta del chofer, en el orden en que se lee. */
export type Tarjeta = {
  pedidoId: string;
  numero: number;
  /** paraCuando del pedido (nunca la fecha de aceptación): lo que se muestra grande arriba. */
  fecha: Date;
  franja: Franja;
  /** Ya salió (o terminó): una fecha pasada no es "atrasado". */
  iniciado: boolean;
  salidaEstimada: Date | null;
  retirar: { nombre: string; direccion: string };
  entregar: { nombre: string; direccion: string };
  que: string;
  pidio: string;
  pesoKg: number | null;
  necesitaCamion: boolean;
  urgente: boolean;
  vehiculo: string | null;
  etapa: EtapaViaje | null;
  km: number | null;
  kmActual: number;
  kmSalida: number | null;
  /** Retiro de material habilitado por Compras: horario, contacto y OC, bien visibles. */
  retiro: { horario: string | null; contacto: string | null; oc: string | null } | null;
  tipo: TipoPedido;
  /** Viaje combinado: "3 pedidos · 4 paradas · 31 km" y las obras. */
  combinado: { pedidos: number; paradas: number; km: number | null; obras: string[] } | null;
  viajeId: string | null;
};

const seleccion = {
  id: true, numero: true, descripcion: true, paraCuando: true, franja: true, pesoKg: true, necesitaCamion: true, prioridad: true, tipo: true,
  origenNombre: true, origenDireccion: true, destinoNombre: true, destinoDireccion: true, esRetiroMaterial: true, ordenCompraLebane: true,
  materialesListos: { where: { estado: { not: "CANCELADO" } }, select: { descripcion: true, horarioRetiro: true, contactoRetiro: true, ordenCompraNumero: true } },
  solicitante: { select: { nombre: true } },
  viaje: {
    select: {
      id: true, pedidoId: true, etapa: true, estado: true, salidaEstimada: true, kmSalida: true, kmLlegada: true, llegadaReal: true, distanciaTotalM: true,
      vehiculo: { select: { nombre: true, kmActual: true } }, _count: { select: { paradas: true } }, pedidos: { select: { obra: { select: { nombre: true } } } },
    },
  },
} satisfies Prisma.PedidoViajeSelect;

const juntar = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].join(" / ") || null;

function tarjeta(p: Prisma.PedidoViajeGetPayload<{ select: typeof seleccion }>): Tarjeta {
  const v = p.viaje && p.viaje.estado !== "CANCELADO" ? p.viaje : null;
  const ml = p.esRetiroMaterial ? p.materialesListos : [];
  return {
    pedidoId: p.id, numero: p.numero,
    fecha: p.paraCuando, franja: p.franja, iniciado: !!v && v.etapa !== "PROGRAMADO", salidaEstimada: v?.salidaEstimada ?? null,
    retirar: { nombre: p.origenNombre, direccion: p.origenDireccion },
    entregar: { nombre: p.destinoNombre, direccion: p.destinoDireccion },
    que: ml.length ? ml.map((m) => m.descripcion).join(" + ") : p.descripcion, pidio: p.solicitante.nombre, pesoKg: p.pesoKg, necesitaCamion: p.necesitaCamion, urgente: p.prioridad === "URGENTE",
    vehiculo: v?.vehiculo.nombre ?? null, etapa: v?.etapa ?? null,
    km: v?.kmLlegada != null && v.kmSalida != null ? v.kmLlegada - v.kmSalida : null,
    kmActual: v?.vehiculo.kmActual ?? 0,
    kmSalida: v?.kmSalida ?? null,
    retiro: p.esRetiroMaterial
      ? { horario: juntar(ml.map((m) => m.horarioRetiro)), contacto: juntar(ml.map((m) => m.contactoRetiro)), oc: juntar(ml.map((m) => m.ordenCompraNumero?.replace(/^\s*(OC)?\s*#?\s*/i, "") ?? null)) ?? p.ordenCompraLebane }
      : null,
    tipo: p.tipo,
    combinado: v && v.pedidos.length > 1
      ? { pedidos: v.pedidos.length, paradas: v._count.paradas, km: v.distanciaTotalM != null ? Math.round(v.distanciaTotalM / 1000) : null, obras: [...new Set(v.pedidos.map((x) => x.obra.nombre))] }
      : null,
    viajeId: v?.id ?? null,
  };
}

/** Un viaje combinado es UNA tarjeta (la del pedido principal), no una por pedido. */
function unaPorViaje(filas: Prisma.PedidoViajeGetPayload<{ select: typeof seleccion }>[]) {
  const vistos = new Set<string>();
  return filas.filter((p) => {
    const v = p.viaje && p.viaje.estado !== "CANCELADO" ? p.viaje : null;
    if (!v || v.pedidos.length <= 1) return true;
    if (vistos.has(v.id)) return false;
    vistos.add(v.id);
    return true;
  }).map((p) => {
    const v = p.viaje;
    // La tarjeta lleva la fecha más temprana del viaje y el pedido principal.
    const principal = v && v.pedidos.length > 1 ? filas.find((q) => q.id === v.pedidoId) ?? p : p;
    return principal;
  });
}

const ordenSalida = (a: Tarjeta, b: Tarjeta) => a.fecha.getTime() - b.fecha.getTime();

/**
 * Los viajes del chofer. "hoy": el que está en curso primero, después los aceptados para hoy por
 * hora de salida. "proximos": aceptados para después de hoy. "todos": historial con buscador por obra.
 */
export async function viajesDelChofer(vista: "hoy" | "proximos" | "todos", f: { q?: string; pagina?: number } = {}) {
  const u = await exigirPermiso("viajes.verPropios");
  const mios = { tomadoPorId: u.id, viaje: { choferId: u.id } } satisfies Prisma.PedidoViajeWhereInput;
  if (vista === "todos") {
    const pagina = Math.max(1, f.pagina ?? 1);
    const where = conAlcance(u, { ...mios, ...(f.q ? { destinoNombre: { contains: f.q, mode: "insensitive" } } : {}) });
    const [filas, total] = await Promise.all([
      db.pedidoViaje.findMany({ where, select: seleccion, orderBy: { paraCuando: "desc" }, skip: (pagina - 1) * 20, take: 20 }),
      db.pedidoViaje.count({ where }),
    ]);
    return { tarjetas: unaPorViaje(filas).map(tarjeta), total, paginas: Math.max(1, Math.ceil(total / 20)) };
  }
  // El día del viaje es SIEMPRE el del pedido (paraCuando), no el de la aceptación.
  const fin = finDelDia();
  const where =
    vista === "hoy"
      ? conAlcance(u, { ...mios, OR: [{ estado: "EN_VIAJE" }, { estado: "TOMADO", paraCuando: { lte: fin } }] })
      : conAlcance(u, { ...mios, estado: "TOMADO", paraCuando: { gt: fin } });
  const tarjetas = unaPorViaje(await db.pedidoViaje.findMany({ where, select: seleccion, take: 100 })).map(tarjeta);
  // Hoy: el que está en curso, después los atrasados (en rojo) y los de hoy por hora.
  const enCurso = tarjetas.filter((t) => t.etapa && ETAPAS_EN_CURSO.includes(t.etapa));
  return { tarjetas: [...enCurso, ...tarjetas.filter((t) => !enCurso.includes(t)).sort(ordenSalida)], total: tarjetas.length, paginas: 1 };
}

export const FILTROS_SOLICITUDES = { todas: "Todas", hoy: "Hoy", camion: "Necesitan camión" } as const;
export type FiltroSolicitudes = keyof typeof FILTROS_SOLICITUDES;

/** Solicitudes pendientes de cualquiera: urgentes primero, después por fecha necesaria. Con los vehículos para aceptar. */
export async function solicitudesPendientes(filtro: FiltroSolicitudes, limite = 50) {
  const u = await exigirPermiso("pedidos.tomar");
  const extra: Prisma.PedidoViajeWhereInput = filtro === "hoy" ? { paraCuando: { lte: finDelDia() } } : filtro === "camion" ? { necesitaCamion: true } : {};
  const filas = await db.pedidoViaje.findMany({
    where: conAlcance(u, { estado: "PENDIENTE", ...extra }),
    select: seleccion,
    orderBy: [{ prioridad: "desc" }, { fechaNecesaria: { sort: "asc", nulls: "last" } }, { paraCuando: "asc" }, { creadoEn: "asc" }],
    take: limite + 1,
  });
  const pagina = filas.slice(0, limite);
  const vehiculos = await Promise.all(pagina.map((p) => vehiculosParaTomar(p)));
  return { lista: pagina.map((p, i) => ({ ...tarjeta(p), vehiculos: vehiculos[i] })), hayMas: filas.length > limite };
}

/** La última solicitud nueva (para el indicador de la barra del chofer). */
export async function ultimaSolicitud() {
  const u = await exigirPermiso("pedidos.tomar");
  const p = await db.pedidoViaje.findFirst({ where: conAlcance(u, { estado: "PENDIENTE" }), orderBy: { creadoEn: "desc" }, select: { creadoEn: true } });
  // Nunca en el futuro (datos cargados a mano con hora adelantada no deben dejar el indicador prendido).
  return p ? new Date(Math.min(p.creadoEn.getTime(), Date.now())) : null;
}

export async function tengoViajeEnCurso() {
  const u = await exigirPermiso("viajes.verPropios");
  return (await db.viaje.count({ where: { ...viajesVisibles(u), choferId: u.id, etapa: { in: ETAPAS_EN_CURSO } } })) > 0;
}

/**
 * La pantalla del viaje, por paradas: la parada actual (a dónde va, distancia, lista de verificación),
 * la lista numerada de todas con su estado y los km. Null si el viaje no es del chofer.
 */
export async function pantallaViaje(pedidoId: string) {
  const u = await exigirPermiso("viajes.ejecutar");
  const p = await db.pedidoViaje.findFirst({
    where: conAlcance(u, { id: pedidoId, tomadoPorId: u.id }),
    select: {
      id: true, numero: true, paraCuando: true, franja: true,
      viaje: {
        include: {
          vehiculo: { select: { nombre: true, patente: true, kmActual: true, baseId: true, ultimaLat: true, ultimaLng: true, ultimaFechaGps: true } },
          paradas: { orderBy: { orden: "asc" }, include: { items: { orderBy: [{ obraNombre: "asc" }, { id: "asc" }] } } },
          viajePedidos: { orderBy: { orden: "asc" }, select: { paradaRetiroId: true, paradaEntregaId: true, pedido: { select: { id: true, numero: true, descripcion: true, pesoKg: true, paraCuando: true, franja: true, esRetiroMaterial: true, ordenCompraLebane: true, obra: { select: { nombre: true } }, solicitante: { select: { nombre: true } }, materialesListos: { where: { estado: { not: "CANCELADO" } }, select: { descripcion: true, horarioRetiro: true, contactoRetiro: true, ordenCompraNumero: true } } } } } },
        },
      },
    },
  });
  if (!p?.viaje || p.viaje.choferId !== u.id || p.viaje.estado === "CANCELADO") return null;
  const v = p.viaje;
  const vh = v.vehiculo;
  // Dónde está el vehículo ahora (Cusat o el teléfono, lo último que llegó en los últimos 5 minutos).
  const ultima: Punto | null = vh.ultimaLat != null && vh.ultimaLng != null && vh.ultimaFechaGps && Date.now() - vh.ultimaFechaGps.getTime() < PARAMETROS_MOTOR.sinSenalMs ? { lat: vh.ultimaLat, lng: vh.ultimaLng } : null;
  const faltan = pendientes(v.paradas);
  const actual = v.estado === "FINALIZADO" ? null : faltan[0] ?? null;
  const hasta = actual ? { lat: actual.latitud, lng: actual.longitud } : null;
  const desde = ultima ?? (await baseDe(v.vehiculo));
  // Antes de salir no se pide la ruta (la pantalla carga al instante). Solo distancia: sin tránsito no hay minutos.
  const ruta = v.estado === "EN_CURSO" && actual && actual.estado !== "LLEGO" && hasta && desde ? await rutaSegura(desde, hasta, { transito: false }) : null;

  // Llegada que detectó el GPS (o a otra parada antes que la que tocaba) que el chofer puede negar.
  const pendiente = estadoMotor(v).pendiente;
  const pend = pendiente && new Date(pendiente.hasta) > new Date() ? v.paradas.find((x) => x.id === pendiente.clave && x.estado === "LLEGO") : null;
  const confirmar = pend ? { lugar: pend.nombre, adelantadaDe: pendiente?.adelantadaDe ?? null } : null;
  const senal = v.estado === "EN_CURSO" ? await senalDe(v.vehiculoId, null) : null;

  // Botón manual: siempre de la parada actual, con la palabra del lugar ("Llegué al proveedor").
  const etiqueta = actual?.lugarId && (actual.lugarTipo === "DEPOSITO" || actual.lugarTipo === "BASE") ? (await db.ubicacion.findUnique({ where: { id: actual.lugarId }, select: { etiqueta: true } }))?.etiqueta : null;
  const lugarManual: LugarManual = { lugarTipo: actual?.lugarTipo ?? "OBRA", etiqueta };
  const manual = { paradaId: actual?.id ?? null, llegue: textoLlegue(lugarManual), salgo: textoSalgo(lugarManual) };
  const sinGps = !!senal && (!senal.fecha || Date.now() - new Date(senal.fecha).getTime() > PARAMETROS_MOTOR.sinGpsManualMs);
  const enCursoOtro = v.estado === "PROGRAMADO" ? await db.viaje.count({ where: { choferId: u.id, estado: "EN_CURSO" } }) : 0;
  const siguiente =
    v.estado === "FINALIZADO"
      ? await db.pedidoViaje.findFirst({
          where: conAlcance(u, { tomadoPorId: u.id, estado: "TOMADO", paraCuando: { lte: finDelDia() } }),
          orderBy: [{ viaje: { ordenRuta: { sort: "asc", nulls: "last" } } }, { paraCuando: "asc" }],
          select: seleccion,
        })
      : null;

  const pedidos = v.viajePedidos.map((x) => {
    const q = x.pedido;
    const ml = q.esRetiroMaterial ? q.materialesListos : [];
    return {
      id: q.id, numero: q.numero, que: ml.length ? ml.map((m) => m.descripcion).join(" + ") : q.descripcion, pidio: q.solicitante.nombre, obra: q.obra.nombre, pesoKg: q.pesoKg,
      paradaRetiroId: x.paradaRetiroId, paradaEntregaId: x.paradaEntregaId,
      retiro: q.esRetiroMaterial ? { horario: juntar(ml.map((m) => m.horarioRetiro)), contacto: juntar(ml.map((m) => m.contactoRetiro)), oc: juntar(ml.map((m) => m.ordenCompraNumero)) ?? q.ordenCompraLebane } : null,
    };
  });
  const paradas = v.paradas.map((x) => {
    const deAca = pedidos.filter((q) => (x.tipo === "RETIRO" ? q.paradaRetiroId === x.id : q.paradaEntregaId === x.id));
    return {
      id: x.id, orden: x.orden, tipo: x.tipo, lugarTipo: x.lugarTipo, nombre: x.nombre, direccion: x.direccion, lat: x.latitud, lng: x.longitud, estado: x.estado,
      distanciaDesdeAnteriorM: x.distanciaDesdeAnteriorM, remito: !!x.remitoUrl,
      obras: [...new Set(deAca.map((q) => q.obra))], pedidos: deAca.map((q) => q.numero),
      // Datos de retiro de Compras (horario, contacto, OC) de lo que se carga acá.
      retiro: x.tipo === "RETIRO" ? deAca.map((q) => q.retiro).filter(Boolean).reduce<{ horario: string | null; contacto: string | null; oc: string | null } | null>((acc, r) => ({ horario: juntar([acc?.horario ?? null, r!.horario]), contacto: juntar([acc?.contacto ?? null, r!.contacto]), oc: juntar([acc?.oc ?? null, r!.oc]) }), null) : null,
      items: x.items.map((it) => ({ id: it.id, descripcion: it.descripcion, cantidad: it.cantidad?.toNumber() ?? null, unidad: it.unidad, oc: it.ordenCompraNumero, obra: it.obraNombre, marcado: it.marcado, faltante: it.faltante, cantidadReal: it.cantidadReal?.toNumber() ?? null, nota: it.nota })),
    };
  });
  // Google Maps: todas las paradas que faltan como waypoints, en orden (máximo 9).
  const proximas = faltan.filter((x) => x.estado !== "LLEGO").slice(0, 9);
  const maps = proximas.length
    ? `https://www.google.com/maps/dir/?api=1&destination=${proximas[proximas.length - 1].latitud},${proximas[proximas.length - 1].longitud}${proximas.length > 1 ? `&waypoints=${encodeURIComponent(proximas.slice(0, -1).map((x) => `${x.latitud},${x.longitud}`).join("|"))}` : ""}&travelmode=driving`
    : null;
  const empezo = v.paradas.some((x) => x.estado === "LLEGO" || x.estado === "COMPLETADA");
  return {
    pedidoId: p.id, numero: p.numero, viajeId: v.id, estado: v.estado, etapa: v.etapa,
    vehiculo: vh.nombre, patente: vh.patente, kmActual: vh.kmActual, kmSalida: v.kmSalida,
    kmRecorridos: v.kmLlegada != null && v.kmSalida != null ? v.kmLlegada - v.kmSalida : null,
    paraCuando: new Date(Math.min(...v.viajePedidos.map((x) => x.pedido.paraCuando.getTime()), p.paraCuando.getTime())), franja: p.franja, salidaEstimada: v.salidaEstimada,
    pedidos, paradas, actualId: actual?.id ?? null,
    totalM: v.distanciaTotalM ?? paradas.reduce((t, x) => t + (x.distanciaDesdeAnteriorM ?? 0), 0),
    pesoKg: pedidos.reduce((t, q) => t + (q.pesoKg ?? 0), 0),
    tramo: ruta && desde && hasta ? { desde, hasta, distanciaM: ruta.distanciaM, geometria: ruta.geometria, estimada: ruta.fuente === "estimada" } : null,
    // Hora de llegada solo con tránsito real (Google).
    eta: actual ? (actual.tipo === "RETIRO" ? v.etaRetiro : v.etaDestino) : null,
    maps, confirmar, senal, manual, sinGps,
    otroEnCurso: enCursoOtro > 0,
    puedeAgregar: v.estado === "PROGRAMADO" || (v.estado === "EN_CURSO" && !empezo),
    puedeReordenar: v.estado !== "FINALIZADO" && faltan.filter((x) => x.estado !== "LLEGO").length > 1,
    fijas: v.paradas.filter((x) => x.estado === "COMPLETADA" || x.estado === "SALTEADA" || x.estado === "LLEGO").length,
    siguiente: siguiente ? tarjeta(siguiente) : null,
  };
}

export type PantallaViaje = NonNullable<Awaited<ReturnType<typeof pantallaViaje>>>;
