import type { Metadata } from "next";
import Link from "next/link";
import { Phone, Store } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { limiteDe } from "@/lib/pagina";
import { Buscador } from "@/components/ui/campos";
import { Titulo, Vacio } from "@/components/ui/basicos";
import { puede } from "@/lib/permisos";
import { NuevoProveedor } from "@/components/proveedores/botones";
import { CargarMas } from "@/components/ui/cargar-mas";
import { fecha } from "@/lib/formato";

export const metadata: Metadata = { title: "Proveedores" };

/** Proveedores con sus sucursales. Buscador por nombre, CUIT o localidad de cualquier sucursal. */
export default async function PaginaProveedores({ searchParams }: { searchParams: Promise<{ q?: string; n?: string }> }) {
  const u = await exigirPermiso("proveedores.ver");
  const carga = puede(u.rol, "proveedores.cargar");
  const { q, n } = await searchParams;
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
    <div>
      <Titulo siempre={carga} accion={carga ? <NuevoProveedor /> : undefined} detalle="Cada proveedor con sus sucursales: lo que se elige y adonde va el chofer es la sucursal.">Proveedores</Titulo>
      <div className="mb-3 lg:max-w-md"><Buscador accion="/proveedores" valor={q} placeholder="Buscar por nombre, CUIT o localidad" /></div>
      {lista.length === 0 ? (
        <Vacio icono={<Store />} titulo={q ? `Ningún proveedor con "${q}"` : "Todavía no hay proveedores cargados"}>{!q && carga ? "Cargá el primero con “Nuevo proveedor”." : null}</Vacio>
      ) : (
        <>
          <ul className="-mx-4 divide-y divide-linea border-y border-linea bg-papel lg:hidden">
            {lista.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <Link href={`/proveedores/${p.id}`} className="min-w-0 flex-1">
                  <p className="font-medium">{p.nombre}</p>
                  <p className="truncate text-sm text-suave">{p.sucursales.length} {p.sucursales.length === 1 ? "sucursal" : "sucursales"} · {[...new Set(p.sucursales.map((s) => s.localidad))].join(", ")}</p>
                  <p className="text-[12px] text-suave">Última compra: {ultimaCompra(p)}</p>
                </Link>
                {p.telefono && <a href={`tel:${p.telefono.replace(/\s/g, "")}`} aria-label={`Llamar a ${p.nombre}`} className="grid size-11 shrink-0 place-items-center rounded-md border border-linea"><Phone className="size-4" /></a>}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel lg:block">
            <table className="tabla">
              <thead><tr><th>Proveedor</th><th>CUIT</th><th className="num">Sucursales</th><th>Dónde</th><th>Teléfono</th><th>Última compra</th></tr></thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium"><Link href={`/proveedores/${p.id}`} className="hover:underline">{p.nombre}</Link>{p.rubro && <span className="text-suave"> · {p.rubro}</span>}</td>
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
        </>
      )}
      {filas.length > limite && <CargarMas href={`/proveedores?${q ? `q=${encodeURIComponent(q)}&` : ""}n=${siguiente}`} />}
    </div>
  );
}
