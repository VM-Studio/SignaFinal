import type { Metadata } from "next";
import { datosNuevoPedidoCompras } from "@/lib/materiales/consultas";
import { FormularioMateriales } from "@/components/materiales/formulario-materiales";

export const metadata: Metadata = { title: "Nuevo pedido de material" };

/** Compras carga un pedido que le hicieron por teléfono, a nombre de la obra y de quien lo pidió. */
export default async function PaginaNuevoMaterial() {
  const obras = await datosNuevoPedidoCompras(); // verifica materiales.gestionar
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-2xl font-bold">Nuevo pedido de material</h1>
      <p className="mb-4 text-suave">Para lo que te piden por teléfono. Le llegan los avisos a quien lo pidió.</p>
      <FormularioMateriales obras={obras} compras />
    </div>
  );
}
