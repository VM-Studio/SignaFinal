import type { AreaAlerta, Severidad } from "@prisma/client";
import { db } from "@/lib/db";
import { diasHasta, fecha, km as fmtKm } from "@/lib/formato";

type AlertaCalculada = {
  clave: string;
  regla: string;
  area: AreaAlerta;
  severidad: Severidad;
  titulo: string;
  detalle: string;
  href: string;
};

const HORA = 60 * 60 * 1000;

/** Umbrales de cada regla. */
export const UMBRALES = {
  diasAvisoVencimiento: 30,
  kmAvisoService: 1000,
  horasPedidoUrgenteSinTomar: 2,
  horasPedidoSinTomar: 24,
  horasViajeDemorado: 6,
  horasSolicitudSinResolver: 24,
  diasMaquinaEnObra: 60,
};

function porVencer(
  vence: Date | null,
  { que, femenino, quien, ...base }: { clave: string; regla: string; area: AreaAlerta; href: string; que: string; femenino: boolean; quien: string },
): AlertaCalculada | null {
  if (!vence) {
    return { ...base, severidad: "AVISO", titulo: `${quien}: falta cargar vencimiento de ${que}`, detalle: `No hay fecha de vencimiento de ${que}.` };
  }
  const dias = diasHasta(vence);
  if (dias < 0) {
    return { ...base, severidad: "CRITICO", titulo: `${quien}: ${que} ${femenino ? "vencida" : "vencido"}`, detalle: `Venció el ${fecha(vence)}. No se puede usar para viajes hasta renovarlo.` };
  }
  if (dias <= UMBRALES.diasAvisoVencimiento) {
    const cuando = dias === 0 ? "vence hoy" : `vence en ${dias} día${dias === 1 ? "" : "s"}`;
    return { ...base, severidad: dias <= 7 ? "CRITICO" : "AVISO", titulo: `${quien}: ${que} ${cuando}`, detalle: `Vence el ${fecha(vence)}.` };
  }
  return null;
}

