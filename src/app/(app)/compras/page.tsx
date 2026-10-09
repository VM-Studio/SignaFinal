import type { Metadata } from "next";
import { PlusCircle, ShoppingCart } from "lucide-react";
import { colaCompras } from "@/lib/materiales/consultas";
import { PESTANAS_COMPRAS, type PestanaCompras } from "@/lib/materiales/presentacion";
import { limiteDe } from "@/lib/pagina";
import { BotonLink } from "@/components/ui/boton";
import { Pestanas, Titulo, Vacio } from "@/components/ui/basicos";
import { CargarMas } from "@/components/ui/cargar-mas";
import { ColaMateriales } from "@/components/materiales/lista-materiales";
import { FiltroObra } from "@/components/materiales/filtro-obra";

export const metadata: Metadata = { title: "Pedidos de material" };

const VACIO: Record<PestanaCompras, string> = {
  nuevos: "No hay pedidos nuevos",
  "en-compra": "No hay nada en compra",
  esperando: "Nada espera la aprobación del dueño",
  aprobados: "No hay aprobados esperando al proveedor",
  listos: "No hay nada habilitado en curso",
};

/** Cola de Compras: urgentes primero, después para cuándo. En rojo lo demorado. */
export default async function PaginaCompras({ searchParams }: { searchParams: Promise<{ p?: string; obra?: string; n?: string }> }) {
  const { p, obra, n } = await searchParams;
  const pestana: PestanaCompras = p && p in PESTANAS_COMPRAS ? (p as PestanaCompras) : "nuevos";
  const { limite, siguiente } = await limiteDe(n);
  const { filas, hayMas, cuantos, obras } = await colaCompras(pestana, obra, limite);
  const url = (k: PestanaCompras, extra = "") => `/compras?${new URLSearchParams({ ...(k !== "nuevos" ? { p: k } : {}), ...(obra ? { obra } : {}) }).toString()}${extra}`;
  return (
    <div className="mx-auto max-w-3xl lg:max-w-none">
      <Titulo siempre accion={<BotonLink href="/compras/nuevo" icono={<PlusCircle className="size-5" />}>Nuevo pedido</BotonLink>}>Pedidos de material</Titulo>
      <Pestanas items={(Object.keys(PESTANAS_COMPRAS) as PestanaCompras[]).map((k) => ({ href: url(k), etiqueta: `${PESTANAS_COMPRAS[k].titulo}${cuantos[k] ? ` (${cuantos[k]})` : ""}`, activa: k === pestana }))} />
      {obras.length > 1 && <FiltroObra obras={obras} valor={obra} pestana={pestana === "nuevos" ? undefined : pestana} />}
      {filas.length === 0 ? <Vacio icono={<ShoppingCart className="size-10" />} titulo={VACIO[pestana]} /> : <ColaMateriales filas={filas} />}
      {hayMas && <CargarMas href={`${url(pestana)}&n=${siguiente}`} />}
    </div>
  );
}
