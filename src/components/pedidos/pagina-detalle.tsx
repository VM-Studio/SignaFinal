import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowDown, ArrowLeft, MapPin, Navigation, Phone } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { db } from "@/lib/db";
import { historia, opcionesReasignar, pedido as buscarPedido, vehiculosParaTomar } from "@/lib/pedidos/consultas";
import { textoParaCuando, TIPO } from "@/lib/pedidos/presentacion";
import { Insignia, Subtitulo, Tarjeta } from "@/components/ui/basicos";
import { EstadoPedido } from "@/components/pedidos/fila-pedido";
import { IconoTipo } from "@/components/pedidos/iconos";
import { BotonReasignar, BotonTomar } from "@/components/pedidos/tomar";
import { BotonCancelar, BotonSoltar } from "@/components/pedidos/acciones-detalle";
import { BotonIniciar } from "@/components/viajes/acciones-viaje";
import { cuando, hora, km, peso, plata } from "@/lib/formato";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await db.pedidoViaje.findUnique({ where: { id: (await params).id }, select: { numero: true } });
  return { title: p ? `Pedido ${p.numero}` : "Pedido" };
}

const mapsA = (dir: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dir)}`;

const ACCIONES: Record<string, (d: Record<string, unknown> | null, quien: string) => string> = {
  "pedido.crear": (_, q) => `${q} lo pidió`,
  "pedido.crear.noEraDuplicado": (_, q) => `${q} lo pidió (avisó que no era un duplicado)`,
  "pedido.tomar": (d, q) => `${q} lo tomó con ${d?.vehiculo ?? "un vehículo"}${d?.salida ? ` · sale ${hora(String(d.salida))}` : ""}`,
  "pedido.soltar": (_, q) => `${q} lo soltó y volvió a la cola`,
  "pedido.reasignar": (d, q) => `${q} se lo asignó a ${d?.chofer ?? "otro chofer"}`,
  "viaje.iniciar": (d, q) => `${q} salió con ${d?.vehiculo ?? "el vehículo"} · ${km(Number(d?.kmSalida))}`,
  "viaje.finalizar": (_, q) => `${q} llegó a la obra`,
  "pedido.cancelar": (d, q) => `${q} lo canceló: ${d?.motivo ?? ""}`,
  "pedido.deshacerCancelacion": (_, q) => `${q} deshizo la cancelación`,
  "pedido.deshacer": (_, q) => `${q} lo deshizo al pedirlo`,
};

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

  const [eventos, vehiculos, reasignar, vehiculoActual] = await Promise.all([
    historia(id),
    esChofer && p.estado === "PENDIENTE" ? vehiculosParaTomar(p) : Promise.resolve(null),
    puedeReasignar ? opcionesReasignar(p) : Promise.resolve(null),
    esMio && p.estado === "TOMADO" && p.viaje ? db.vehiculo.findUnique({ where: { id: p.viaje.vehiculo.id }, select: { kmActual: true } }) : Promise.resolve(null),
  ]);

  // Línea de tiempo: pedido, tomado, salida, llegada (y lo que haya pasado entre medio).
  const linea = eventos.map((e) => ({ fecha: e.fecha, texto: (ACCIONES[e.accion] ?? ((_, q) => `${q}: ${e.accion}`))(e.despues, e.usuario?.nombre ?? "Sistema") }));
  if (!eventos.some((e) => e.accion.startsWith("pedido.crear"))) linea.unshift({ fecha: p.creadoEn, texto: `${p.solicitante.nombre} lo pidió` });
  if (p.tomadoEn && !eventos.some((e) => e.accion === "pedido.tomar" || e.accion === "pedido.reasignar")) linea.push({ fecha: p.tomadoEn, texto: `${p.tomadoPor?.nombre} lo tomó` });
  if (p.viaje?.salidaReal && !eventos.some((e) => e.accion === "viaje.iniciar")) linea.push({ fecha: p.viaje.salidaReal, texto: `Salió con ${p.viaje.vehiculo.nombre}` });
  if (p.viaje?.llegadaReal && !eventos.some((e) => e.accion === "viaje.finalizar")) linea.push({ fecha: p.viaje.llegadaReal, texto: "Llegó a la obra" });
  linea.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  const proximos = [
    p.estado === "PENDIENTE" && "Que un chofer lo tome",
    ["PENDIENTE", "TOMADO"].includes(p.estado) && (p.viaje?.salidaEstimada ? `Salida estimada ${cuando(p.viaje.salidaEstimada)}` : "Salida"),
    ["PENDIENTE", "TOMADO", "EN_VIAJE"].includes(p.estado) && "Llegada a la obra",
  ].filter(Boolean) as string[];

  const destino = `${p.obra.direccion}, ${p.obra.localidad}`;
  const acciones = (
    <>
      {esChofer && p.estado === "PENDIENTE" && vehiculos && <BotonTomar pedidoId={p.id} numero={p.numero} vehiculos={vehiculos} ancho tamano="grande" />}
      {esMio && p.estado === "TOMADO" && p.viaje && (
        <>
          <BotonIniciar pedidoId={p.id} numero={p.numero} vehiculo={p.viaje.vehiculo.nombre} kmActual={vehiculoActual?.kmActual ?? 0} />
          <BotonSoltar pedidoId={p.id} numero={p.numero} />
        </>
      )}
      {reasignar && <BotonReasignar pedidoId={p.id} numero={p.numero} choferes={reasignar.choferes} vehiculos={reasignar.vehiculos} />}
      {puedeCancelar && <BotonCancelar pedidoId={p.id} />}
    </>
  );
  const volver =
    u.rol === "CHOFER" ? { href: "/hoy", titulo: "Hoy" } :
    u.rol === "RESPONSABLE_OBRA" || u.rol === "CAPATAZ" ? { href: "/mis-pedidos", titulo: "Mis pedidos" } :
    { href: "/solicitudes", titulo: "Solicitudes" };
  const hayAcciones = (esChofer && p.estado === "PENDIENTE") || (esMio && p.estado === "TOMADO") || puedeReasignar || puedeCancelar;

  return (
    <div className="mx-auto grid max-w-5xl gap-x-8 gap-y-5 lg:grid-cols-[1fr_360px]">
      <header className="min-w-0 lg:col-start-1">
        <Link href={volver.href} className="mb-2 hidden min-h-11 items-center gap-1 font-semibold text-suave lg:inline-flex">
          <ArrowLeft className="size-5" /> {volver.titulo}
        </Link>
        <p className="flex items-center gap-2 text-sm font-semibold tracking-wider text-suave uppercase">
          <IconoTipo tipo={p.tipo} /> {TIPO[p.tipo].titulo} · Pedido {p.numero}
        </p>
        <h1 className="mt-1 text-2xl leading-tight font-bold lg:text-3xl">{p.descripcion}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <EstadoPedido p={p} />
          {p.prioridad === "URGENTE" && <Insignia tono="critico">Urgente</Insignia>}
          {p.necesitaCamion && <Insignia tono="neutro">Necesita camión</Insignia>}
        </div>
        {p.estado === "CANCELADO" && p.motivoCancelacion && <p className="mt-3 font-medium text-suave">Cancelado: {p.motivoCancelacion}</p>}
      </header>

      {hayAcciones && (
        <aside className="flex flex-col gap-2 lg:sticky lg:top-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start lg:rounded-[var(--radius-caja)] lg:border lg:border-linea lg:bg-papel lg:p-5">
          {acciones}
        </aside>
      )}

      <div className="min-w-0 lg:col-start-1">
        <Tarjeta className="p-4">
          <div className="flex gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-wider text-suave uppercase">Desde</p>
              <p className="font-bold">{p.origen.nombre}</p>
              <p className="text-suave">{p.origen.direccion}</p>
              {p.proveedor?.telefono && (
                <a href={`tel:${p.proveedor.telefono.replace(/\s/g, "")}`} className="mt-1 inline-flex min-h-11 items-center gap-1.5 font-semibold underline">
                  <Phone className="size-4" /> {p.proveedor.telefono}
                </a>
              )}
            </div>
            {p.origen.direccion && (
              <a href={mapsA(p.origen.direccion)} target="_blank" rel="noopener" aria-label="Cómo llegar al origen" className="grid size-12 shrink-0 place-items-center rounded-md border-2 border-negro">
                <Navigation className="size-5" />
              </a>
            )}
          </div>
          <ArrowDown aria-hidden className="my-2 ml-0.5 size-4 text-apagado" />
          <div className="flex gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 fill-negro" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-wider text-suave uppercase">Hacia</p>
              <p className="font-bold">Obra {p.obra.nombre}</p>
              <p className="text-suave">{destino}</p>
            </div>
            <a href={mapsA(destino)} target="_blank" rel="noopener" aria-label="Cómo llegar a la obra" className="grid size-12 shrink-0 place-items-center rounded-md border-2 border-negro">
              <Navigation className="size-5" />
            </a>
          </div>
        </Tarjeta>

        <dl className="mt-3 grid grid-cols-2 gap-3 rounded-[var(--radius-caja)] border border-linea bg-papel p-4 sm:grid-cols-3">
          {[
            ["Para cuándo", textoParaCuando(p.paraCuando, p.franja)],
            ["Pidió", p.solicitante.nombre],
            p.pesoKg ? ["Peso", `Hasta ${peso(p.pesoKg)}`] : null,
            p.cantidadPersonas ? ["Personas", String(p.cantidadPersonas)] : null,
            p.ordenCompraLebane ? ["Orden de compra", p.ordenCompraLebane] : null,
            p.viaje && p.estado !== "PENDIENTE" && p.estado !== "CANCELADO" ? ["Vehículo", `${p.viaje.vehiculo.nombre} · ${p.viaje.vehiculo.patente}`] : null,
            p.viaje?.costoCalculado != null && puede(u.rol, "costos.ver") ? ["Costo a la obra", plata(p.viaje.costoCalculado)] : null,
          ]
            .filter((x): x is [string, string] => !!x)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-semibold tracking-wider text-suave uppercase">{k}</dt>
                <dd className="mt-0.5 font-medium">{v}</dd>
              </div>
            ))}
        </dl>

        <Subtitulo>Línea de tiempo</Subtitulo>
        <ol className="relative ml-2 border-l-2 border-linea pl-5">
          {linea.map((e, i) => (
            <li key={i} className="relative pb-4">
              <span aria-hidden className="absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-negro bg-negro" />
              <p className="font-medium">{e.texto}</p>
              <p className="text-sm text-suave">{cuando(e.fecha)}</p>
            </li>
          ))}
          {proximos.map((t) => (
            <li key={t} className="relative pb-4 last:pb-0">
              <span aria-hidden className="absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-linea-fuerte bg-papel" />
              <p className="text-apagado">{t}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
