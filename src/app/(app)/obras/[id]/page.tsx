import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Navigation, Phone, PlusCircle } from "lucide-react";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede, rutaPermitida } from "@/lib/permisos";
import { fichaObra } from "@/lib/obras/consultas";
import { pedidosDeObra } from "@/lib/pedidos/listas";
import { BotonLink, claseBoton } from "@/components/ui/boton";
import { FilaLista, Insignia, Lista, Pestanas, Vacio } from "@/components/ui/basicos";
import { ListaPedidos } from "@/components/pedidos/lista-pedidos";
import { diaMes, fecha, vencimiento } from "@/lib/formato";

export const metadata: Metadata = { title: "Obra" };

const PESTANAS = { pedidos: "Pedidos", herramientas: "Herramientas en la obra", datos: "Datos" } as const;
type Pestana = keyof typeof PESTANAS;

/** Ficha de obra: Pedidos, Herramientas en la obra y Datos. Sin costos ni flota. */
export default async function PaginaObra({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const u = await exigirSesion();
  const [{ id }, { tab: t }] = await Promise.all([params, searchParams]);
  const tab: Pestana = t && t in PESTANAS ? (t as Pestana) : "pedidos";
  const o = await fichaObra(id);
  if (!o) redirect("/inicio"); // no existe o no es una de sus obras

  const base = rutaPermitida(u.rol, "/mis-pedidos") ? "/mis-pedidos" : rutaPermitida(u.rol, "/solicitudes") ? "/solicitudes" : null;
  const verHerramientas = rutaPermitida(u.rol, "/herramientas");
  const maps = `https://www.google.com/maps/dir/?api=1&destination=${o.latitud},${o.longitud}`;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/obras" className="mb-2 hidden min-h-11 items-center gap-1 font-semibold text-suave lg:inline-flex">
        <ArrowLeft className="size-5" /> Obras
      </Link>
      <header className="mb-4">
        <h1 className="text-2xl font-bold lg:text-3xl">Obra {o.nombre}</h1>
        <p className="mt-1 text-suave">{o.direccion}, {o.localidad}{o.estado !== "ACTIVA" ? " · pausada" : ""}</p>
        {puede(u.rol, "pedidos.crear") && o.estado === "ACTIVA" && (
          <BotonLink href={`/pedir?obra=${o.id}`} className="mt-3" icono={<PlusCircle className="size-5" />}>Pedir un viaje para esta obra</BotonLink>
        )}
      </header>

      <Pestanas items={(Object.keys(PESTANAS) as Pestana[]).map((k) => ({ href: k === "pedidos" ? `/obras/${o.id}` : `/obras/${o.id}?tab=${k}`, etiqueta: PESTANAS[k], activa: k === tab }))} />

      {tab === "pedidos" && <Pedidos obraId={o.id} base={base} />}

      {tab === "herramientas" &&
        (o.herramientas.length + o.existencias.length === 0 ? (
          <Vacio titulo="No hay herramientas del depósito en esta obra" />
        ) : (
          <Lista>
            {o.herramientas.map((h) => {
              const vencida = h.devolucionPrevista && vencimiento(h.devolucionPrevista).dias < 0;
              return (
                <FilaLista
                  key={h.id}
                  href={verHerramientas ? `/herramientas/${h.id}` : undefined}
                  titulo={h.nombre}
                  detalle={`${h.responsable ? `La tiene ${h.responsable.nombre}` : "Sin responsable"}${h.desde ? ` desde el ${diaMes(h.desde)}` : ""}${h.devolucionPrevista ? ` · vuelve ${fecha(h.devolucionPrevista)}` : ""}`}
                  derecha={vencida ? <Insignia tono="critico">Vencida</Insignia> : undefined}
                />
              );
            })}
            {o.existencias.map((e) => (
              <FilaLista key={e.id} href={verHerramientas ? `/herramientas/${e.herramienta.id}` : undefined} titulo={`${e.cantidad} ${e.herramienta.nombre.toLowerCase()}`} detalle="Por cantidad" />
            ))}
          </Lista>
        ))}

      {tab === "datos" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
            <p className="text-xs font-bold tracking-wider text-suave uppercase">Dirección</p>
            <p className="mt-1 text-lg font-semibold">{o.direccion}, {o.localidad}</p>
            <a href={maps} target="_blank" rel="noopener" className={claseBoton("primario", "normal", true, "mt-3")}><Navigation className="size-5" /> Abrir en Maps</a>
          </div>
          <div className="rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
            <p className="text-xs font-bold tracking-wider text-suave uppercase">Responsables</p>
            <ul className="mt-2 flex flex-col gap-2">
              {o.responsables.map((r) => (
                <li key={r.usuario.nombre} className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{r.usuario.nombre}{r.principal ? <span className="font-normal text-suave"> · principal</span> : null}</span>
                  {r.usuario.telefono && <a href={`tel:${r.usuario.telefono.replace(/\s/g, "")}`} className={claseBoton("secundario", "chico")}><Phone className="size-4" /> Llamar</a>}
                </li>
              ))}
              {o.responsables.length === 0 && <li className="text-suave">Sin responsable asignado</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

async function Pedidos({ obraId, base }: { obraId: string; base: string | null }) {
  const pedidos = await pedidosDeObra(obraId);
  return pedidos.length === 0 ? <Vacio titulo="Nada en los últimos 7 días" /> : <ListaPedidos filas={pedidos} base={base} conSolicitante />;
}