async function calcular(): Promise<AlertaCalculada[]> {
  const ahora = Date.now();
  const [vehiculos, choferes, pendientes, enViaje, solicitudes, enReparacion, maquinasEnObra] = await Promise.all([
    db.vehiculo.findMany({
      where: { activo: true },
      select: {
        id: true, nombre: true, seguroVence: true, vtvVence: true, kmActual: true,
        mantenimientos: { orderBy: { fecha: "desc" }, take: 1, select: { proximoKm: true, proximaFecha: true } },
      },
    }),
    db.usuario.findMany({ where: { activo: true, rol: "CHOFER" }, select: { id: true, nombre: true, licenciaVence: true } }),
    db.pedidoViaje.findMany({
      where: { estado: "PENDIENTE" },
      select: { id: true, numero: true, prioridad: true, creadoEn: true, obra: { select: { nombre: true } } },
    }),
    db.viaje.findMany({
      where: { estado: "EN_VIAJE" },
      select: { id: true, pedidoId: true, salidaEn: true, chofer: { select: { nombre: true } }, vehiculo: { select: { nombre: true } } },
    }),
    db.solicitudHerramienta.findMany({
      where: { estado: "PENDIENTE" },
      select: { id: true, tipo: true, creadaEn: true, item: { select: { nombre: true } }, obra: { select: { nombre: true } } },
    }),
    db.item.findMany({ where: { activo: true, estado: { not: "OPERATIVO" } }, select: { id: true, nombre: true, estado: true } }),
    db.item.findMany({
      where: { activo: true, control: "UNITARIA", categoria: "MAQUINARIA", obraId: { not: null } },
      select: { id: true, nombre: true, ubicadoDesde: true, obra: { select: { nombre: true } } },
    }),
  ]);

  const alertas: AlertaCalculada[] = [];
  const agregar = (a: AlertaCalculada | null) => a && alertas.push(a);

  for (const v of vehiculos) {
    const href = `/flota/${v.id}`;
    agregar(porVencer(v.seguroVence, { clave: `SEGURO:${v.id}`, regla: "SEGURO", area: "FLOTA", href, que: "seguro", femenino: false, quien: v.nombre }));
    agregar(porVencer(v.vtvVence, { clave: `VTV:${v.id}`, regla: "VTV", area: "FLOTA", href, que: "VTV", femenino: true, quien: v.nombre }));

    const ultimo = v.mantenimientos[0];
    if (ultimo?.proximoKm != null) {
      const faltan = ultimo.proximoKm - v.kmActual;
      if (faltan <= UMBRALES.kmAvisoService) {
        agregar({
          clave: `SERVICE_KM:${v.id}`, regla: "SERVICE_KM", area: "FLOTA", href,
          severidad: faltan <= 0 ? "CRITICO" : "AVISO",
          titulo: faltan <= 0 ? `${v.nombre}: service atrasado` : `${v.nombre}: service en ${fmtKm(faltan)}`,
          detalle: `Próximo service a los ${fmtKm(ultimo.proximoKm)}. Tiene ${fmtKm(v.kmActual)}.`,
        });
      }
    }
    if (ultimo?.proximaFecha) {
      const dias = diasHasta(ultimo.proximaFecha);
      if (dias <= 15) {
        agregar({
          clave: `SERVICE_FECHA:${v.id}`, regla: "SERVICE_FECHA", area: "FLOTA", href,
          severidad: dias < 0 ? "CRITICO" : "AVISO",
          titulo: dias < 0 ? `${v.nombre}: mantenimiento atrasado` : `${v.nombre}: mantenimiento en ${dias} días`,
          detalle: `Programado para el ${fecha(ultimo.proximaFecha)}.`,
        });
      }
    }
  }

  for (const c of choferes) {
    agregar(porVencer(c.licenciaVence, { clave: `LICENCIA:${c.id}`, regla: "LICENCIA", area: "PERSONAS", href: `/personas`, que: "licencia", femenino: true, quien: c.nombre }));
  }

  for (const p of pendientes) {
    const horas = (ahora - p.creadoEn.getTime()) / HORA;
    const limite = p.prioridad === "URGENTE" ? UMBRALES.horasPedidoUrgenteSinTomar : UMBRALES.horasPedidoSinTomar;
    if (horas >= limite) {
      agregar({
        clave: `PEDIDO_SIN_TOMAR:${p.id}`, regla: "PEDIDO_SIN_TOMAR", area: "PEDIDOS", href: `/pedidos/${p.id}`,
        severidad: p.prioridad === "URGENTE" ? "CRITICO" : "AVISO",
        titulo: `Pedido ${p.numero} para ${p.obra.nombre} sin tomar`,
        detalle: `${p.prioridad === "URGENTE" ? "Urgente. " : ""}Lleva ${Math.floor(horas)} h esperando chofer.`,
      });
    }
  }

  for (const v of enViaje) {
    const horas = (ahora - v.salidaEn.getTime()) / HORA;
    if (horas >= UMBRALES.horasViajeDemorado) {
      agregar({
        clave: `VIAJE_DEMORADO:${v.id}`, regla: "VIAJE_DEMORADO", area: "PEDIDOS", href: `/pedidos/${v.pedidoId}`,
        severidad: "AVISO",
        titulo: `${v.chofer.nombre} lleva ${Math.floor(horas)} h en viaje`,
        detalle: `Salió con ${v.vehiculo.nombre} y todavía no marcó la llegada.`,
      });
    }
  }

  for (const s of solicitudes) {
    const horas = (ahora - s.creadaEn.getTime()) / HORA;
    if (horas >= UMBRALES.horasSolicitudSinResolver) {
      agregar({
        clave: `SOLICITUD_PENDIENTE:${s.id}`, regla: "SOLICITUD_PENDIENTE", area: "DEPOSITO", href: `/deposito/solicitudes`,
        severidad: "AVISO",
        titulo: `${s.tipo === "PEDIDO" ? "Pedido" : "Devolución"} de ${s.item.nombre} sin resolver`,
        detalle: `Obra ${s.obra.nombre}. Lleva ${Math.floor(horas)} h.`,
      });
    }
  }

  for (const i of enReparacion) {
    agregar({
      clave: `ITEM_NO_OPERATIVO:${i.id}`, regla: "ITEM_NO_OPERATIVO", area: "DEPOSITO", href: `/deposito/${i.id}`,
      severidad: i.estado === "FUERA_DE_SERVICIO" ? "CRITICO" : "AVISO",
      titulo: `${i.nombre}: ${i.estado === "FUERA_DE_SERVICIO" ? "fuera de servicio" : "en reparación"}`,
      detalle: "No se puede entregar a obra hasta que vuelva a estar operativa.",
    });
  }

  for (const m of maquinasEnObra) {
    const dias = -diasHasta(m.ubicadoDesde);
    if (dias >= UMBRALES.diasMaquinaEnObra) {
      agregar({
        clave: `MAQUINA_EN_OBRA:${m.id}`, regla: "MAQUINA_EN_OBRA", area: "DEPOSITO", href: `/deposito/${m.id}`,
        severidad: "AVISO",
        titulo: `${m.nombre} lleva ${dias} días en ${m.obra?.nombre}`,
        detalle: "Confirmar si se sigue usando o hay que devolverla.",
      });
    }
  }

  return alertas;
}

/** Recalcula todas las alertas. Idempotente: se puede correr cuantas veces haga falta. */
export async function evaluarAlertas() {
  const calculadas = await calcular();
  const ahora = new Date();
  await db.$transaction(async (tx) => {
    for (const a of calculadas) {
      await tx.alerta.upsert({
        where: { clave: a.clave },
        create: a,
        update: { severidad: a.severidad, titulo: a.titulo, detalle: a.detalle, href: a.href, activa: true, resueltaEn: null },
      });
    }
    await tx.alerta.updateMany({
      where: { activa: true, clave: { notIn: calculadas.map((a) => a.clave) } },
      data: { activa: false, resueltaEn: ahora },
    });
  }, { timeout: 30_000 });
  return { activas: calculadas.length };
}
