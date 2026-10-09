import type { Metadata } from "next";
import { datosRetiro } from "@/lib/materiales/consultas";
import { RetiroMateriales } from "@/components/materiales/retiro-materiales";
import { Vacio } from "@/components/ui/basicos";

export const metadata: Metadata = { title: "Retiro en proveedor" };

/** Pedir el viaje de retiro de lo que habilitó Compras. */
export default async function PaginaRetiro({ searchParams }: { searchParams: Promise<{ obra?: string; material?: string }> }) {
  const { obra, material } = await searchParams;
  const datos = await datosRetiro(); // verifica pedidos.crear
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="sr-only">Retiro en proveedor</h1>
      {datos.obras.length === 0 ? (
        <Vacio titulo="No tenés obras a cargo">Pedile a la oficina que te asigne tus obras para poder pedir viajes.</Vacio>
      ) : (
        <RetiroMateriales obras={datos.obras} listos={datos.listos} obraInicial={obra} materialInicial={material} />
      )}
    </div>
  );
}
