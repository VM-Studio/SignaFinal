import Link from "next/link";
import type { Metadata } from "next";
import { ListOrdered, PlusCircle } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { cola, FILTROS, miRuta, vehiculosParaTomar, type Filtro } from "@/lib/pedidos/consultas";
import { textoParaCuando, TIPO } from "@/lib/pedidos/presentacion";
import { BotonLink } from "@/components/ui/boton";
import { Insignia, Pestanas, Subtitulo, Titulo, Vacio } from "@/components/ui/basicos";
import { EstadoPedido, FilaPedido } from "@/components/pedidos/fila-pedido";
import { IconoTipo } from "@/components/pedidos/iconos";
import { BotonTomar } from "@/components/pedidos/tomar";
import { RutaDelDia } from "@/components/pedidos/ruta-del-dia";

export const metadata: Metadata = { title: "Solicitudes" };

const VACIOS: Record<Filtro, { titulo: string; texto: string }> = {
  pendientes: { titulo: "No hay pedidos esperando chofer", texto: "Cuando alguien pida un viaje, aparece acá." },
  "en-curso": { titulo: "Nada en curso", texto: "Lo que tomen los choferes aparece acá." },
  "entregados-hoy": { titulo: "Todavía no se entregó nada hoy", texto: "" },
  mios: { titulo: "No tenés pedidos en curso", texto: "Lo que pidas o tomes aparece acá." },
};

export default async function PaginaCola({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const u = await exigirPermiso("pedidos.ver");
  const pedido = (await searchParams).filtro;
  const filtro: Filtro = pedido && pedido in FILTROS ? (pedido as Filtro) : "pendientes";
  const esChofer = puede(u.rol, "pedidos.tomar");

  const [{ pedidos, conteos }, ruta] = await Promise.all([cola(filtro), esChofer ? miRuta() : Promise.resolve([])]);
  // Para cada pendiente, los vehículos con los que este chofer lo podría llevar.
  const vehiculos = esChofer
    ? Object.fromEntries(await Promise.all(pedidos.filter((p) => p.estado === "PENDIENTE").map(async (p) => [p.id, await vehiculosParaTomar(p)] as const)))
    : {};
  const tomar = (p: (typeof pedidos)[number], ancho = false) =>
    esChofer && p.estado === "PENDIENTE" ? <BotonTomar pedidoId={p.id} numero={p.numero} vehiculos={vehiculos[p.id] ?? []} ancho={ancho} /> : undefined;

  return (
    <div>
      <Titulo
        detalle="Urgentes primero, después por fecha pedida."
        accion={puede(u.rol, "pedidos.crear") ? <BotonLink href="/pedir" icono={<PlusCircle className="size-5" />}>Pedir un viaje</BotonLink> : undefined}
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
          <ul className="flex flex-col gap-2 lg:hidden">
            {pedidos.map((p) => (
              <FilaPedido key={p.id} p={p} accion={tomar(p)} />
            ))}
          </ul>

          {/* Escritorio: tabla */}
          <div className="hidden overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel lg:block">
            <table className="w-full text-left text-[15px]">
              <thead className="border-b border-linea text-xs tracking-wider text-suave uppercase">
                <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                  <th>Tipo</th>
                  <th>Qué</th>
                  <th>Desde → Obra</th>
                  <th>Para cuándo</th>
                  <th>Pidió</th>
                  <th>Estado</th>
                  {esChofer && <th />}
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {pedidos.map((p) => (
                  <tr key={p.id} className={`hover:bg-fondo/60 [&>td]:px-4 [&>td]:py-3 ${p.prioridad === "URGENTE" && p.estado === "PENDIENTE" ? "bg-critico-fondo/40" : ""}`}>
                    <td>
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <IconoTipo tipo={p.tipo} />
                        {TIPO[p.tipo].corto}
                      </span>
                    </td>
                    <td className="max-w-sm">
                      <Link href={`/solicitudes/${p.id}`} className="line-clamp-2 font-semibold hover:underline">{p.descripcion}</Link>
                      {p.prioridad === "URGENTE" && p.estado === "PENDIENTE" && <Insignia tono="critico" className="mt-1">Urgente</Insignia>}
                    </td>
                    <td>
                      <span className="block text-suave">{p.origen.nombre}</span>
                      <span className="font-medium">Obra {p.obra.nombre}</span>
                    </td>
                    <td className="whitespace-nowrap">{textoParaCuando(p.paraCuando, p.franja)}</td>
                    <td>{p.solicitante.nombre}</td>
                    <td><EstadoPedido p={p} /></td>
                    {esChofer && <td className="text-right">{tomar(p)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
