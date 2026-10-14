import type { Metadata } from "next";
import { datosRetiro } from "@/lib/materiales/consultas";
import { RetiroMateriales } from "@/components/materiales/retiro-materiales";
import { Vacio } from "@/components/ui/basicos";
import { DosTercios } from "@/components/ui/dos-tercios";

export const metadata: Metadata = { title: "Retiro en proveedor" };

/** Pedir el viaje de retiro de lo que habilitó Compras. */
export default async function PaginaRetiro({ searchParams }: { searchParams: Promise<{ obra?: string; material?: string }> }) {
  const { obra, material } = await searchParams;
  const datos = await datosRetiro(); // verifica pedidos.crear
  const habilitados = Object.values(datos.listos).flat().length;
  return (
    <DosTercios
      soloEscritorio
      contexto={
        <>
          <p className="etiqueta">Cómo funciona</p>
          <p className="text-suave">Acá aparece lo que Compras habilitó para retirar en tus obras: proveedor, sucursal, horario y contacto.</p>
          <p className="text-suave">Elegí qué retirar y el viaje sale con la dirección y el horario del proveedor. Un proveedor por viaje.</p>
          <p className="text-suave">{habilitados === 1 ? "Hay 1 retiro habilitado." : `Hay ${habilitados} retiros habilitados.`}</p>
        </>
      }
    >
      <h1 className="sr-only">Retiro en proveedor</h1>
      {datos.obras.length === 0 ? (
        <Vacio titulo="No tenés obras a cargo">Pedile a la oficina que te asigne tus obras para poder pedir viajes.</Vacio>
      ) : (
        <RetiroMateriales obras={datos.obras} listos={datos.listos} obraInicial={obra} materialInicial={material} />
      )}
    </DosTercios>
  );
}
