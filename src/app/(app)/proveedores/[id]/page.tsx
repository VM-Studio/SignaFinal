import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Navigation, Phone, User } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { puede } from "@/lib/permisos";
import { cuando, fecha, plata } from "@/lib/formato";
import { ESTADO_LISTO } from "@/lib/materiales/presentacion";
import { claseBoton } from "@/components/ui/boton";
import { Insignia, Lista, FilaLista, Subtitulo, Tarjeta, Vacio } from "@/components/ui/basicos";
import { MapaPunto } from "@/components/mapa/punto";
import { BotonPrincipal, BotonSucursal, EditarProveedor } from "@/components/proveedores/botones";

export const metadata: Metadata = { title: "Proveedor" };

const ESTADO_OC = { BORRADOR: { t: "Borrador", tono: "neutro" }, ESPERANDO_APROBACION: { t: "Esperando aprobación", tono: "aviso" }, APROBADA: { t: "Aprobada", tono: "ok" }, RECHAZADA: { t: "Rechazada", tono: "critico" }, ANULADA: { t: "Anulada", tono: "neutro" } } as const;

/** Ficha del proveedor: datos, sucursales (dirección, horario, contacto y mapa), órdenes de compra y lo habilitado. */
export default async function PaginaProveedor({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigirPermiso("proveedores.ver");
  const { id } = await params;
  const compras = puede(u.rol, "materiales.gestionar") || puede(u.rol, "materiales.aprobar");
  const carga = puede(u.rol, "proveedores.cargar");
  const p = await db.proveedor.findUnique({
    where: { id },
    include: {
      sucursales: { orderBy: [{ activa: "desc" }, { principal: "desc" }, { nombre: "asc" }] },
      pedidos: { where: { estado: "ENTREGADO" }, orderBy: { paraCuando: "desc" }, take: 10, select: { id: true, numero: true, descripcion: true, paraCuando: true, obra: { select: { nombre: true } } } },
    },
  });
  if (!p) notFound();
  const ordenes = compras
    ? await db.ordenCompra.findMany({ where: { proveedorId: id, estado: { not: "BORRADOR" } }, orderBy: { creadoEn: "desc" }, take: 20, include: { obra: { select: { nombre: true } }, sucursal: { select: { nombre: true } } } })
    : [];
  const habilitados = compras
    ? await db.materialListo.findMany({ where: { proveedorId: id, estado: { in: ["LISTO", "RETIRO_PEDIDO", "EN_CAMINO"] } }, orderBy: { habilitadoEn: "asc" }, include: { obra: { select: { nombre: true } }, sucursal: { select: { nombre: true } } } })
    : [];
  return (
    <div>
      <Link href="/proveedores" className="mb-2 hidden min-h-8 items-center gap-1 text-sm font-medium text-suave hover:text-tinta lg:inline-flex"><ArrowLeft className="size-4" /> Proveedores</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold lg:text-[22px]">{p.nombre}{!p.activo && <span className="text-suave"> · inactivo</span>}</h1>
          <p className="mt-1 text-sm text-suave">{[p.rubro, p.cuit ? `CUIT ${p.cuit}` : null, p.telefono, p.email, p.idLebane ? `Lebane ${p.idLebane}` : null].filter(Boolean).join(" · ") || "Sin datos de contacto"}</p>
          {p.notas && <p className="mt-2 text-sm">{p.notas}</p>}
        </div>
        {carga && (
          <div className="flex gap-2">
            <EditarProveedor inicial={{ id: p.id, nombre: p.nombre, cuit: p.cuit ?? "", telefono: p.telefono ?? "", email: p.email ?? "", rubro: p.rubro ?? "", notas: p.notas ?? "", activo: p.activo }} />
            <BotonSucursal proveedorId={p.id} />
          </div>
        )}
      </div>

      <Subtitulo>Sucursales</Subtitulo>
      {p.sucursales.length === 0 ? <Vacio titulo="Sin sucursales">Agregá la primera: sin sucursal no se puede habilitar ni armar una OC.</Vacio> : (
        <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {p.sucursales.map((s) => (
            <li key={s.id}>
              <Tarjeta className={`flex h-full flex-col gap-3 p-4 ${s.activa ? "" : "opacity-60"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{s.nombre}</p>
                    <p className="text-sm text-suave">{s.direccion}, {s.localidad}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {s.principal && <Insignia tono="activo">Principal</Insignia>}
                    {!s.activa && <Insignia tono="neutro">Inactiva</Insignia>}
                  </div>
                </div>
                <MapaPunto lat={s.latitud} lng={s.longitud} />
                <dl className="grid gap-1 text-sm">
                  <div className="flex items-center gap-2"><Clock className="size-4 text-suave" /><dd>{s.horarioRetiro ?? "Sin horario cargado"}</dd></div>
                  <div className="flex items-center gap-2"><User className="size-4 text-suave" /><dd>{s.contacto ?? "Sin contacto"}</dd></div>
                </dl>
                <div className="mt-auto flex flex-wrap gap-2">
                  {(s.telefono ?? p.telefono) && <a href={`tel:${(s.telefono ?? p.telefono)!.replace(/\s/g, "")}`} className={claseBoton("secundario", "chico")}><Phone /> {s.telefono ?? p.telefono}</a>}
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitud},${s.longitud}`} target="_blank" rel="noopener" className={claseBoton("secundario", "chico")}><Navigation /> Cómo llegar</a>
                  {carga && <BotonSucursal proveedorId={p.id} sucursal={{ id: s.id, nombre: s.nombre, direccion: s.direccion, localidad: s.localidad, lat: s.latitud, lng: s.longitud, horarioRetiro: s.horarioRetiro ?? "", contacto: s.contacto ?? "", telefono: s.telefono ?? "", principal: s.principal, activa: s.activa }} />}
                  {carga && s.activa && !s.principal && <BotonPrincipal sucursalId={s.id} />}
                </div>
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}

      {compras && (
        <>
          <Subtitulo>Órdenes de compra</Subtitulo>
          {!ordenes.length ? <Tarjeta className="p-4 text-sm text-suave">Todavía no hay órdenes de compra a este proveedor.</Tarjeta> : (
            <div className="overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
              <table className="tabla">
                <thead><tr><th>Número</th><th>Obra</th><th className="hidden sm:table-cell">Sucursal</th><th>Fecha</th><th>Estado</th><th className="num">Total</th></tr></thead>
                <tbody>
                  {ordenes.map((o) => (
                    <tr key={o.id}>
                      <td className="font-medium tabular-nums"><Link href={`/compras/${o.pedidoMaterialId}`} className="hover:underline">{o.numero}</Link></td>
                      <td>Obra {o.obra.nombre}</td>
                      <td className="hidden text-suave sm:table-cell">{o.sucursal?.nombre ?? "—"}</td>
                      <td className="text-suave">{fecha(o.fecha)}</td>
                      <td><Insignia tono={ESTADO_OC[o.estado].tono}>{ESTADO_OC[o.estado].t}</Insignia></td>
                      <td className="num">{o.total != null ? plata(o.total.toNumber()) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Subtitulo>Habilitado acá, sin entregar</Subtitulo>
          {habilitados.length === 0 ? <Tarjeta className="p-4 text-sm text-suave">Nada habilitado en este proveedor.</Tarjeta> : (
            <Lista>
              {habilitados.map((m) => (
                <FilaLista key={m.id} href={`/compras/${m.pedidoMaterialId}`} titulo={m.descripcion} detalle={`Obra ${m.obra.nombre} · ${m.sucursal.nombre} · ${m.horarioRetiro ?? "sin horario"}`} derecha={<Insignia tono={ESTADO_LISTO[m.estado].tono}>{ESTADO_LISTO[m.estado].titulo}</Insignia>} />
              ))}
            </Lista>
          )}
        </>
      )}
      <Subtitulo>Últimos retiros</Subtitulo>
      {p.pedidos.length === 0 ? <Tarjeta className="p-4 text-sm text-suave">Todavía no se retiró nada acá.</Tarjeta> : (
        <Lista>
          {p.pedidos.map((x) => <FilaLista key={x.id} titulo={x.descripcion} detalle={`#${x.numero} · Obra ${x.obra.nombre} · ${cuando(x.paraCuando)}`} />)}
        </Lista>
      )}
    </div>
  );
}
