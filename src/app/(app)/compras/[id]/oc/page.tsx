import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { formularioOC } from "@/lib/compras/consultas";
import { PaginaPlantilla } from "@/components/compras/pagina-plantilla";

export const metadata: Metadata = { title: "Orden de compra" };

/** Armar (o retomar) la orden de un pedido de material, con el pedido al lado para copiar datos. */
export default async function PaginaOC({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await formularioOC({ pedidoId: id }); // verifica materiales.gestionar
  if (!d?.pedido) notFound();
  // Ya enviada o aprobada: se edita desde Órdenes (misma plantilla, con versión).
  if (d.orden && d.orden.estado !== "BORRADOR") redirect(`/compras/ordenes/${d.orden.id}`);
  if (d.pedido.estado !== "EN_COMPRA") redirect(`/compras/${id}`);
  return <PaginaPlantilla d={d} volver={{ href: `/compras/${id}`, texto: "Volver al pedido" }} />;
}
