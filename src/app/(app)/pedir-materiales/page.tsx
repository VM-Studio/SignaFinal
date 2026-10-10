import type { Metadata } from "next";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { datosPedirMateriales } from "@/lib/materiales/consultas";
import { FormularioMateriales } from "@/components/materiales/formulario-materiales";
import { Vacio } from "@/components/ui/basicos";
import { ElegirPedido } from "@/components/materiales/elegir-pedido";

export const metadata: Metadata = { title: "Pedir materiales" };

/** Pedir materiales a Compras (responsable de obra, capataz, Dirección y Compras). */
export default async function PaginaPedirMateriales({ searchParams }: { searchParams: Promise<{ obra?: string }> }) {
  const { obra } = await searchParams;
  const { obras, puedeCrearObra, responsables } = await datosPedirMateriales(); // verifica materiales.pedir
  const puedePedirViaje = puede((await exigirSesion()).rol, "pedidos.crear");
  return (
    <div className="max-w-xl">
      <h1 className="sr-only">Pedir materiales a Compras</h1>
      {puedePedirViaje && <ElegirPedido activo="materiales" obra={obra} />}
      {obras.length === 0 && !puedeCrearObra ? (
        <Vacio titulo="No tenés obras a cargo">Pedile a la oficina que te asigne tus obras para poder pedir materiales.</Vacio>
      ) : (
        <FormularioMateriales obras={obras} obraInicial={obra} puedeCrearObra={puedeCrearObra} responsables={responsables} />
      )}
    </div>
  );
}
