import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { formularioOC } from "@/lib/compras/consultas";
import { PaginaPlantilla } from "@/components/compras/pagina-plantilla";

export const metadata: Metadata = { title: "Orden" };

/** Una orden en la plantilla: borrador para seguir, o enviada/autorizada para editar (con versión). */
export default async function PaginaOrden({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await formularioOC({ ocId: id }); // verifica materiales.gestionar
  if (!d?.orden) notFound();
  // Importadas, anuladas y rechazadas no se editan en la plantilla: se ven en el tablero.
  if (d.orden.fuente === "IMPORTADA_EXCEL" || d.orden.estado === "ANULADA" || d.orden.estado === "RECHAZADA") redirect(`/compras/ordenes?ver=${id}`);
  return <PaginaPlantilla d={d} volver={{ href: "/compras/ordenes", texto: "Órdenes" }} />;
}
