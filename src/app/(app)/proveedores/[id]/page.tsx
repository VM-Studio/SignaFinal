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
      pedidos: { where: { estado: "ENTREGADO" }, orderBy: { paraCuando: "desc" }, take: 10, select: { id: true, numero: true, descripcion: true, paraCuando: true, obra: { select: { nombre: true } } } },
    },
  });
  if (!p) notFound();
  const habilitados = compras
    ? await db.materialListo.findMany({ where: { proveedorId: id, estado: { in: ["LISTO", "RETIRO_PEDIDO", "EN_CAMINO"] } }, orderBy: { habilitadoEn: "asc" }, include: { obra: { select: { nombre: true } } } })
    : [];
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/proveedores" className="mb-2 hidden min-h-11 items-center gap-1 font-semibold text-suave lg:inline-flex"><ArrowLeft className="size-5" /> Proveedores</Link>
      <h1 className="text-2xl font-bold lg:text-3xl">{p.nombre}</h1>
      <p className="mt-1 text-suave">{p.direccion}, {p.localidad}{p.idLebane ? ` · Lebane ${p.idLebane}` : ""}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {p.telefono ? <a href={`tel:${p.telefono.replace(/\s/g, "")}`} className="flex min-h-[52px] items-center justify-center gap-2 rounded-[var(--radius-caja)] border-2 border-negro font-semibold"><Phone className="size-5" /> {p.telefono}</a> : <span />}
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.latitud},${p.longitud}`} target="_blank" rel="noopener" className="flex min-h-[52px] items-center justify-center gap-2 rounded-[var(--radius-caja)] bg-negro font-semibold text-white"><Navigation className="size-5" /> Cómo llegar</a>
      </div>
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
