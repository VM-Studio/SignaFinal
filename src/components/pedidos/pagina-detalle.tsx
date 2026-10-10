import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowDown, ArrowLeft, MapPin, Navigation, Phone } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { db } from "@/lib/db";
import { opcionesReasignar, pedido as buscarPedido, vehiculosParaTomar } from "@/lib/pedidos/consultas";
import { SeguimientoViaje } from "@/components/viajes/seguimiento-viaje";
import { seguimiento } from "@/lib/viajes/seguimiento";
import { modoDemo } from "@/lib/demo";
import { textoParaCuando, TIPO } from "@/lib/pedidos/presentacion";
import { Insignia, Subtitulo, Tarjeta } from "@/components/ui/basicos";
import { EstadoPedido } from "@/components/pedidos/fila-pedido";
import { IconoTipo } from "@/components/pedidos/iconos";
import { BotonReasignar, BotonTomar } from "@/components/pedidos/tomar";
import { BotonCancelar, BotonSoltar } from "@/components/pedidos/acciones-detalle";
import { BotonIniciar } from "@/components/viajes/acciones-viaje";
import { FechaGrande } from "@/components/viajes/tarjeta-chofer";
import { BotonReprogramar } from "@/components/pedidos/reprogramar";
import { cuando, hora, peso, plata } from "@/lib/formato";
import { claseBoton } from "@/components/ui/boton";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await db.pedidoViaje.findUnique({ where: { id: (await params).id }, select: { numero: true } });
  return { title: p ? `Pedido ${p.numero}` : "Pedido" };
}

