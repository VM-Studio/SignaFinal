import type { Metadata } from "next";
import { DetalleMaterial } from "@/components/materiales/detalle-material";

export const metadata: Metadata = { title: "Pedido de material" };

export default async function PaginaMaterialObra({ params }: { params: Promise<{ id: string }> }) {
  return <DetalleMaterial id={(await params).id} vista="obra" />;
}
