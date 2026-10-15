import type { Metadata } from "next";
import { PaginaTablero } from "@/components/compras/pagina-tablero";

export const metadata: Metadata = { title: "Tablero" };

/** TABLERO de Compras: lo primero que ve Compras (también el dueño y Administración, que solo mira). */
export default async function PaginaTableroCompras({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PaginaTablero sp={await searchParams} ruta="/compras/tablero" />;
}
