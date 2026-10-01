import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { PaginaVacia } from "@/components/layout/pagina-vacia";

export const metadata: Metadata = { title: "Mapa" };

export default async function Pagina() {
  await exigirPermiso("mapa.ver");
  return <PaginaVacia titulo="Mapa" icono="mapa" texto="El mapa en vivo con el rastreo satelital de Cusat." />;
}
