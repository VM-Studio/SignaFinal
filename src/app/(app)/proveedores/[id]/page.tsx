import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Navigation, Phone } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { puede } from "@/lib/permisos";
import { cuando } from "@/lib/formato";
import { ESTADO_LISTO } from "@/lib/materiales/presentacion";
import { Insignia, Lista, FilaLista, Subtitulo, Tarjeta, Vacio } from "@/components/ui/basicos";

export const metadata: Metadata = { title: "Proveedor" };

/** Ficha del proveedor (viene de Lebane): contacto, cómo llegar, lo habilitado y los últimos retiros. */
export default async function PaginaProveedor({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigirPermiso("proveedores.ver");
  const { id } = await params;
  const compras = puede(u.rol, "materiales.gestionar");
  const p = await db.proveedor.findUnique({
    where: { id },
    include: {
      sucursales: { where: { activa: true }, orderBy: [{ principal: "desc" }, { nombre: "asc" }] },
      pedidos: { where: { estado: "ENTREGADO" }, orderBy: { paraCuando: "desc" }, take: 10, select: { id: true, numero: true, descripcion: true, paraCuando: true, obra: { select: { nombre: true } } } },
    },
  });
  if (!p) notFound();
  const habilitados = compras
    ? await db.materialListo.findMany({ where: { proveedorId: id, estado: { in: ["LISTO", "RETIRO_PEDIDO", "EN_CAMINO"] } }, orderBy: { habilitadoEn: "asc" }, include: { obra: { select: { nombre: true } } } })
    : [];
  return (
    <div>
      <Link href="/proveedores" className="mb-2 hidden min-h-11 items-center gap-1 font-semibold text-suave lg:inline-flex"><ArrowLeft className="size-5" /> Proveedores</Link>
      <h1 className="text-2xl font-semibold lg:text-3xl">{p.nombre}</h1>
      {p.idLebane && <p className="mt-1 text-suave">Lebane {p.idLebane}</p>}
      <Subtitulo>Sucursales</Subtitulo>
      <ul className="flex flex-col gap-2">
        {p.sucursales.map((s) => (
          <li key={s.id}>
            <Tarjeta className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.nombre}{s.principal ? " · principal" : ""}</p>
                <p className="text-sm text-suave">{s.direccion}, {s.localidad}{s.horarioRetiro ? ` · ${s.horarioRetiro}` : ""}</p>
              </div>
              {(s.telefono ?? p.telefono) && <a href={`tel:${(s.telefono ?? p.telefono)!.replace(/\s/g, "")}`} aria-label={`Llamar a ${s.nombre}`} className="grid size-10 shrink-0 place-items-center rounded-md border border-linea"><Phone className="size-4" /></a>}
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitud},${s.longitud}`} target="_blank" rel="noopener" aria-label={`Cómo llegar a ${s.nombre}`} className="grid size-10 shrink-0 place-items-center rounded-md border border-linea"><Navigation className="size-4" /></a>
            </Tarjeta>
          </li>
        ))}
      </ul>
      {compras && (
        <>
          <Subtitulo>Habilitado acá, sin entregar</Subtitulo>
          {habilitados.length === 0 ? <Vacio titulo="Nada habilitado en este proveedor" /> : (
            <Lista>
              {habilitados.map((m) => (
                <FilaLista key={m.id} href={`/compras/${m.pedidoMaterialId}`} titulo={m.descripcion} detalle={`Obra ${m.obra.nombre} · ${m.horarioRetiro ?? "sin horario"}`} derecha={<Insignia tono={ESTADO_LISTO[m.estado].tono}>{ESTADO_LISTO[m.estado].titulo}</Insignia>} />
              ))}
            </Lista>
          )}
        </>
      )}
      <Subtitulo>Últimos retiros</Subtitulo>
      {p.pedidos.length === 0 ? <Tarjeta className="p-4 text-suave">Todavía no se retiró nada acá.</Tarjeta> : (
        <Lista>
          {p.pedidos.map((x) => <FilaLista key={x.id} titulo={x.descripcion} detalle={`#${x.numero} · Obra ${x.obra.nombre} · ${cuando(x.paraCuando)}`} />)}
        </Lista>
      )}
    </div>
  );
}
