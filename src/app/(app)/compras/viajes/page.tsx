import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { datosFormulario } from "@/lib/pedidos/consultas";
import { datosCoordinar } from "@/lib/materiales/consultas";
import { favoritos, historialViajes } from "@/lib/historial/consultas";
import { Titulo } from "@/components/ui/basicos";
import { CoordinarViaje } from "@/components/pedidos/coordinar-viaje";
import { PestanasViajesCompras } from "@/components/pedidos/pestanas-viajes-compras";

export const metadata: Metadata = { title: "Coordinar viaje" };

/** Compras pide un viaje para las arquitectas (a nombre de ellas), con sus viajes anteriores a la derecha. */
export default async function PaginaCoordinar() {
  await exigirPermiso("pedidos.coordinar");
  const [datos, { obras, listos }, items, favs] = await Promise.all([datosFormulario(), datosCoordinar(), historialViajes(), favoritos("VIAJE")]);
  return (
    <div>
      <Titulo siempre>Viajes</Titulo>
      <PestanasViajesCompras activa="coordinar" />
      <CoordinarViaje datos={datos} obras={obras} listos={listos} historial={{ items, favoritos: favs }} />
    </div>
  );
}
