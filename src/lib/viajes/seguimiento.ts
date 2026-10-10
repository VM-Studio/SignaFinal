import "server-only";
import type { EtapaViaje } from "@prisma/client";
import { db } from "@/lib/db";
import type { UsuarioSesion } from "@/lib/auth/sesion";
import { conAlcance } from "@/lib/alcance";
import { hora } from "@/lib/formato";
import { metros } from "@/lib/rutas/formato";
import { textoParaCuando } from "@/lib/pedidos/presentacion";
import { destinoDe, origenDe, rutaSegura } from "./tramos";

export type DatosSeguimiento = {
  etapa: EtapaViaje | null;
  estado: string;
  chofer: { nombre: string; telefono: string | null } | null;
  vehiculo: string | null;
  /** Aceptado · Salió · En el retiro · En camino · Entregado (fecha de cada uno cumplido). */
  pasos: { aceptado: string | null; salio: string | null; retiro: string | null; enCamino: string | null; entregado: string | null };
  retiro: { nombre: string; lat: number; lng: number };
  destino: { nombre: string; lat: number; lng: number };
  /** Viaje con varias paradas: todas, numeradas, con las propias resaltadas en el mapa. */
  paradas: { n: number; nombre: string; lat: number; lng: number; propia: boolean; hecha: boolean }[];
  /** Última posición del vehículo en este viaje (sin posiciones: sin mapa, solo el texto). */
  posicion: { lat: number; lng: number; fecha: string; fuente: "CUSAT" | "TELEFONO" | "MOCK" | null } | null;
  ruta: [number, number][] | null;
  distanciaM: number | null;
  eta: string | null;
  /** UNA frase grande: "Claudio está a 6 km de la obra." (con Google: "…, llega 9:40 (con tránsito)."). */
  frase: string;
};

/**
 * Seguimiento en vivo de un pedido para quien lo puede ver: SU parada de retiro y SU entrega dentro del
 * viaje (que puede llevar otros pedidos), dónde está el vehículo y cuánto le falta. Null si no le corresponde.
 *   "Claudio está en el corralón cargando tu pedido (también lleva material para Chubut)"
 *   "Salió, antes pasa por Chubut, después Darwin · está a 9 km" · "Llegó a Darwin".
 */
