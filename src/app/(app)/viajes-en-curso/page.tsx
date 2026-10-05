import type { Metadata } from "next";
import { Route } from "lucide-react";
import { viajesDeMisObras } from "@/lib/pedidos/listas";
import { Subtitulo, Titulo, Vacio } from "@/components/ui/basicos";
import { ListaPedidos } from "@/components/pedidos/lista-pedidos";

export const metadata: Metadata = { title: "Viajes" };

/** Viajes aceptados por los choferes que van a mis obras (nunca las solicitudes pendientes de otros). */
export default async function PaginaViajesEnCurso() {
  const { enCurso, entregados } = await viajesDeMisObras();
  return (
    <div className="mx-auto max-w-3xl">
      <Titulo detalle="Los viajes que ya aceptó un chofer y van a tus obras.">Viajes</Titulo>
      {enCurso.length + entregados.length === 0 ? (
        <Vacio icono={<Route className="size-10" />} titulo="No hay viajes hacia tus obras">Cuando un chofer acepte un pedido para tus obras, lo vas a ver acá.</Vacio>
      ) : (
        <>
          <Subtitulo>En camino y aceptados</Subtitulo>
          {enCurso.length ? <ListaPedidos filas={enCurso} base="/viajes-en-curso" conSolicitante /> : <Vacio titulo="Nada en camino ahora" />}
          {entregados.length > 0 && (
            <>
              <Subtitulo>Entregados (últimos 2 días)</Subtitulo>
              <ListaPedidos filas={entregados} base="/viajes-en-curso" conSolicitante />
            </>
          )}
        </>
      )}
    </div>
  );
}
