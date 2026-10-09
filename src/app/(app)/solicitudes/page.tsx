import Link from "next/link";
import type { Metadata } from "next";
import { ListOrdered, PlusCircle } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { cola, FILTROS, miRuta, opcionesReasignar, vehiculosParaTomar, type Filtro } from "@/lib/pedidos/consultas";
import { textoParaCuando, TIPO } from "@/lib/pedidos/presentacion";
import { BotonLink } from "@/components/ui/boton";
import { Insignia, Pestanas, Subtitulo, Titulo, Vacio } from "@/components/ui/basicos";
import { EstadoPedido, FilaPedido, FilasPedido } from "@/components/pedidos/fila-pedido";
import { IconoTipo } from "@/components/pedidos/iconos";
import { BotonReasignar, BotonTomar } from "@/components/pedidos/tomar";
import { RutaDelDia } from "@/components/pedidos/ruta-del-dia";
import { TarjetaChofer } from "@/components/viajes/tarjeta-chofer";
import { MarcarSolicitudesVistas } from "@/components/pedidos/solicitudes-vistas";
import { CargarMas } from "@/components/ui/cargar-mas";
import { limiteDe } from "@/lib/pagina";
import { FILTROS_SOLICITUDES, solicitudesPendientes, type FiltroSolicitudes } from "@/lib/viajes/chofer";

export const metadata: Metadata = { title: "Solicitudes" };

const VACIOS: Record<Filtro, { titulo: string; texto: string }> = {
  pendientes: { titulo: "No hay pedidos esperando chofer", texto: "Cuando alguien pida un viaje, aparece acá." },
  "en-curso": { titulo: "Nada en curso", texto: "Lo que tomen los choferes aparece acá." },
  "entregados-hoy": { titulo: "Todavía no se entregó nada hoy", texto: "" },
  mios: { titulo: "No tenés pedidos en curso", texto: "Lo que pidas o tomes aparece acá." },
};

/** Chofer: tarjetas para aceptar. Dirección: la cola completa con pestañas. */
export default async function PaginaSolicitudes(props: { searchParams: Promise<{ filtro?: string }> }) {
  const u = await exigirPermiso("pedidos.ver");
  if (u.rol === "CHOFER") {
    const sp = (await props.searchParams) as { filtro?: string; n?: string };
    return <VistaChofer filtro={sp.filtro} n={sp.n} />;
  }
  return <VistaDireccion searchParams={props.searchParams} />;
}

async function VistaChofer({ filtro: f, n }: { filtro?: string; n?: string }) {
  const filtro: FiltroSolicitudes = f && f in FILTROS_SOLICITUDES ? (f as FiltroSolicitudes) : "todas";
  const { limite, siguiente } = await limiteDe(n);
  const { lista, hayMas } = await solicitudesPendientes(filtro, limite);
  return (
    <div>
      <MarcarSolicitudesVistas />
      <Pestanas items={(Object.keys(FILTROS_SOLICITUDES) as FiltroSolicitudes[]).map((k) => ({ href: k === "todas" ? "/solicitudes" : `/solicitudes?filtro=${k}`, etiqueta: FILTROS_SOLICITUDES[k], activa: k === filtro }))} />
      {lista.length === 0 ? (
        <Vacio icono={<ListOrdered className="size-10" />} titulo="No hay solicitudes pendientes">Cuando alguien de obra pida un viaje, aparece acá.</Vacio>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {lista.map((t) => (
            <TarjetaChofer key={t.pedidoId} t={t} href={`/solicitudes/${t.pedidoId}`} accion={<BotonTomar pedidoId={t.pedidoId} numero={t.numero} vehiculos={t.vehiculos} ancho tamano="grande" />} />
          ))}
        </ul>
      )}
      {hayMas && <CargarMas href={`/solicitudes?${filtro !== "todas" ? `filtro=${filtro}&` : ""}n=${siguiente}`} />}
    </div>
  );
}

