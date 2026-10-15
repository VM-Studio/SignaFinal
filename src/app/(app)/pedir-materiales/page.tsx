import type { Metadata } from "next";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { datosPedirMateriales } from "@/lib/materiales/consultas";
import { MaterialesConHistorial } from "@/components/historial/con-historial";
import { favoritos, historialMateriales, precargaMaterial } from "@/lib/historial/consultas";
import { Vacio } from "@/components/ui/basicos";
import { ElegirPedido } from "@/components/materiales/elegir-pedido";

export const metadata: Metadata = { title: "Pedir materiales" };

/** "Pedir materiales" (rápido): obra, qué (texto o archivo), para cuándo; va a Compras en el acto. */
export default async function PaginaPedirMateriales({ searchParams }: { searchParams: Promise<{ obra?: string; repetir?: string }> }) {
  const { obra, repetir } = await searchParams;
  const { obras, puedeCrearObra, responsables } = await datosPedirMateriales(); // verifica materiales.pedir
  const puedePedirViaje = puede((await exigirSesion()).rol, "pedidos.crear");
  // Historial para repetir (y "Repetir el pedido de materiales" desde un retiro en proveedor: ?repetir=).
  const [items, favs, precarga] = await Promise.all([historialMateriales(), favoritos("MATERIALES"), repetir ? precargaMaterial(repetir) : Promise.resolve(null)]);
  return (
    <div>
      <h1 className="sr-only">Pedir materiales a Compras</h1>
      <ElegirPedido activo="materiales" obra={obra} viaje={puedePedirViaje} />
      {obras.length === 0 && !puedeCrearObra ? (
        <Vacio titulo="No tenés obras a cargo">Pedile a la oficina que te asigne tus obras para poder pedir materiales.</Vacio>
      ) : (
        <MaterialesConHistorial historial={{ items, favoritos: favs }} precargaInicial={precarga} verBase="/compras/oc" obras={obras} obraInicial={obra} puedeCrearObra={puedeCrearObra} responsables={responsables} />
      )}
    </div>
  );
}
