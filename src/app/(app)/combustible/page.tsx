import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { PaginaVacia } from "@/components/layout/pagina-vacia";

export const metadata: Metadata = { title: "Combustible" };

export default async function Pagina() {
  await exigirPermiso("combustible.ver");
  return <PaginaVacia titulo="Combustible" icono="combustible" texto="Las cargas de combustible de cada vehículo." />;
}
