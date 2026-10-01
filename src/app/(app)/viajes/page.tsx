import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { PaginaVacia } from "@/components/layout/pagina-vacia";

export const metadata: Metadata = { title: "Viajes" };

export default async function Pagina() {
  const u = await exigirSesion();
  const propios = puede(u.rol, "viajes.verPropios");
  if (!propios && !puede(u.rol, "viajes.verTodos")) redirect("/inicio?sin-permiso=1");
  return propios ? (
    <PaginaVacia titulo="Mis viajes" icono="viajes" texto="Tus viajes: el que está en curso, los programados y los terminados con sus km." />
  ) : (
    <PaginaVacia titulo="Viajes" icono="viajes" texto="Todos los viajes con chofer, vehículo, km y costo imputado a cada obra." />
  );
}
