import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigirSesion } from "@/lib/auth/sesion";
import { rutaPermitida } from "@/lib/permisos";
import { PaginaTablero } from "@/components/compras/pagina-tablero";

export const metadata: Metadata = { title: "Tablero de Compras" };

/**
 * TABLERO de Compras en solo lectura para Administración. Compras y el dueño lo tienen en Órdenes
 * (/compras/ordenes): los enlaces viejos a /compras/tablero los llevan ahí con los mismos filtros.
 */
export default async function PaginaTableroLectura({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const u = await exigirSesion();
  const sp = await searchParams;
  if (rutaPermitida(u.rol, "/compras/ordenes")) {
    const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString();
    redirect(`/compras/ordenes${qs ? `?${qs}` : ""}`);
  }
  return <PaginaTablero sp={sp} ruta="/compras/tablero" />;
}
