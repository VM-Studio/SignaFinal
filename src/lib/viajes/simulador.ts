"use server";

import { revalidar } from "@/lib/revalidar";
import { db } from "@/lib/db";
import { exigirSesion } from "@/lib/auth/sesion";
import { modoDemo } from "@/lib/demo";
import { ejecutar, ErrorNegocio, type Resultado } from "@/lib/resultado";
import { distancia, puntoEn } from "@/lib/geo";
import { ETAPAS_EN_CURSO } from "./etapas";
import { baseDe, destinoDe, origenDe, registrarPosicion, rutaSegura } from "./tramos";
import { auditar } from "@/lib/auditoria";

const PASO_M = 1000;

/**
 * Modo demo (solo Dirección): mueve el vehículo 1 km por la ruta del tramo actual, para mostrar
 * el seguimiento en una reunión sin salir a la calle. Pasa por la misma lógica que el GPS real.
 */
export async function avanzarSimulado(pedidoId: string): Promise<Resultado<{ etapa: string; faltaM: number }>> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    if (!modoDemo() || yo.rol !== "DIRECCION") throw new ErrorNegocio("Solo en modo demo, para Dirección.");
    const v = await db.viaje.findFirst({
      where: { pedidoId, etapa: { in: ETAPAS_EN_CURSO } },
      include: { pedido: true, vehiculo: { select: { baseId: true } }, posiciones: { orderBy: { fecha: "desc" }, take: 1 } },
    });
    if (!v) throw new ErrorNegocio("Este viaje no está en curso.");
    const ultima = v.posiciones[0] ? { lat: v.posiciones[0].latitud, lng: v.posiciones[0].longitud } : null;
    // Cargando: arranca desde el punto de retiro hacia la obra (al alejarse, el viaje pasa solo a "en camino").
    const desde = v.etapa === "EN_RETIRO" ? origenDe(v.pedido) : ultima ?? (await baseDe(v.vehiculo)) ?? origenDe(v.pedido);
    const hasta = v.etapa === "HACIA_RETIRO" ? origenDe(v.pedido) : destinoDe(v.pedido);
    const ruta = await rutaSegura(desde, hasta);
    const linea = ruta.geometria.map(([lat, lng]) => ({ lat, lng }));
    const punto = ruta.distanciaM <= PASO_M ? hasta : puntoEn(linea, PASO_M).punto;
    const r = await registrarPosicion(v.id, punto, { fuente: "MOCK", velocidadKmh: 32, demo: true });
    await auditar(db, { usuarioId: yo.id, accion: "demo.avanzar", entidad: "PedidoViaje", entidadId: pedidoId, resumen: `${yo.nombre} avanzó 1 km la simulación del pedido #${v.pedido.numero}` });
    revalidar("pedidos");
    return { etapa: r?.etapa ?? v.etapa, faltaM: Math.round(distancia(punto, hasta)) };
  });
}

export type PasoDemo = "retiro" | "salio" | "destino";

/** Un punto a "m" metros de "a" en dirección a "b" (en línea recta). */
function haciaLaObra(a: { lat: number; lng: number }, b: { lat: number; lng: number }, m: number) {
  const f = Math.min(1, m / Math.max(1, distancia(a, b)));
  return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
}

/**
 * Modo demo (solo Dirección): inyecta posiciones falsas al MOTOR de viajes, para mostrar en una
 * reunión las cinco etapas sin salir a la calle. Es exactamente el mismo camino que el GPS real.
 * - "retiro": dos lecturas quieto en el punto de retiro → EN_RETIRO.
 * - "salio": una lectura a 400 m del retiro hacia la obra → HACIA_DESTINO.
 * - "destino": dos lecturas quieto en la obra → EN_DESTINO.
 */
export async function simularEtapa(pedidoId: string, paso: PasoDemo): Promise<Resultado<{ etapa: string }>> {
  return ejecutar(async () => {
    const yo = await exigirSesion();
    if (!modoDemo() || yo.rol !== "DIRECCION") throw new ErrorNegocio("Solo en modo demo, para Dirección.");
    const v = await db.viaje.findFirst({ where: { pedidos: { some: { id: pedidoId } }, etapa: { in: ETAPAS_EN_CURSO } }, include: { pedido: true } });
    if (!v) throw new ErrorNegocio("Este viaje no está en curso. Primero el chofer tiene que tocar \"Iniciar viaje\".");
    // La demo "teletransporta" el vehículo: se olvida la última lectura para que no cuente como salto imposible.
    const { estadoMotor } = await import("./motor");
    await db.viaje.update({ where: { id: v.id }, data: { motor: { ...estadoMotor(v), ultima: undefined, rechazo: undefined, demo: true } as object } });

    const retiro = origenDe(v.pedido);
    const obra = destinoDe(v.pedido);
    const lecturas: { punto: { lat: number; lng: number }; velocidadKmh: number }[] =
      paso === "retiro" ? [{ punto: retiro, velocidadKmh: 0 }, { punto: retiro, velocidadKmh: 0 }]
      // 600 m en línea recta hacia la obra: bien afuera del radio de salida (300 m).
      : paso === "salio" ? [{ punto: haciaLaObra(retiro, obra, 600), velocidadKmh: 25 }]
      : [{ punto: obra, velocidadKmh: 0 }, { punto: obra, velocidadKmh: 0 }];
    let r: Awaited<ReturnType<typeof registrarPosicion>> = null;
    for (const l of lecturas) {
      r = await registrarPosicion(v.id, l.punto, { fuente: "MOCK", velocidadKmh: l.velocidadKmh, demo: true });
      await db.vehiculo.update({ where: { id: v.vehiculoId }, data: { ultimaLat: l.punto.lat, ultimaLng: l.punto.lng, ultimaFechaGps: new Date(), ultimaVelocidad: l.velocidadKmh, ultimaDireccionTexto: null } });
      await new Promise((ok) => setTimeout(ok, 30)); // dos lecturas con fecha distinta
    }
    await auditar(db, { usuarioId: yo.id, accion: "demo.simular", entidad: "PedidoViaje", entidadId: pedidoId, resumen: `${yo.nombre} simuló "${{ retiro: "llegó al retiro", salio: "salió del retiro", destino: "llegó a destino" }[paso]}" en el pedido #${v.pedido.numero}` });
    revalidar("pedidos", "materiales");
    return { etapa: r?.etapa ?? v.etapa };
  });
}
