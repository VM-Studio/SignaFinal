import type { Metadata } from "next";
import { datosPedirMateriales } from "@/lib/materiales/consultas";
import { FormularioMateriales } from "@/components/materiales/formulario-materiales";
import { Vacio } from "@/components/ui/basicos";
import { ElegirPedido } from "@/components/materiales/elegir-pedido";

export const metadata: Metadata = { title: "Pedir materiales" };

/** Pedir materiales a Compras (responsable de obra y capataz). */
export default async function PaginaPedirMateriales({ searchParams }: { searchParams: Promise<{ obra?: string }> }) {
  const { obra } = await searchParams;
  const { obras } = await datosPedirMateriales(); // verifica materiales.pedir
  return (
    <div className="max-w-xl">
      <h1 className="sr-only">Pedir materiales a Compras</h1>
      <ElegirPedido activo="materiales" obra={obra} />
      {obras.length === 0 ? (
        <Vacio titulo="No tenés obras a cargo">Pedile a la oficina que te asigne tus obras para poder pedir materiales.</Vacio>
      ) : (
        <FormularioMateriales obras={obras} obraInicial={obra} />
      )}
    </div>
  );
}
