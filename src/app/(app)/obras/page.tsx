import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { PaginaVacia } from "@/components/layout/pagina-vacia";

export const metadata: Metadata = { title: "Obras" };

export default async function Pagina() {
  await exigirPermiso("obras.ver");
  return <PaginaVacia titulo="Obras" icono="obras" texto="Las obras activas, leídas de Lebane." />;
}
