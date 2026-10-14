import type { Metadata } from "next";
import { PaginaTablero } from "@/components/compras/pagina-tablero";

export const metadata: Metadata = { title: "Órdenes" };

/** ÓRDENES de Compras: es el tablero de control (la planilla de Alejandra), no una lista aparte. */
export default async function PaginaOrdenes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PaginaTablero sp={await searchParams} ruta="/compras/ordenes" />;
}
