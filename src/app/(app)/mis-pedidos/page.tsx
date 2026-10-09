import type { Metadata } from "next";
import { ListOrdered, PlusCircle } from "lucide-react";
import { misPedidos, PESTANAS_MIS_PEDIDOS, type PestanaMisPedidos } from "@/lib/pedidos/listas";
import { BotonLink } from "@/components/ui/boton";
import { Pestanas, Titulo, Vacio } from "@/components/ui/basicos";
import { ListaPedidos } from "@/components/pedidos/lista-pedidos";
import { CargarMas } from "@/components/ui/cargar-mas";
import { limiteDe } from "@/lib/pagina";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { misMateriales } from "@/lib/materiales/consultas";
import { MisMateriales } from "@/components/materiales/lista-materiales";
import { ShoppingCart } from "lucide-react";

export const metadata: Metadata = { title: "Mis pedidos" };

const VACIO: Record<PestanaMisPedidos, string> = {
  pendientes: "No tenés pedidos esperando chofer",
  aceptados: "Ningún chofer tiene un pedido tuyo ahora",
  entregados: "Todavía no se entregó nada de lo que pediste",
};

/** Viajes: solo los propios. Materiales: los propios y los de mis obras. */
export default async function PaginaMisPedidos({ searchParams }: { searchParams: Promise<{ p?: string; n?: string; tab?: string }> }) {
  const { p, n, tab } = await searchParams;
  const u = await exigirSesion();
  const conMateriales = puede(u.rol, "materiales.pedir");
  const enMateriales = conMateriales && tab === "materiales";
  const pestana: PestanaMisPedidos = p && p in PESTANAS_MIS_PEDIDOS ? (p as PestanaMisPedidos) : "pendientes";
  const { limite, siguiente } = await limiteDe(n);
  // Arriba: viajes o materiales. Abajo (viajes): pendientes, aceptados, entregados.
  const pestanas = (cuantos?: Partial<Record<PestanaMisPedidos, number>>) => (
    <>
      {conMateriales && <Pestanas items={[{ href: "/mis-pedidos", etiqueta: "Viajes", activa: !enMateriales }, { href: "/mis-pedidos?tab=materiales", etiqueta: "Materiales", activa: enMateriales }]} />}
      {!enMateriales && (
        <Pestanas
          items={(Object.keys(PESTANAS_MIS_PEDIDOS) as PestanaMisPedidos[]).map((k) => ({
            href: k === "pendientes" ? "/mis-pedidos" : `/mis-pedidos?p=${k}`,
            etiqueta: `${PESTANAS_MIS_PEDIDOS[k]}${cuantos?.[k] ? ` (${cuantos[k]})` : ""}`,
            activa: k === pestana,
          }))}
        />
      )}
    </>
  );

  if (enMateriales) {
    const m = await misMateriales(limite);
    return (
      <div>
        <Titulo accion={<BotonLink href="/pedir-materiales" icono={<PlusCircle />}>Pedir materiales</BotonLink>}>Mis pedidos</Titulo>
        {pestanas()}
        {m.filas.length === 0 ? (
          <Vacio icono={<ShoppingCart className="size-10" />} titulo="No pediste materiales" accion={<BotonLink href="/pedir-materiales" variante="secundario">Pedir materiales a Compras</BotonLink>}>Lo que le pidas a Compras aparece acá con su estado, paso a paso.</Vacio>
        ) : (
          <MisMateriales filas={m.filas} />
        )}
        {m.hayMas && <CargarMas href={`/mis-pedidos?tab=materiales&n=${siguiente}`} />}
      </div>
    );
  }

  const { filas, cuantos, hayMas } = await misPedidos(pestana, limite);
  return (
    <div>
      <Titulo accion={<BotonLink href="/pedir" icono={<PlusCircle />}>Pedir un viaje</BotonLink>}>Mis pedidos</Titulo>
      {pestanas(cuantos)}
      {filas.length === 0 ? <Vacio icono={<ListOrdered className="size-10" />} titulo={VACIO[pestana]} /> : <ListaPedidos filas={filas} base="/mis-pedidos" />}
      {hayMas && <CargarMas href={`/mis-pedidos?${pestana !== "pendientes" ? `p=${pestana}&` : ""}n=${siguiente}`} />}
    </div>
  );
}
