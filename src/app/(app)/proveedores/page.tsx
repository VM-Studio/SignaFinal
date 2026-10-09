import type { Metadata } from "next";
import Link from "next/link";
import { Navigation, Phone, Store } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { limiteDe } from "@/lib/pagina";
import { Buscador } from "@/components/ui/campos";
import { Titulo, Vacio } from "@/components/ui/basicos";
import { puede } from "@/lib/permisos";
import { NuevoProveedor } from "@/components/proveedores/nuevo-proveedor";
import { CargarMas } from "@/components/ui/cargar-mas";

export const metadata: Metadata = { title: "Proveedores" };

/** Corralones y proveedores donde se retira. Vienen de Lebane: acá solo se consultan. */
export default async function PaginaProveedores({ searchParams }: { searchParams: Promise<{ q?: string; n?: string }> }) {
  const u = await exigirPermiso("proveedores.ver");
  const carga = puede(u.rol, "proveedores.cargar");
  const { q, n } = await searchParams;
  const { limite, siguiente } = await limiteDe(n);
  const desde = new Date(Date.now() - 30 * 86_400_000);
  const filas = await db.proveedor.findMany({
    where: q ? { OR: [{ nombre: { contains: q, mode: "insensitive" } }, { localidad: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { nombre: "asc" },
    take: limite + 1,
    select: { id: true, nombre: true, direccion: true, localidad: true, telefono: true, latitud: true, longitud: true, idLebane: true, _count: { select: { pedidos: { where: { creadoEn: { gte: desde } } } } } },
  });
  return (
    <div>
      <Titulo siempre={carga} accion={carga ? <NuevoProveedor /> : undefined} detalle="Mientras no haya conexión con Lebane, se cargan acá.">Proveedores</Titulo>
      <div className="mb-3"><Buscador accion="/proveedores" valor={q} placeholder="Buscar por nombre o localidad" /></div>
      {filas.length === 0 ? (
        <Vacio icono={<Store className="size-10" />} titulo={q ? `Ningún proveedor con "${q}"` : "Todavía no hay proveedores cargados"}>{!q && carga ? "Cargá el primero con “Nuevo proveedor”." : null}</Vacio>
      ) : (
        <ul className="divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
          {filas.slice(0, limite).map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/proveedores/${p.id}`} className="font-semibold underline-offset-2 hover:underline">{p.nombre}</Link>
                <p className="text-sm text-suave">{p.direccion}, {p.localidad}</p>
                <p className="text-sm text-suave">{p._count.pedidos ? `${p._count.pedidos} ${p._count.pedidos === 1 ? "viaje" : "viajes"} en los últimos 30 días` : "Sin viajes en los últimos 30 días"}</p>
              </div>
              {p.telefono && (
                <a href={`tel:${p.telefono.replace(/\s/g, "")}`} aria-label={`Llamar a ${p.nombre}`} className="grid size-12 shrink-0 place-items-center rounded-md border border-linea"><Phone className="size-5" /></a>
              )}
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.latitud},${p.longitud}`} target="_blank" rel="noopener" aria-label={`Cómo llegar a ${p.nombre}`} className="grid size-12 shrink-0 place-items-center rounded-md border border-linea"><Navigation className="size-5" /></a>
            </li>
          ))}
        </ul>
      )}
      {filas.length > limite && <CargarMas href={`/proveedores?${q ? `q=${encodeURIComponent(q)}&` : ""}n=${siguiente}`} />}
    </div>
  );
}
