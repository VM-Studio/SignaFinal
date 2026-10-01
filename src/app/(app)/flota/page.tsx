import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { PaginaVacia } from "@/components/layout/pagina-vacia";

export const metadata: Metadata = { title: "Flota" };

export default async function Pagina() {
  await exigirPermiso("flota.ver");
  return <PaginaVacia titulo="Flota" icono="flota" texto="Camiones, camionetas y autos con su documentación y su estado." />;
}
