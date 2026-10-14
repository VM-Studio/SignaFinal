import type { Metadata } from "next";
import { formularioOC } from "@/lib/compras/consultas";
import { PaginaPlantilla } from "@/components/compras/pagina-plantilla";

export const metadata: Metadata = { title: "Nueva orden" };

/** Nueva OC o PE directo desde Órdenes (sin pedido de material previo: se crea por detrás). */
export default async function PaginaNuevaOrden({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  const d = await formularioOC({ tipo: tipo === "PE" ? "PE" : "OC" }); // verifica materiales.gestionar
  return <PaginaPlantilla d={d!} volver={{ href: "/compras/ordenes", texto: "Órdenes" }} />;
}
