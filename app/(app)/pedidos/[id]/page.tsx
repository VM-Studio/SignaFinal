import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowDown, MapPin, Navigation } from "lucide-react";
import { requerirUsuario } from "@/lib/auth/usuario-actual";
import { puede } from "@/lib/permisos";
import { db } from "@/lib/db";
import { obtenerPedido, vehiculosParaPedido, viajeEnCursoDe } from "@/lib/datos/pedidos";
import { Dato, Subtitulo, Tarjeta } from "@/components/ui/basicos";
import { Estado } from "@/components/ui/estado";
import { EstadoPedido } from "@/components/pedidos/tarjeta-pedido";
import { BotonCancelar, BotonSoltar, BotonTomar } from "@/components/pedidos/acciones-pedido";
import { FormularioLlegada, FormularioSalida } from "@/components/viajes/formularios-viaje";
import { TIPO_CARGA, VEHICULO_REQUERIDO } from "@/lib/etiquetas";
import { cuando, diaRelativo, km, peso, plata } from "@/lib/formato";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await db.pedidoViaje.findUnique({ where: { id }, select: { numero: true } });
  return { title: p ? `Pedido ${p.numero}` : "Pedido" };
}

const mapsA = (direccion: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(direccion)}`;

export default async function PaginaPedido({ params }: { params: Promise<{ id: string }> }) {
  const u = await requerirUsuario("pedidos.ver");
  const { id } = await params;
  const p = await obtenerPedido(id);
  if (!p) notFound();

  const esMio = p.choferId === u.id;
  const esChofer = u.rol === "CHOFER";
  const puedeCancelar = (p.solicitanteId === u.id || puede(u.rol, "pedidos.cancelarCualquiera")) && (p.estado === "PENDIENTE" || p.estado === "TOMADO");
  const verCosto = puede(u.rol, "costos.ver") || esMio;
  const destino = [p.obra.direccion, p.obra.localidad].filter(Boolean).join(", ");

  let accion: React.ReactNode = null;
  if (esChofer && p.estado === "PENDIENTE") {
    const enCurso = await viajeEnCursoDe(u.id);
    accion = enCurso ? (
      <p className="font-medium text-suave">Terminá tu viaje en curso antes de tomar otro.</p>
    ) : (
      <BotonTomar pedidoId={p.id} grande />
    );
  } else if (esMio && p.estado === "TOMADO") {
    const vehiculos = await vehiculosParaPedido(u.id, p);
    accion = (
      <div className="flex flex-col gap-3">
        <FormularioSalida pedidoId={p.id} numero={p.numero} obra={p.obra.nombre} vehiculos={vehiculos} />
        <BotonSoltar pedidoId={p.id} />
      </div>
    );
  } else if (esMio && p.estado === "EN_VIAJE" && p.viaje) {
    accion = <FormularioLlegada pedidoId={p.id} numero={p.numero} obra={p.obra.nombre} kmSalida={p.viaje.kmSalida} costoKm={p.viaje.costoKmAplicado} />;
  }

  const historia = [
    { cuando: p.creadoEn, texto: `${p.solicitante.nombre} lo pidió` },
    p.tomadoEn && p.chofer && { cuando: p.tomadoEn, texto: `${p.chofer.nombre} lo tomó` },
    p.viaje && { cuando: p.viaje.salidaEn, texto: `Salió con ${p.vehiculo?.nombre ?? "el vehículo"} · ${km(p.viaje.kmSalida)}` },
    p.viaje?.llegadaEn && { cuando: p.viaje.llegadaEn, texto: `Llegó a la obra · ${km(p.viaje.kmRecorridos)} recorridos` },
    p.canceladoEn && { cuando: p.canceladoEn, texto: `Cancelado${p.motivoCancelacion ? `: ${p.motivoCancelacion}` : ""}` },
  ].filter(Boolean) as { cuando: Date; texto: string }[];

  return (
    <div className="mx-auto grid max-w-5xl gap-x-6 gap-y-5 lg:grid-cols-[1fr_380px]">
      <header className="min-w-0 lg:col-start-1">
        <p className="text-sm font-semibold uppercase tracking-wider text-suave">
          Pedido {p.numero} · {TIPO_CARGA[p.tipoCarga]}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Obra {p.obra.nombre}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <EstadoPedido p={p} />
          {p.prioridad === "URGENTE" && <Estado tono="critico">Urgente</Estado>}
          {p.necesarioPara && <Estado tono="neutro">Para {diaRelativo(p.necesarioPara)}</Estado>}
        </div>
      </header>

      {(accion || puedeCancelar) && (
        <aside className="flex flex-col gap-3 lg:sticky lg:top-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          {accion && <div className="lg:rounded-[var(--radius-caja)] lg:border lg:border-linea lg:bg-papel lg:p-5">{accion}</div>}
          {puedeCancelar && <BotonCancelar pedidoId={p.id} />}
        </aside>
      )}

      <div className="min-w-0 lg:col-start-1">
        <Subtitulo>Recorrido</Subtitulo>
        <Tarjeta className="p-4">
          <div className="flex gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-suave">Buscar en</p>
              <p className="font-bold">{p.origen}</p>
              {p.origenDireccion && <p className="text-suave">{p.origenDireccion}</p>}
              {p.proveedor?.telefono && (
                <a href={`tel:${p.proveedor.telefono.replace(/\s/g, "")}`} className="text-sm font-semibold underline">
                  {p.proveedor.telefono}
                </a>
              )}
            </div>
            {p.origenDireccion && (
              <a href={mapsA(p.origenDireccion)} target="_blank" rel="noopener" className="grid size-12 shrink-0 place-items-center rounded-md border-2 border-negro" aria-label="Cómo llegar al proveedor">
                <Navigation className="size-5" />
              </a>
            )}
          </div>
          <ArrowDown className="my-2 ml-0.5 size-4 text-apagado" />
          <div className="flex gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 fill-negro" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-suave">Llevar a</p>
              <p className="font-bold">Obra {p.obra.nombre}</p>
              <p className="text-suave">{destino}</p>
            </div>
            <a href={mapsA(destino)} target="_blank" rel="noopener" className="grid size-12 shrink-0 place-items-center rounded-md border-2 border-negro" aria-label="Cómo llegar a la obra">
              <Navigation className="size-5" />
            </a>
          </div>
        </Tarjeta>

        <Subtitulo>Qué llevar</Subtitulo>
        <Tarjeta className="p-4">
          <p className="text-lg font-semibold">{p.descripcion}</p>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Dato etiqueta="Peso">{p.pesoKg ? `Hasta ${peso(p.pesoKg)}` : "No se sabe"}</Dato>
            <Dato etiqueta="Vehículo">{VEHICULO_REQUERIDO[p.vehiculoRequerido]}</Dato>
            {p.ordenCompra && <Dato etiqueta="Orden de compra">{p.ordenCompra.numero}</Dato>}
            <Dato etiqueta="Pidió">{p.solicitante.nombre}</Dato>
          </dl>
          {p.observaciones && <p className="mt-3 rounded-md bg-fondo p-3">“{p.observaciones}”</p>}
        </Tarjeta>

        {p.viaje && (
          <>
            <Subtitulo>Viaje</Subtitulo>
            <Tarjeta className="p-4">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Dato etiqueta="Chofer">{p.chofer?.nombre}</Dato>
                <Dato etiqueta="Vehículo">{p.vehiculo?.nombre}</Dato>
                <Dato etiqueta="Km">{p.viaje.kmRecorridos != null ? km(p.viaje.kmRecorridos) : "En viaje"}</Dato>
                {verCosto && <Dato etiqueta="Costo a la obra">{p.viaje.costo != null ? plata(p.viaje.costo) : "Al llegar"}</Dato>}
                {verCosto && p.viaje.peajes > 0 && <Dato etiqueta="Peajes">{plata(p.viaje.peajes)}</Dato>}
              </dl>
            </Tarjeta>
          </>
        )}

        <Subtitulo>Historia</Subtitulo>
        <ol className="relative ml-2 border-l-2 border-linea pl-5">
          {historia.map((h, i) => (
            <li key={i} className="relative pb-4 last:pb-0">
              <span className="absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-negro bg-papel" />
              <p className="font-medium">{h.texto}</p>
              <p className="text-sm text-suave">{cuando(h.cuando)}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
