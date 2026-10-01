import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { PaginaVacia } from "@/components/layout/pagina-vacia";

export const metadata: Metadata = { title: "Entregas" };

export default async function Pagina() {
  await exigirPermiso("herramientas.mover");
  return <PaginaVacia titulo="Entregas" icono="entregas" texto="Entregas y devoluciones entre el depósito y las obras." />;
}
