import type { Metadata } from "next";
import { datosNuevoPedidoCompras } from "@/lib/materiales/consultas";
import { MaterialesConHistorial } from "@/components/historial/con-historial";
import { favoritos, historialMateriales } from "@/lib/historial/consultas";

export const metadata: Metadata = { title: "Nuevo pedido de material" };

/** Compras carga un pedido que le hicieron por teléfono, a nombre de la obra y de quien lo pidió. */
export default async function PaginaNuevoMaterial() {
  const { obras, responsables } = await datosNuevoPedidoCompras(); // verifica materiales.gestionar
  // El mismo panel de pedidos anteriores, con los de todas las obras.
  const [items, favs] = await Promise.all([historialMateriales({ todas: true }), favoritos("MATERIALES")]);
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold lg:sr-only">Nuevo pedido de material</h1>
      <p className="mb-4 text-sm text-suave">Para lo que te piden por teléfono. Le llegan los avisos a quien lo pidió.</p>
      <MaterialesConHistorial historial={{ items, favoritos: favs }} todas verBase="/compras" obras={obras} compras puedeCrearObra responsables={responsables} />
    </div>
  );
}