export async function seguimiento(u: Pick<UsuarioSesion, "id" | "rol">, pedidoId: string): Promise<DatosSeguimiento | null> {
  const p = await db.pedidoViaje.findFirst({
    where: conAlcance(u, { id: pedidoId }),
    include: {
      tomadoPor: { select: { nombre: true, telefono: true } },
      viaje: {
        include: {
          vehiculo: { select: { nombre: true, ultimaLat: true, ultimaLng: true, ultimaFechaGps: true, posiciones: { orderBy: { fecha: "desc" }, take: 1, select: { fuente: true } } } },
          paradas: { orderBy: { orden: "asc" }, include: { pedidosRetiro: { select: { pedidoViajeId: true, pedido: { select: { obra: { select: { nombre: true } } } } } } } },
          viajePedidos: { select: { pedidoViajeId: true, paradaRetiroId: true, paradaEntregaId: true } },
        },
      },
    },
  });
  if (!p) return null;
  const v = p.viaje && p.viaje.estado !== "CANCELADO" && p.estado !== "PENDIENTE" ? p.viaje : null;
  const etapa = v?.etapa ?? null;
  const vh = v?.vehiculo;
  const aqui = vh?.ultimaLat != null && vh.ultimaLng != null && vh.ultimaFechaGps ? { lat: vh.ultimaLat, lng: vh.ultimaLng } : null;
  const chofer = p.tomadoPor?.nombre ?? "El chofer";

  // Sus paradas en el viaje y la que sigue.
  const mio = v?.viajePedidos.find((x) => x.pedidoViajeId === p.id);
  const paradas = v?.paradas ?? [];
  const suRetiro = paradas.find((x) => x.id === mio?.paradaRetiroId) ?? null;
  const suEntrega = paradas.find((x) => x.id === mio?.paradaEntregaId) ?? null;
  const hecha = (x: { estado: string } | null) => !!x && (x.estado === "COMPLETADA" || x.estado === "SALTEADA");
  const faltan = paradas.filter((x) => !hecha(x));
  const actual = faltan[0] ?? null;
  const enCamino = !!actual && actual.estado !== "LLEGO" && v?.estado === "EN_CURSO";
  const ruta = aqui && enCamino ? await rutaSegura(aqui, { lat: actual!.latitud, lng: actual!.longitud }, { transito: false }) : null;
  const corta = (s: string) => s.replace(/^Obra\s+/i, "").replace(/\s+\d+.*$/, "").replace(/\s·\s.*$/, "").trim() || s;
  /** Metros hasta su entrega: hasta la parada actual (por calle) y de ahí por el recorrido planeado. */
  const hastaSuEntrega = () => {
    if (!suEntrega || !actual) return null;
    let m = ruta?.distanciaM ?? 0;
    for (const x of faltan) {
      if (x.orden <= actual.orden || x.orden > suEntrega.orden) continue;
      m += x.distanciaDesdeAnteriorM ?? 0;
    }
    return m;
  };
  const llego = suEntrega?.llegadaEn ?? (paradas.length ? null : v?.llegadaDestinoEn ?? v?.llegadaReal ?? null);
  const eta = actual && suEntrega && actual.id === suEntrega.id && enCamino ? v?.etaDestino ?? null : actual && suRetiro && actual.id === suRetiro.id && enCamino ? v?.etaRetiro ?? null : null;

  let frase: string;
  if (p.estado === "CANCELADO") frase = "Pedido cancelado.";
  else if (p.estado === "PENDIENTE") frase = "Pendiente, lo ven los choferes.";
  else if (p.estado === "ENTREGADO" || hecha(suEntrega) || etapa === "FINALIZADO") frase = llego ? `Entregado ${hora(llego)}.` : "Entregado.";
  else if (!v || v.estado === "PROGRAMADO") frase = `${chofer} lo aceptó. Es para ${textoParaCuando(p.paraCuando, p.franja)}.${paradas.length > 2 ? ` Lo lleva junto con otros pedidos (${paradas.length} paradas).` : ""}`;
  else if (suEntrega?.estado === "LLEGO") frase = `${chofer} llegó a ${suEntrega.nombre}${suEntrega.llegadaEn ? ` a las ${hora(suEntrega.llegadaEn)}` : ""}. Está descargando.`;
  else if (suRetiro && !hecha(suRetiro)) {
    // Todavía no cargó lo suyo.
    if (suRetiro.estado === "LLEGO") {
      const otros = [...new Set(suRetiro.pedidosRetiro.filter((x) => x.pedidoViajeId !== p.id).map((x) => corta(x.pedido.obra.nombre)))].filter((o) => o !== corta(p.destinoNombre));
      frase = `${chofer} está en ${corta(suRetiro.nombre)} cargando tu pedido${otros.length ? ` (también lleva material para ${otros.join(" y ")})` : ""}.`;
    } else if (actual?.id === suRetiro.id) {
      frase = `${chofer} va a ${corta(suRetiro.nombre)} a buscar tu pedido${ruta ? `, está a ${metros(ruta.distanciaM)}` : ""}${eta ? `, llega ${hora(eta)} (con tránsito)` : ""}.`;
    } else {
      frase = `${chofer} pasa primero por ${corta(actual?.nombre ?? "")} y después busca tu pedido en ${corta(suRetiro.nombre)}.`;
    }
  } else {
    // Ya lo lleva: qué entregas hace antes de la suya y cuánto falta.
    const antes = faltan.filter((x) => suEntrega && x.orden < suEntrega.orden).map((x) => corta(x.nombre));
    const m = hastaSuEntrega();
    const destino = corta(suEntrega?.nombre ?? p.destinoNombre);
    frase = m != null && m < 200 && !antes.length
      ? `${chofer} está llegando a ${destino}.`
      : `${chofer} salió con tu pedido${antes.length ? `, antes pasa por ${antes.join(" y ")}, después ${destino}` : ` hacia ${destino}`}${m != null && (ruta || antes.length) ? ` · está a ${metros(m)}` : ""}${eta ? `, llega ${hora(eta)} (con tránsito)` : ""}.`;
  }

  const retiroPunto = suRetiro ?? paradas[0] ?? null;
  return {
    etapa, estado: p.estado,
    chofer: p.tomadoPor ? { nombre: p.tomadoPor.nombre, telefono: p.tomadoPor.telefono } : null,
    vehiculo: v?.vehiculo.nombre ?? null,
    // Los 5 pasos son los de SU pedido (su retiro y su entrega), aunque el viaje lleve otros.
    pasos: {
      aceptado: p.tomadoEn?.toISOString() ?? null,
      salio: (v?.inicioEn ?? v?.salidaReal)?.toISOString() ?? null,
      retiro: (suRetiro ? suRetiro.llegadaEn : v?.inicioEn)?.toISOString() ?? null,
      enCamino: (suRetiro ? suRetiro.salidaEn : v?.inicioEn)?.toISOString() ?? null,
      entregado: llego ? llego.toISOString() : null,
    },
    retiro: retiroPunto ? { nombre: retiroPunto.nombre, lat: retiroPunto.latitud, lng: retiroPunto.longitud } : { nombre: p.origenNombre, ...origenDe(p) },
    destino: suEntrega ? { nombre: suEntrega.nombre, lat: suEntrega.latitud, lng: suEntrega.longitud } : { nombre: p.destinoNombre, ...destinoDe(p) },
    paradas: paradas.length > 2 ? paradas.map((x, i) => ({ n: i + 1, nombre: x.nombre, lat: x.latitud, lng: x.longitud, propia: x.id === suEntrega?.id || x.id === suRetiro?.id, hecha: hecha(x) })) : [],
    posicion: aqui && vh?.ultimaFechaGps ? { ...aqui, fecha: vh.ultimaFechaGps.toISOString(), fuente: vh.posiciones[0]?.fuente ?? null } : null,
    ruta: ruta?.geometria ?? null,
    distanciaM: hastaSuEntrega() ?? ruta?.distanciaM ?? null,
    eta: eta?.toISOString() ?? null,
    frase,
  };
}
