import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { PaginaVacia } from "@/components/layout/pagina-vacia";

export const metadata: Metadata = { title: "Sobrantes" };

export default async function Pagina() {
  await exigirPermiso("sobrantes.ver");
  return <PaginaVacia titulo="Sobrantes" icono="sobrantes" texto="Los materiales eléctricos y sanitarios que quedan en el depósito." />;
}
