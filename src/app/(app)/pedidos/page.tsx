import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { PaginaVacia } from "@/components/layout/pagina-vacia";

export const metadata: Metadata = { title: "Cola de pedidos" };

export default async function Pagina() {
  await exigirPermiso("pedidos.ver");
  return <PaginaVacia titulo="Cola de pedidos" icono="pedidos" texto="La cola única de pedidos: lo que falta tomar, lo tomado y lo que está en viaje, en orden." />;
}
