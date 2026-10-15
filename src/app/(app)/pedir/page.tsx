import type { Metadata } from "next";
import { datosFormulario, ultimaObraPedida } from "@/lib/pedidos/consultas";
import { ViajeConHistorial } from "@/components/historial/con-historial";
import { favoritos, historialViajes } from "@/lib/historial/consultas";
import { Vacio } from "@/components/ui/basicos";
import { ElegirPedido } from "@/components/materiales/elegir-pedido";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";

export const metadata: Metadata = { title: "Pedir un viaje" };

export default async function PaginaPedir({ searchParams }: { searchParams: Promise<{ obra?: string }> }) {
  const { obra } = await searchParams;
  const [datos, u, items, favs, ultima] = await Promise.all([datosFormulario(), exigirSesion(), historialViajes(), favoritos("VIAJE"), ultimaObraPedida()]); // verifica pedidos.crear
  return (
    <div>
      <h1 className="sr-only">Pedir un viaje</h1>
      {puede(u.rol, "materiales.pedir") && <ElegirPedido activo="viaje" obra={obra} />}
      {datos.obras.length === 0 ? (
        <Vacio titulo="No tenés obras a cargo">Pedile a la oficina que te asigne tus obras para poder pedir viajes.</Vacio>
      ) : (
        <ViajeConHistorial historial={{ items, favoritos: favs }} datos={datos} obraInicial={obra ?? ultima} />
      )}
    </div>
  );
}
