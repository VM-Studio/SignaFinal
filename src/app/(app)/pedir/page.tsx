import type { Metadata } from "next";
import { datosFormulario, ultimaObraPedida } from "@/lib/pedidos/consultas";
import { ViajeConHistorial } from "@/components/historial/con-historial";
import { favoritos, historialViajes } from "@/lib/historial/consultas";
import { Vacio } from "@/components/ui/basicos";
import { ElegirPedido } from "@/components/materiales/elegir-pedido";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { listosEnMisObrasDetalle, listosEnMisObras } from "@/lib/materiales/consultas";
import { TarjetasListos } from "@/components/materiales/lista-materiales";
import { BotonLink } from "@/components/ui/boton";

export const metadata: Metadata = { title: "Pedir" };

export default async function PaginaPedir({ searchParams }: { searchParams: Promise<{ obra?: string }> }) {
  const { obra } = await searchParams;
  const [datos, u, items, favs, ultima, listos, cuantosListos] = await Promise.all([datosFormulario(), exigirSesion(), historialViajes(), favoritos("VIAJE"), ultimaObraPedida(), listosEnMisObrasDetalle(4), listosEnMisObras()]); // verifica pedidos.crear
  return (
    <div>
      <h1 className="sr-only">Pedir</h1>
      {/* Lo que Compras habilitó: arriba de todo, con "Pedir el viaje" (se actualiza solo al habilitarse). */}
      {listos.length > 0 && (
        <section className="mb-4 flex flex-col gap-2 lg:mb-6">
          <TarjetasListos listos={listos} />
          {cuantosListos > listos.length && <BotonLink href="/mis-pedidos" variante="secundario" className="self-start">Ver los {cuantosListos} listos para retirar</BotonLink>}
        </section>
      )}
      {puede(u.rol, "materiales.pedir") && <ElegirPedido activo="viaje" obra={obra} />}
      {datos.obras.length === 0 ? (
        <Vacio titulo="No tenés obras a cargo">Pedile a la oficina que te asigne tus obras para poder pedir viajes.</Vacio>
      ) : (
        <ViajeConHistorial historial={{ items, favoritos: favs }} datos={datos} obraInicial={obra ?? ultima} />
      )}
    </div>
  );
}
