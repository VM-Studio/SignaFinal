import type { Metadata } from "next";
import { ListOrdered, PlusCircle } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { BotonLink } from "@/components/ui/boton";
import { Pestanas, Titulo, Vacio } from "@/components/ui/basicos";
import { BotonTomar } from "@/components/pedidos/tomar";
import { TarjetaChofer } from "@/components/viajes/tarjeta-chofer";
import { MarcarSolicitudesVistas } from "@/components/pedidos/solicitudes-vistas";
import { CargarMas } from "@/components/ui/cargar-mas";
import { limiteDe } from "@/lib/pagina";
import { FILTROS_SOLICITUDES, solicitudesPendientes, type FiltroSolicitudes } from "@/lib/viajes/chofer";
import { VistaSolicitudes } from "@/components/pedidos/vista-solicitudes";

export const metadata: Metadata = { title: "Solicitudes" };

/** Chofer: tarjetas para aceptar. Dirección: todas las solicitudes con filtros. */
export default async function PaginaSolicitudes(props: { searchParams: Promise<{ filtro?: string }> }) {
  const u = await exigirPermiso("pedidos.ver");
  if (u.rol === "CHOFER") {
    const sp = (await props.searchParams) as { filtro?: string; n?: string };
    return <VistaChofer filtro={sp.filtro} n={sp.n} />;
  }
  return <VistaDireccion searchParams={props.searchParams as Promise<Record<string, string | string[] | undefined>>} />;
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
            <TarjetaChofer key={t.pedidoId} t={t} href={`/solicitudes/${t.pedidoId}`} accion={<BotonTomar pedidoId={t.pedidoId} numero={t.numero} vehiculos={t.vehiculos} pesoKg={t.pesoKg} tipo={t.tipo} ancho tamano="grande" />} />
          ))}
        </ul>
      )}
      {hayMas && <CargarMas href={`/solicitudes?${filtro !== "todas" ? `filtro=${filtro}&` : ""}n=${siguiente}`} />}
    </div>
  );
}

/** Dirección: todas las solicitudes con la misma barra de filtros que Compras (y Asignar en las pendientes). */
async function VistaDireccion({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const u = await exigirPermiso("pedidos.ver");
  return (
    <div>
      <Titulo siempre detalle="Pendientes, aceptadas, en curso y lo entregado hoy. Filtrá por obra, lugar, quién pidió o chofer."
        accion={puede(u.rol, "pedidos.crear") ? <BotonLink href="/pedir" icono={<PlusCircle />}>Pedir un viaje</BotonLink> : undefined}>
        Solicitudes
      </Titulo>
      <VistaSolicitudes sp={await searchParams} ruta="/solicitudes" />
    </div>
  );
}
