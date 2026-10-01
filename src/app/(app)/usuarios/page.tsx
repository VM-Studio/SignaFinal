import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { PaginaVacia } from "@/components/layout/pagina-vacia";

export const metadata: Metadata = { title: "Usuarios" };

export default async function Pagina() {
  await exigirPermiso("usuarios.gestionar");
  return <PaginaVacia titulo="Usuarios" icono="usuarios" texto="Quién entra a la app y con qué rol." />;
}
