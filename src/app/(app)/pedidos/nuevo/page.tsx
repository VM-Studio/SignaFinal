import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { PaginaVacia } from "@/components/layout/pagina-vacia";

export const metadata: Metadata = { title: "Pedir un viaje" };

export default async function Pagina() {
  await exigirPermiso("pedidos.crear");
  return <PaginaVacia titulo="Pedir un viaje" icono="pedir" texto="Acá vas a pedir un viaje en pasos cortos, eligiendo todo de listas." />;
}
