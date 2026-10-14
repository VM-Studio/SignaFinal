import type { Metadata } from "next";
import Link from "next/link";
import { Phone, Store } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { limiteDe } from "@/lib/pagina";
import { PaginaCompleta, Titulo, Vacio } from "@/components/ui/basicos";
import { BarraFiltros } from "@/components/ui/barra-filtros";
import { FichaProveedor } from "@/components/proveedores/ficha";
import { vistasDe } from "@/lib/vistas/consultas";
import { puede } from "@/lib/permisos";
import { NuevoProveedor } from "@/components/proveedores/botones";
import { CargarMas } from "@/components/ui/cargar-mas";
import { fecha } from "@/lib/formato";

export const metadata: Metadata = { title: "Proveedores" };

/**
 * Proveedores con sus sucursales: tabla a todo el ancho (filas de 56 px), buscador por nombre, CUIT o
 * localidad de cualquier sucursal. En escritorio la ficha se abre en el panel derecho (?ver=).
 */
export default async function PaginaProveedores({ searchParams }: { searchParams: Promise<{ q?: string; n?: string; ver?: string }> }) {
  const u = await exigirPermiso("proveedores.ver");
  const carga = puede(u.rol, "proveedores.cargar");
  const { q, n, ver } = await searchParams;
  const vistas = await vistasDe("proveedores");
  const conVer = (id: string | null) => {
    const x = new URLSearchParams({ ...(q ? { q } : {}), ...(n ? { n } : {}), ...(id ? { ver: id } : {}) }).toString();
    return x ? `/proveedores?${x}` : "/proveedores";
  };
  const { limite, siguiente } = await limiteDe(n);
  const t = q?.trim();
  const filas = await db.proveedor.findMany({
    where: {
      activo: true,
      ...(t ? { OR: [{ nombre: { contains: t, mode: "insensitive" } }, { cuit: { contains: t } }, { cuit: { contains: t.replace(/\D/g, "").replace(/^(\d{2})(\d{8})(\d)$/, "$1-$2-$3") || t } }, { sucursales: { some: { OR: [{ localidad: { contains: t, mode: "insensitive" } }, { nombre: { contains: t, mode: "insensitive" } }] } } }] } : {}),
    },
    orderBy: { nombre: "asc" },
    take: limite + 1,
    select: {
      id: true, nombre: true, telefono: true, cuit: true, rubro: true,
      sucursales: { where: { activa: true }, orderBy: [{ principal: "desc" }, { nombre: "asc" }], select: { localidad: true } },
      ordenesCompra: { where: { estado: { in: ["APROBADA", "ESPERANDO_APROBACION"] } }, orderBy: { fecha: "desc" }, take: 1, select: { fecha: true, numero: true } },
      materialesListos: { orderBy: { habilitadoEn: "desc" }, take: 1, select: { habilitadoEn: true } },
    },
  });
  const ultimaCompra = (p: (typeof filas)[number]) => {
    const f = [p.ordenesCompra[0]?.fecha, p.materialesListos[0]?.habilitadoEn].filter((x): x is Date => !!x).sort((a, b) => b.getTime() - a.getTime())[0];
    return f ? fecha(f) : "—";
  };
  const lista = filas.slice(0, limite);
  return (
    <PaginaCompleta>
      <Titulo siempre={carga} accion={carga ? <NuevoProveedor /> : undefined}>Proveedores</Titulo>
      <BarraFiltros pantalla="proveedores" vistas={vistas} buscador={{ placeholder: "Buscar por nombre, CUIT o localidad" }} filtros={[]} />
      {lista.length === 0 ? (
        <Vacio llenar icono={<Store />} titulo={q ? `Ningún proveedor con "${q}"` : "Todavía no hay proveedores cargados"}>{!q && carga ? "Cargá el primero con “Nuevo proveedor”." : null}</Vacio>
      ) : (
        <div className={ver ? "lg:grid lg:grid-cols-[minmax(0,1fr)_480px] lg:gap-4" : ""}>
          <div className="min-w-0">
            <ul className="-mx-4 divide-y divide-linea border-y border-linea bg-papel lg:hidden">
              {lista.map((p) => (
                <li key={p.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                  <Link href={`/proveedores/${p.id}`} className="min-w-0 flex-1">
                    <p className="font-medium">{p.nombre}</p>
                    <p className="truncate text-sm text-suave">{p.sucursales.length} {p.sucursales.length === 1 ? "sucursal" : "sucursales"} · {[...new Set(p.sucursales.map((s) => s.localidad))].join(", ")}</p>
                    <p className="text-[12px] text-suave">Última compra: {ultimaCompra(p)}</p>
                  </Link>
                  {p.telefono && <a href={`tel:${p.telefono.replace(/\s/g, "")}`} aria-label={`Llamar a ${p.nombre}`} className="grid size-11 shrink-0 place-items-center rounded-md border border-linea"><Phone className="size-4" /></a>}
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel lg:block">
              <table className="tabla tabla-56">
                <thead><tr><th>Proveedor</th><th>CUIT</th><th className="num">Sucursales</th><th>Dónde</th><th>Teléfono</th><th>Última compra</th></tr></thead>
                <tbody>
                  {lista.map((p) => (
                    <tr key={p.id} aria-selected={ver === p.id} className={ver === p.id ? "bg-black/[0.04] shadow-[inset_2px_0_0_var(--color-tinta)]" : ""}>
                      <td className="font-medium"><Link href={conVer(ver === p.id ? null : p.id)} scroll={false} className="hover:underline">{p.nombre}</Link>{p.rubro && <span className="text-suave"> · {p.rubro}</span>}</td>
                      <td className="text-suave tabular-nums">{p.cuit ?? "—"}</td>
                      <td className="num">{p.sucursales.length}</td>
                      <td className="max-w-xs truncate text-suave">{[...new Set(p.sucursales.map((s) => s.localidad))].join(", ")}</td>
                      <td className="tabular-nums">{p.telefono ? <a href={`tel:${p.telefono.replace(/\s/g, "")}`} className="hover:underline">{p.telefono}</a> : <span className="text-suave">—</span>}</td>
                      <td className="text-suave">{ultimaCompra(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filas.length > limite && <CargarMas href={`/proveedores?${q ? `q=${encodeURIComponent(q)}&` : ""}n=${siguiente}`} />}
          </div>
          {ver && (
            <aside className="hidden min-w-0 lg:block">
              <div className="sticky top-[calc(var(--alto-header)+24px)] max-h-[calc(100dvh-var(--alto-header)-48px)] overflow-y-auto rounded-[var(--radius-caja)] border border-linea bg-papel p-4">
                <FichaProveedor id={ver} cerrar={conVer(null)} />
              </div>
            </aside>
          )}
        </div>
      )}
    </PaginaCompleta>
  );
}
