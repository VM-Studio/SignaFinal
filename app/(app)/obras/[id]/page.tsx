import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { startOfMonth } from "date-fns";
import { requerirUsuario } from "@/lib/auth/usuario-actual";
import { puede } from "@/lib/permisos";
import { db } from "@/lib/db";
import { obtenerCola } from "@/lib/datos/pedidos";
import { inventario } from "@/lib/datos/deposito";
import { Cifra, Subtitulo, Vacio } from "@/components/ui/basicos";
import { TarjetaPedido } from "@/components/pedidos/tarjeta-pedido";
import { plata } from "@/lib/formato";

export const metadata: Metadata = { title: "Obra" };

export default async function PaginaObra({ params }: { params: Promise<{ id: string }> }) {
  const u = await requerirUsuario("obras.ver");
  const { id } = await params;
  const obra = await db.obra.findUnique({ where: { id }, include: { responsables: { select: { nombre: true } } } });
  if (!obra) notFound();
  const [cola, items, mes, ocs] = await Promise.all([
    obtenerCola({ obraIds: [id] }),
    inventario({ donde: id }),
    db.viaje.aggregate({ where: { obraId: id, estado: "FINALIZADO", llegadaEn: { gte: startOfMonth(new Date()) } }, _sum: { costo: true }, _count: { _all: true } }),
    db.ordenCompra.findMany({ where: { obraId: id, abierta: true }, include: { proveedor: { select: { nombre: true } } }, orderBy: { fecha: "desc" } }),
  ]);
  const pedidos = [...cola.pendientes, ...cola.tomados, ...cola.enViaje];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/obras" className="mb-2 inline-flex min-h-11 items-center gap-1 font-semibold text-suave"><ArrowLeft className="size-5" /> Obras</Link>
      <h1 className="text-3xl font-bold tracking-tight">Obra {obra.nombre}</h1>
      <p className="text-suave">{[obra.direccion, obra.localidad].filter(Boolean).join(", ")} · Responsables: {obra.responsables.map((r) => r.nombre).join(", ") || "—"}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3">
        <Cifra etiqueta="Viajes en curso" valor={pedidos.length} />
        <Cifra etiqueta="Herramientas en obra" valor={items.length} />
        {puede(u.rol, "costos.ver") && <Cifra etiqueta="Viajes este mes" valor={plata(Number(mes._sum.costo ?? 0))} detalle={`${mes._count._all} viajes`} />}
      </div>

      <Subtitulo>Pedidos en curso</Subtitulo>
      {pedidos.length === 0 ? <Vacio titulo="Ninguno" /> : <ul className="flex flex-col gap-3">{pedidos.map((p) => <TarjetaPedido key={p.id} p={p} />)}</ul>}

      <Subtitulo>Órdenes de compra abiertas (Lebane)</Subtitulo>
      {ocs.length === 0 ? (
        <Vacio titulo="Ninguna" />
      ) : (
        <ul className="divide-y divide-linea rounded-[var(--radius-caja)] border border-linea bg-papel">
          {ocs.map((o) => (
            <li key={o.id} className="px-4 py-3">
              <p className="font-semibold">{o.proveedor.nombre} · {o.numero}</p>
              <p className="text-sm text-suave">{o.descripcion}</p>
            </li>
          ))}
        </ul>
      )}

      <Subtitulo>Herramientas y máquinas en la obra</Subtitulo>
      {items.length === 0 ? (
        <Vacio titulo="Ninguna" />
      ) : (
        <ul className="divide-y divide-linea rounded-[var(--radius-caja)] border border-linea bg-papel">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={`/deposito/${i.id}`} className="block px-4 py-3">
                <span className="font-semibold">{i.control === "CANTIDAD" ? `${i.enObras.find((o) => o.obraId === id)?.cantidad} ${i.nombre.toLowerCase()}` : i.nombre}</span>
                {i.tenedor && <span className="text-suave"> · {i.tenedor}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
