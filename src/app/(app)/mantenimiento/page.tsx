import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { PaginaVacia } from "@/components/layout/pagina-vacia";

export const metadata: Metadata = { title: "Mantenimiento" };

export default async function Pagina() {
  await exigirPermiso("mantenimiento.ver");
  return <PaginaVacia titulo="Mantenimiento" icono="mantenimiento" texto="Services, reparaciones y neumáticos de la flota." />;
}
