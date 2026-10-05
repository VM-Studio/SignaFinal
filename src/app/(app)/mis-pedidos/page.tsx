import type { Metadata } from "next";
import { ListOrdered, PlusCircle } from "lucide-react";
import { misPedidos } from "@/lib/pedidos/listas";
import { BotonLink } from "@/components/ui/boton";
import { Subtitulo, Titulo, Vacio } from "@/components/ui/basicos";
import { ListaPedidos } from "@/components/pedidos/lista-pedidos";

export const metadata: Metadata = { title: "Mis pedidos" };

export default async function PaginaMisPedidos() {
  const { activos, terminados } = await misPedidos();
  return (
    <div className="mx-auto max-w-3xl">
      <Titulo detalle="Lo que pediste, con su estado." accion={<BotonLink href="/pedir" icono={<PlusCircle className="size-5" />}>Pedir un viaje</BotonLink>}>
        Mis pedidos
      </Titulo>
      {activos.length + terminados.length === 0 ? (
        <Vacio icono={<ListOrdered className="size-10" />} titulo="Todavía no pediste nada">Lo que pidas aparece acá con su estado.</Vacio>
      ) : (
        <>
          <Subtitulo>En curso</Subtitulo>
          {activos.length ? <ListaPedidos filas={activos} base="/mis-pedidos" /> : <Vacio titulo="Nada en curso" />}
          {terminados.length > 0 && (
            <>
              <Subtitulo>Terminados</Subtitulo>
              <ListaPedidos filas={terminados} base="/mis-pedidos" />
            </>
          )}
        </>
      )}
    </div>
  );
}
