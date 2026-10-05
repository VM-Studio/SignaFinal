import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Navigation, PlusCircle } from "lucide-react";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede, rutaPermitida } from "@/lib/permisos";
import { fichaObra } from "@/lib/obras/consultas";
import { pedidosDeObra } from "@/lib/pedidos/listas";
import { BotonLink, claseBoton } from "@/components/ui/boton";
import { FilaLista, Insignia, Lista, Subtitulo, Vacio } from "@/components/ui/basicos";
import { ListaPedidos } from "@/components/pedidos/lista-pedidos";
import { fecha, vencimiento } from "@/lib/formato";

export const metadata: Metadata = { title: "Obra" };

export default async function PaginaObra({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigirSesion();
  const { id } = await params;
  const [o, pedidos] = await Promise.all([fichaObra(id), pedidosDeObra(id)]);
  if (!o) redirect("/inicio"); // no existe o no es una de sus obras

  const base = rutaPermitida(u.rol, "/mis-pedidos") ? "/mis-pedidos" : rutaPermitida(u.rol, "/solicitudes") ? "/solicitudes" : null;
  const verHerramientas = rutaPermitida(u.rol, "/herramientas");
  const maps = `https://www.google.com/maps/dir/?api=1&destination=${o.latitud},${o.longitud}`;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/obras" className="mb-2 hidden min-h-11 items-center gap-1 font-semibold text-suave lg:inline-flex">
        <ArrowLeft className="size-5" /> Obras
      </Link>
      <header>
        <p className="text-sm font-semibold tracking-wider text-suave uppercase">{o.codigo}</p>
        <h1 className="mt-1 text-2xl font-bold lg:text-3xl">Obra {o.nombre}</h1>
        <p className="mt-1 text-suave">{o.direccion}, {o.localidad}</p>
        <p className="mt-1">
          {o.responsables.map((r) => `${r.usuario.nombre}${r.principal ? " (principal)" : ""}`).join(" · ") || "Sin responsable"}
          {o.estado !== "ACTIVA" && <Insignia tono="aviso" className="ml-2">Pausada</Insignia>}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {puede(u.rol, "pedidos.crear") && o.estado === "ACTIVA" && <BotonLink href={`/pedir?obra=${o.id}`} icono={<PlusCircle className="size-5" />}>Pedir un viaje</BotonLink>}
          <a href={maps} target="_blank" rel="noopener" className={claseBoton("secundario")}><Navigation className="size-5" /> Cómo llegar</a>
        </div>
      </header>

      <Subtitulo>Pedidos y viajes</Subtitulo>
      {pedidos.length === 0 ? <Vacio titulo="Nada en los últimos 7 días" /> : <ListaPedidos filas={pedidos} base={base} conSolicitante />}

      <Subtitulo>Herramientas del depósito en la obra</Subtitulo>
      {o.herramientas.length + o.existencias.length === 0 ? (
        <Vacio titulo="No hay herramientas del depósito acá" />
      ) : (
        <Lista>
          {o.herramientas.map((h) => {
            const v = h.devolucionPrevista ? vencimiento(h.devolucionPrevista) : null;
            return (
              <FilaLista
                key={h.id}
                href={verHerramientas ? `/herramientas/${h.id}` : undefined}
                titulo={h.nombre}
                detalle={`${h.codigo}${h.devolucionPrevista ? ` · vuelve ${fecha(h.devolucionPrevista)}` : ""}`}
                derecha={v && v.tono === "critico" ? <Insignia tono="critico">Vencida</Insignia> : undefined}
              />
            );
          })}
          {o.existencias.map((e) => (
            <FilaLista key={e.id} href={verHerramientas ? `/herramientas/${e.herramienta.id}` : undefined} titulo={`${e.cantidad} ${e.herramienta.nombre.toLowerCase()}`} />
          ))}
        </Lista>
      )}
    </div>
  );
}
