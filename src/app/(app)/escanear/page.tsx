import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { PaginaVacia } from "@/components/layout/pagina-vacia";

export const metadata: Metadata = { title: "Escanear" };

export default async function Pagina() {
  await exigirPermiso("herramientas.mover");
  return <PaginaVacia titulo="Escanear" icono="escanear" texto="Acá se va a abrir la cámara para leer el QR de cada herramienta." />;
}
