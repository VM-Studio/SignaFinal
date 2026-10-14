import type { Metadata } from "next";
import { FichaProveedor } from "@/components/proveedores/ficha";

export const metadata: Metadata = { title: "Proveedor" };

/** Ficha del proveedor a página completa (desde la lista se abre en el panel derecho). */
export default async function PaginaProveedor({ params }: { params: Promise<{ id: string }> }) {
  return <FichaProveedor id={(await params).id} />;
}
