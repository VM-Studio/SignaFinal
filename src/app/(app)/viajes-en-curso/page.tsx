import type { Metadata } from "next";
import { Route } from "lucide-react";
import { viajesDeMisObras } from "@/lib/pedidos/listas";
import { Titulo, Vacio } from "@/components/ui/basicos";
import { ListaViajes } from "@/components/pedidos/lista-pedidos";

export const metadata: Metadata = { title: "Viajes" };

/** "Hoy a Darwin llegan dos camiones", sin preguntar: lo ya aceptado que va a mis obras. */
export default async function PaginaViajesEnCurso() {
  const viajes = await viajesDeMisObras();
  const enViaje = viajes.filter((v) => v.estado === "EN_VIAJE").length;
  return (
    <div>
      <Titulo detalle={viajes.length ? `${enViaje ? `${enViaje} en camino · ` : ""}${viajes.length} en total hacia tus obras.` : undefined}>Viajes</Titulo>
      {viajes.length === 0 ? (
        <Vacio icono={<Route className="size-10" />} titulo="No hay viajes hacia tus obras">Cuando un chofer acepte un pedido para tus obras, lo vas a ver acá.</Vacio>
      ) : (
        <ListaViajes filas={viajes} base="/viajes-en-curso" />
      )}
    </div>
  );
}
