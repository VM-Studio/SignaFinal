import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth/usuario-actual";
import { datosFormularioPedido } from "@/lib/datos/formulario-pedido";
import { FormularioPedido } from "@/components/pedidos/formulario-pedido";
import { Vacio } from "@/components/ui/basicos";

export const metadata: Metadata = { title: "Pedir un viaje" };

export default async function PaginaNuevoPedido() {
  const u = await requerirUsuario("pedidos.crear");
  const datos = await datosFormularioPedido(u);
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="sr-only">Pedir un viaje</h1>
      {datos.obras.length === 0 ? (
        <Vacio titulo="No tenés obras asignadas">Pedile a la oficina que te asigne tus obras para poder pedir viajes.</Vacio>
      ) : (
        <FormularioPedido datos={datos} />
      )}
    </div>
  );
}
