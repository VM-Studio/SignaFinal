import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { DetalleMaterial } from "@/components/materiales/detalle-material";

export const metadata: Metadata = { title: "Pedido de material" };

export default async function PaginaMaterialCompras({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermiso("materiales.gestionar");
  return <DetalleMaterial id={(await params).id} vista="compras" />;
}
