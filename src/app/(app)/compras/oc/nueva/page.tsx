import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigirSesion } from "@/lib/auth/sesion";
import { Titulo } from "@/components/ui/basicos";
import { OpcionesNueva } from "@/components/compras/documento/nueva";

export const metadata: Metadata = { title: "Nueva" };

/** "Nueva" (tablero) y "Pedir" de compras: pedir materiales (rápido), armar orden de compra o armar pedido especial. */
export default async function PaginaNueva() {
  const u = await exigirSesion();
  if (u.rol === "CHOFER" || u.rol === "DEPOSITO") redirect("/inicio");
  return (
    <div>
      <Titulo siempre>Nueva</Titulo>
      <OpcionesNueva rapida={u.rol === "ADMINISTRACION" ? null : u.rol === "COMPRAS" ? "/compras/nuevo" : "/pedir-materiales"} />
    </div>
  );
}
