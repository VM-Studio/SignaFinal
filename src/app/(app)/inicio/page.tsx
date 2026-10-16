import { redirect } from "next/navigation";
import { exigirSesion } from "@/lib/auth/sesion";
import { inicioDe } from "@/lib/permisos";

/** No hay página de inicio: cada rol entra a su primer módulo (inicioDe). El middleware ya redirige; esto es por las dudas. */
export default async function Inicio() {
  const u = await exigirSesion();
  redirect(inicioDe(u.rol));
}
