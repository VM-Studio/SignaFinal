import type { Metadata } from "next";
import { datosNuevoPedidoCompras } from "@/lib/materiales/consultas";
import { MaterialesConHistorial } from "@/components/historial/con-historial";
import { favoritos, historialMateriales } from "@/lib/historial/consultas";

export const metadata: Metadata = { title: "Pedir materiales" };

/** "Pedir materiales" (rápido) para Compras: lo que le piden por teléfono, a nombre de quien lo pidió (nace En Compras). */
export default async function PaginaNuevoMaterial() {
  const { obras, responsables } = await datosNuevoPedidoCompras(); // verifica materiales.gestionar
  // El mismo panel de pedidos anteriores, con los de todas las obras.
  const [items, favs] = await Promise.all([historialMateriales({ todas: true }), favoritos("MATERIALES")]);
  return (
    <div>
      <h1 className="sr-only">Pedir materiales</h1>
      <MaterialesConHistorial historial={{ items, favoritos: favs }} todas verBase="/compras/oc" obras={obras} compras puedeCrearObra responsables={responsables} />
    </div>
  );
}