async function VistaDireccion({ searchParams }: { searchParams: Promise<{ filtro?: string; n?: string }> }) {
  const u = await exigirPermiso("pedidos.ver");
  const pedido = (await searchParams).filtro;
  const filtro: Filtro = pedido && pedido in FILTROS ? (pedido as Filtro) : "pendientes";
  const esChofer = puede(u.rol, "pedidos.tomar");

  const { limite, siguiente } = await limiteDe((await searchParams).n);
  const [{ pedidos, conteos, hayMas }, ruta] = await Promise.all([cola(filtro, limite), esChofer ? miRuta() : Promise.resolve([])]);
  // Para cada pendiente, los vehículos con los que este chofer lo podría llevar.
  const vehiculos = esChofer
    ? Object.fromEntries(await Promise.all(pedidos.filter((p) => p.estado === "PENDIENTE").map(async (p) => [p.id, await vehiculosParaTomar(p)] as const)))
    : {};
  // Dirección acepta en nombre de un chofer: "Asignar" con chofer, vehículo y hora.
  const asignar = puede(u.rol, "pedidos.reasignar")
    ? Object.fromEntries(await Promise.all(pedidos.filter((p) => p.estado === "PENDIENTE").map(async (p) => [p.id, await opcionesReasignar(p)] as const)))
    : {};
  const tomar = (p: (typeof pedidos)[number], ancho = false) =>
    esChofer && p.estado === "PENDIENTE" ? <BotonTomar pedidoId={p.id} numero={p.numero} vehiculos={vehiculos[p.id] ?? []} ancho={ancho} /> :
    asignar[p.id] ? <BotonReasignar pedidoId={p.id} numero={p.numero} choferes={asignar[p.id].choferes} vehiculos={asignar[p.id].vehiculos} etiqueta="Asignar" /> : undefined;
  const conAccion = esChofer || puede(u.rol, "pedidos.reasignar");

  return (
    <div>
      <Titulo
        detalle="Urgentes primero, después por fecha pedida."
        accion={puede(u.rol, "pedidos.crear") ? <BotonLink href="/pedir" icono={<PlusCircle />}>Pedir un viaje</BotonLink> : undefined}
      >
        Solicitudes
      </Titulo>

      {esChofer && ruta.length > 0 && (
        <section className="mb-6">
          <Subtitulo>Mi ruta</Subtitulo>
          <RutaDelDia
            paradas={ruta.map((p) => ({
              pedidoId: p.id,
              viajeId: p.viaje!.id,
              estado: p.estado as "TOMADO" | "EN_VIAJE",
              descripcion: p.descripcion,
              origen: p.origen.nombre,
              obra: p.obra.nombre,
              vehiculo: p.viaje!.vehiculo.nombre,
              salidaEstimada: p.viaje!.salidaEstimada?.toISOString() ?? null,
              chofer: u.nombre,
            }))}
          />
        </section>
      )}

      <Pestanas
        items={(Object.keys(FILTROS) as Filtro[]).map((f) => ({
          href: f === "pendientes" ? "/solicitudes" : `/solicitudes?filtro=${f}`,
          etiqueta: `${FILTROS[f]} ${conteos[f] ? `(${conteos[f]})` : ""}`.trim(),
          activa: f === filtro,
        }))}
      />

      {pedidos.length === 0 ? (
        <Vacio icono={<ListOrdered className="size-10" />} titulo={VACIOS[filtro].titulo}>{VACIOS[filtro].texto}</Vacio>
      ) : (
        <>
          {/* Celular: filas táctiles */}
          <FilasPedido>
            {pedidos.map((p) => (
              <FilaPedido key={p.id} p={p} accion={tomar(p)} />
            ))}
          </FilasPedido>

          {/* Escritorio: tabla */}
          <div className="hidden overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel lg:block">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Qué</th>
                  <th>Desde → Obra</th>
                  <th>Para cuándo</th>
                  <th>Pidió</th>
                  <th>Estado</th>
                  {conAccion && <th />}
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <IconoTipo tipo={p.tipo} />
                        {TIPO[p.tipo].corto}
                      </span>
                    </td>
                    <td className="max-w-sm py-2">
                      <Link href={`/solicitudes/${p.id}`} className="line-clamp-1 font-medium hover:underline">{p.descripcion}</Link>
                      {p.prioridad === "URGENTE" && p.estado === "PENDIENTE" && <Insignia tono="critico" className="mt-1">Urgente</Insignia>}
                    </td>
                    <td>
                      <span className="block truncate">Obra {p.obra.nombre}</span>
                      <span className="block truncate text-[12px] text-suave">desde {p.origen.nombre}</span>
                    </td>
                    <td className="whitespace-nowrap">{textoParaCuando(p.paraCuando, p.franja)}</td>
                    <td>{p.solicitante.nombre}</td>
                    <td><EstadoPedido p={p} /></td>
                    {conAccion && <td className="num">{tomar(p)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {hayMas && <CargarMas href={`/solicitudes?${filtro !== "pendientes" ? `filtro=${filtro}&` : ""}n=${siguiente}`} />}
    </div>
  );
}
