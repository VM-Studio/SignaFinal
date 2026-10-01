import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { PaginaVacia } from "@/components/layout/pagina-vacia";

export const metadata: Metadata = { title: "Proveedores" };

export default async function Pagina() {
  await exigirPermiso("proveedores.ver");
  return <PaginaVacia titulo="Proveedores" icono="proveedores" texto="Corralones y proveedores donde se retira, leídos de Lebane." />;
}
