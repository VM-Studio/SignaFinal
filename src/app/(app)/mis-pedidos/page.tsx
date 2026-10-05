import type { Metadata } from "next";
import { ListOrdered, PlusCircle } from "lucide-react";
import { misPedidos, PESTANAS_MIS_PEDIDOS, type PestanaMisPedidos } from "@/lib/pedidos/listas";
import { BotonLink } from "@/components/ui/boton";
import { Pestanas, Titulo, Vacio } from "@/components/ui/basicos";
import { ListaPedidos } from "@/components/pedidos/lista-pedidos";
import { CargarMas } from "@/components/ui/cargar-mas";
import { limiteDe } from "@/lib/pagina";

export const metadata: Metadata = { title: "Mis pedidos" };

const VACIO: Record<PestanaMisPedidos, string> = {
  pendientes: "No tenés pedidos esperando chofer",
  aceptados: "Ningún chofer tiene un pedido tuyo ahora",
  entregados: "Todavía no se entregó nada de lo que pediste",
};

/** Solo los propios. */
export default async function PaginaMisPedidos({ searchParams }: { searchParams: Promise<{ p?: string; n?: string }> }) {
  const { p, n } = await searchParams;
  const pestana: PestanaMisPedidos = p && p in PESTANAS_MIS_PEDIDOS ? (p as PestanaMisPedidos) : "pendientes";
  const { limite, siguiente } = await limiteDe(n);
  const { filas, cuantos, hayMas } = await misPedidos(pestana, limite);
  return (
    <div className="mx-auto max-w-3xl">
      <Titulo accion={<BotonLink href="/pedir" icono={<PlusCircle className="size-5" />}>Pedir un viaje</BotonLink>}>Mis pedidos</Titulo>
      <Pestanas
        items={(Object.keys(PESTANAS_MIS_PEDIDOS) as PestanaMisPedidos[]).map((k) => ({
          href: k === "pendientes" ? "/mis-pedidos" : `/mis-pedidos?p=${k}`,
          etiqueta: `${PESTANAS_MIS_PEDIDOS[k]}${cuantos[k] ? ` (${cuantos[k]})` : ""}`,
          activa: k === pestana,
        }))}
      />
      {filas.length === 0 ? <Vacio icono={<ListOrdered className="size-10" />} titulo={VACIO[pestana]} /> : <ListaPedidos filas={filas} base="/mis-pedidos" />}
      {hayMas && <CargarMas href={`/mis-pedidos?${pestana !== "pendientes" ? `p=${pestana}&` : ""}n=${siguiente}`} />}
    </div>
  );
}
