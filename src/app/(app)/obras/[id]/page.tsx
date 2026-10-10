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
import { db } from "@/lib/db";
import { MapaPunto } from "@/components/mapa/punto";
import { BotonSede, EditarObra } from "@/components/obras/formulario-obra";

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
  const carga = puede(u.rol, "obras.cargar");
  const responsables = carga ? await db.usuario.findMany({ where: { rol: { in: ["RESPONSABLE_OBRA", "CAPATAZ"] }, activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }) : [];

  return (
    <div>
      <Link href="/obras" className="mb-2 hidden min-h-11 items-center gap-1 font-semibold text-suave lg:inline-flex">
        <ArrowLeft className="size-5" /> Obras
      </Link>
      <header className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold lg:text-[22px]">Obra {o.nombre}</h1>
            <p className="mt-1 text-sm text-suave">{o.direccion}, {o.localidad}{o.estado === "PAUSADA" ? " · pausada" : o.estado === "FINALIZADA" ? " · finalizada" : ""}</p>
          </div>
          {carga && (
            <EditarObra
              responsables={responsables}
              obra={{ id: o.id, nombre: o.nombre, direccion: o.direccion, localidad: o.localidad, lat: o.latitud, lng: o.longitud, radioGeocercaM: o.radioGeocercaM, estado: o.estado, responsables: o.responsables.map((r) => r.usuario.id) }}
            />
          )}
        </div>
        {puede(u.rol, "pedidos.crear") && o.estado === "ACTIVA" && (
          <BotonLink href={`/pedir?obra=${o.id}`} className="mt-3" icono={<PlusCircle />}>Pedir un viaje para esta obra</BotonLink>
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
          <div className="grid gap-3 rounded-[var(--radius-caja)] border border-linea bg-papel p-4 lg:grid-cols-[1fr_320px]">
            <div>
              <p className="etiqueta">Dirección</p>
              <p className="mt-1 font-medium">{o.direccion}, {o.localidad}</p>
              <p className="mt-1 text-sm text-suave">Geocerca: {o.radioGeocercaM} m</p>
              <a href={maps} target="_blank" rel="noopener" className={claseBoton("secundario", "normal", false, "mt-3")}><Navigation /> Abrir en Maps</a>
            </div>
            <MapaPunto lat={o.latitud} lng={o.longitud} />
          </div>
          {(o.sedes.length > 0 || carga) && (
            <div className="rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="etiqueta">Sedes (frentes de la obra)</p>
                {carga && <BotonSede obraId={o.id} />}
              </div>
              {o.sedes.length === 0 ? (
                <p className="mt-2 text-sm text-suave">Sin sedes. Si la obra tiene más de un frente, agregalos: al pedir se elige a cuál va.</p>
              ) : (
                <ul className="mt-2 flex flex-col divide-y divide-linea">
                  {o.sedes.map((s) => (
                    <li key={s.id} className={`flex items-center gap-3 py-2 ${s.activa ? "" : "opacity-60"}`}>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{s.nombre}{!s.activa && <span className="text-suave"> · inactiva</span>}</p>
                        <p className="text-sm text-suave">{s.direccion}, {s.localidad}</p>
                      </div>
                      {carga && <BotonSede obraId={o.id} etiqueta="Editar" sede={{ id: s.id, nombre: s.nombre, direccion: s.direccion, localidad: s.localidad, lat: s.latitud, lng: s.longitud, activa: s.activa }} />}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
            <p className="etiqueta">Responsables</p>
            <ul className="mt-2 flex flex-col gap-2">
              {o.responsables.map((r) => (
                <li key={r.usuario.nombre} className="flex items-center justify-between gap-3">
                  <span className="font-medium">{r.usuario.nombre}{r.principal ? <span className="font-normal text-suave"> · principal</span> : null}</span>
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