const mapsA = (dir: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dir)}`;

export default async function PaginaPedido({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigirPermiso("pedidos.ver");
  const { id } = await params;
  const p = await buscarPedido(id);
  // No existe o no le corresponde verlo: a su inicio, sin mensaje.
  if (!p) redirect("/inicio");

  const esChofer = puede(u.rol, "pedidos.tomar");
  const esMio = p.tomadoPorId === u.id;
  const puedeCancelar =
    (p.estado === "PENDIENTE" && p.solicitanteId === u.id && puede(u.rol, "pedidos.cancelarPropios")) ||
    (["PENDIENTE", "TOMADO"].includes(p.estado) && puede(u.rol, "pedidos.cancelarCualquiera"));
  const puedeReasignar = ["PENDIENTE", "TOMADO"].includes(p.estado) && puede(u.rol, "pedidos.reasignar");
  // Cambiar la fecha: Dirección y quien lo pidió, mientras no salió.
  const puedeReprogramar = (p.estado === "PENDIENTE" || (p.estado === "TOMADO" && (!p.viaje || p.viaje.etapa === "PROGRAMADO"))) && (puede(u.rol, "pedidos.reprogramar") || p.solicitanteId === u.id);

  const [vehiculos, reasignar, vehiculoActual] = await Promise.all([
    esChofer && p.estado === "PENDIENTE" ? vehiculosParaTomar(p) : Promise.resolve(null),
    puedeReasignar ? opcionesReasignar(p) : Promise.resolve(null),
    esMio && p.estado === "TOMADO" && p.viaje ? db.vehiculo.findUnique({ where: { id: p.viaje.vehiculo.id }, select: { kmActual: true } }) : Promise.resolve(null),
  ]);

  // Los cuatro momentos: pedido, aceptado, retiro y destino, con hora (o la estimada si todavía no pasó).
  const v = p.viaje && p.estado !== "PENDIENTE" ? p.viaje : null;
  // Sus paradas en el viaje (si lleva otros pedidos, los tiempos son los de SU retiro y SU entrega).
  const mio = p.enViaje;
  const enRetiro = mio ? mio.retiro?.llegadaEn ?? mio.retiro?.salidaEn ?? (mio.retiro ? null : v?.inicioEn ?? null) : v?.llegadaRetiroEn ?? v?.salidaRetiroEn ?? null;
  const enDestino = mio ? mio.entrega?.llegadaEn ?? null : v?.llegadaDestinoEn ?? v?.llegadaReal ?? null;
  const momentos: { titulo: string; hecho: boolean; fecha: Date | null; detalle?: string }[] = [
    { titulo: `${p.solicitante.nombre} lo pidió`, hecho: true, fecha: p.creadoEn },
    { titulo: p.tomadoEn ? `Lo aceptó ${p.tomadoPor?.nombre ?? "un chofer"}` : "Que lo acepte un chofer", hecho: !!p.tomadoEn, fecha: p.tomadoEn, detalle: v ? `${v.vehiculo.nombre}${v.salidaEstimada && !v.salidaReal ? ` · sale ${hora(v.salidaEstimada)}` : ""}` : undefined },
    { titulo: enRetiro ? `Retiró en ${p.origen.nombre}` : `Retiro en ${p.origen.nombre}`, hecho: !!enRetiro, fecha: enRetiro, detalle: !enRetiro && v?.etaRetiro ? `llega ${hora(v.etaRetiro)} (con tránsito)` : undefined },
    { titulo: p.estado === "ENTREGADO" ? `Entregado en Obra ${p.obra.nombre}` : enDestino ? `Llegó a Obra ${p.obra.nombre}` : `Llegada a Obra ${p.obra.nombre}`, hecho: !!enDestino, fecha: enDestino, detalle: !enDestino && v?.etaDestino ? `llega ${hora(v.etaDestino)} (con tránsito)` : undefined },
  ];

  const destino = `${p.obra.direccion}, ${p.obra.localidad}`;
  const acciones = (
    <>
      {esChofer && p.estado === "PENDIENTE" && vehiculos && <BotonTomar pedidoId={p.id} numero={p.numero} vehiculos={vehiculos} pesoKg={p.pesoKg} tipo={p.tipo} ancho />}
      {esMio && p.estado === "TOMADO" && p.viaje && (
        <>
          <BotonIniciar pedidoId={p.id} numero={p.numero} vehiculo={p.viaje.vehiculo.nombre} kmActual={vehiculoActual?.kmActual ?? 0} paraCuando={p.paraCuando} />
          <BotonSoltar pedidoId={p.id} numero={p.numero} />
        </>
      )}
      {puedeReprogramar && <BotonReprogramar pedidoId={p.id} paraCuando={p.paraCuando} franja={p.franja} />}
      {reasignar && <BotonReasignar pedidoId={p.id} numero={p.numero} choferes={reasignar.choferes} vehiculos={reasignar.vehiculos} />}
      {puedeCancelar && <BotonCancelar pedidoId={p.id} />}
    </>
  );
  const enVivo = ["TOMADO", "EN_VIAJE", "ENTREGADO"].includes(p.estado) ? await seguimiento(u, p.id) : null;
  const volver =
    u.rol === "CHOFER" ? { href: "/hoy", titulo: "Hoy" } :
    u.rol === "RESPONSABLE_OBRA" || u.rol === "CAPATAZ" ? { href: "/mis-pedidos", titulo: "Mis pedidos" } :
    { href: "/solicitudes", titulo: "Solicitudes" };
  const hayAcciones = (esChofer && p.estado === "PENDIENTE") || (esMio && p.estado === "TOMADO") || puedeReasignar || puedeCancelar || puedeReprogramar;

  const cabecera = (
    <header className="min-w-0">
      <Link href={volver.href} className="mb-2 hidden min-h-8 items-center gap-1 text-sm font-medium text-suave hover:text-tinta lg:inline-flex">
        <ArrowLeft className="size-4" /> {volver.titulo}
      </Link>
      <p className="flex items-center gap-1.5 etiqueta [&_svg]:size-3.5">
        <IconoTipo tipo={p.tipo} /> {TIPO[p.tipo].titulo} · Pedido {p.numero}
      </p>
      {/* El chofer lee primero la fecha del viaje, grande y en palabras. */}
      {esChofer && p.estado !== "CANCELADO" && p.estado !== "ENTREGADO" && <FechaGrande fecha={p.paraCuando} franja={p.franja} iniciado={p.estado === "EN_VIAJE"} className="mt-1" />}
      <h1 className="mt-1 text-xl leading-7 font-semibold lg:text-[22px]">{p.descripcion}</h1>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <EstadoPedido p={p} />
        {p.prioridad === "URGENTE" && <Insignia tono="critico">Urgente</Insignia>}
        {p.necesitaCamion && <Insignia tono="neutro">Necesita camión</Insignia>}
      </div>
      {p.estado === "CANCELADO" && p.motivoCancelacion && <p className="mt-2 text-sm text-suave">Cancelado: {p.motivoCancelacion}</p>}
    </header>
  );

  const queSePidio = (
    <>
      <Tarjeta className="p-4">
        <div className="flex gap-3">
          <MapPin className="mt-0.5 size-4 shrink-0 text-suave" />
          <div className="min-w-0 flex-1">
            <p className="etiqueta">Desde</p>
            <p className="font-medium">{p.origen.nombre}</p>
            <p className="text-sm text-suave">{p.origen.direccion}</p>
            {p.proveedor?.telefono && (
              <a href={`tel:${p.proveedor.telefono.replace(/\s/g, "")}`} className="mt-1 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium underline">
                <Phone className="size-4" /> {p.proveedor.telefono}
              </a>
            )}
          </div>
          {p.origen.direccion && (
            <a href={mapsA(p.origen.direccion)} target="_blank" rel="noopener" aria-label="Cómo llegar al origen" className={claseBoton("secundario", "normal", false, "w-12 shrink-0 px-0 lg:w-9")}>
              <Navigation />
            </a>
          )}
        </div>
        <ArrowDown aria-hidden className="my-2 size-4 text-apagado" />
        <div className="flex gap-3">
          <MapPin className="mt-0.5 size-4 shrink-0 fill-tinta" />
          <div className="min-w-0 flex-1">
            <p className="etiqueta">Hacia</p>
            <p className="font-medium">Obra {p.obra.nombre}</p>
            <p className="text-sm text-suave">{destino}</p>
          </div>
          <a href={mapsA(destino)} target="_blank" rel="noopener" aria-label="Cómo llegar a la obra" className={claseBoton("secundario", "normal", false, "w-12 shrink-0 px-0 lg:w-9")}>
            <Navigation />
          </a>
        </div>
      </Tarjeta>

      <dl className="grid grid-cols-2 gap-4 rounded-[var(--radius-caja)] border border-linea bg-papel p-4 sm:grid-cols-3">
        {[
          ["Para cuándo", textoParaCuando(p.paraCuando, p.franja)],
          ["Pidió", p.solicitante.nombre],
          p.pesoKg ? ["Peso", `Hasta ${peso(p.pesoKg)}`] : null,
          p.cantidadPersonas ? ["Personas", String(p.cantidadPersonas)] : null,
          p.ordenCompraLebane ? ["Orden de compra", p.ordenCompraLebane] : null,
          p.viaje && p.estado !== "PENDIENTE" && p.estado !== "CANCELADO" ? ["Vehículo", `${p.viaje.vehiculo.nombre} · ${p.viaje.vehiculo.patente}`] : null,
          (p.enViaje?.costo ?? p.viaje?.costoCalculado) != null && puede(u.rol, "costos.ver") ? ["Costo a la obra", `${plata(p.enViaje?.costo ?? p.viaje!.costoCalculado)}${p.viaje && p.viaje._count.pedidos > 1 ? ` (su parte de un viaje con ${p.viaje._count.pedidos} pedidos)` : ""}`] : null,
        ]
          .filter((x): x is [string, string] => !!x)
          .map(([k, v]) => (
            <div key={k}>
              <dt className="etiqueta">{k}</dt>
              <dd className="mt-1 text-sm font-medium">{v}</dd>
            </div>
          ))}
      </dl>
    </>
  );

  // Aceptado, en viaje o entregado: seguimiento en vivo (pasos, frase, llamar al chofer y, en camino, el mapa).
  if (enVivo) {
    return (
      <SeguimientoViaje
        pedidoId={p.id}
        inicial={enVivo}
        demo={modoDemo() && u.rol === "DIRECCION"}
        cabecera={<>{cabecera}{hayAcciones && <div className="flex flex-wrap gap-2">{acciones}</div>}</>}
        resto={<><Subtitulo>Qué pidió</Subtitulo>{queSePidio}</>}
      />
    );
  }

  return (
    <div className="grid gap-x-6 gap-y-4 lg:grid-cols-[1fr_320px]">
      <div className="lg:col-start-1">{cabecera}</div>

      {hayAcciones && (
        <aside className="flex flex-col gap-2 lg:sticky lg:top-[72px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start lg:rounded-[var(--radius-caja)] lg:border lg:border-linea lg:bg-papel lg:p-4">
          {acciones}
        </aside>
      )}

      <div id="detalle" className="flex min-w-0 scroll-mt-20 flex-col gap-3 lg:col-start-1">
        {queSePidio}

        <Subtitulo>Línea de tiempo</Subtitulo>
        <ol className="relative ml-1.5 border-l border-linea pl-5">
          {momentos.map((m) => (
            <li key={m.titulo} className="relative pb-4 last:pb-0">
              <span aria-hidden className={`absolute top-1.5 -left-[25px] size-2 rounded-full ${m.hecho ? "bg-tinta" : "border border-linea-fuerte bg-papel"}`} />
              <p className={`text-sm ${m.hecho ? "font-medium" : "text-suave"}`}>{m.titulo}</p>
              {(m.fecha || m.detalle) && <p className="text-[12px] text-suave">{[m.fecha ? cuando(m.fecha) : null, m.detalle].filter(Boolean).join(" · ")}</p>}
            </li>
          ))}
          {p.estado === "CANCELADO" && (
            <li className="relative">
              <span aria-hidden className="absolute top-1.5 -left-[25px] size-2 rounded-full bg-critico" />
              <p className="text-sm font-medium text-critico">Cancelado{p.motivoCancelacion ? `: ${p.motivoCancelacion}` : ""}</p>
              {p.canceladoEn && <p className="text-[12px] text-suave">{cuando(p.canceladoEn)}</p>}
            </li>
          )}
        </ol>
      </div>
    </div>
  );
}
