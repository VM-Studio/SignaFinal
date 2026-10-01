import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { PaginaVacia } from "@/components/layout/pagina-vacia";

export const metadata: Metadata = { title: "Herramientas" };

export default async function Pagina() {
  await exigirPermiso("herramientas.ver");
  return <PaginaVacia titulo="Herramientas" icono="herramientas" texto="Maquinaria y herramientas: dónde está cada una y quién la tiene." />;
}
