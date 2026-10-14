import type { Metadata } from "next";
import { exigirPermiso } from "@/lib/auth/sesion";
import { PaginaCompleta, Titulo } from "@/components/ui/basicos";
import { VistaSolicitudes } from "@/components/pedidos/vista-solicitudes";
import { PestanasViajesCompras } from "@/components/pedidos/pestanas-viajes-compras";

export const metadata: Metadata = { title: "Solicitudes de viaje" };

/** Compras: TODAS las solicitudes de viaje con filtros en una fila, agrupadas por lugar de retiro (sin Aceptar). */
export default async function PaginaSolicitudesCompras({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirPermiso("pedidos.coordinar");
  return (
    <PaginaCompleta>
      <Titulo siempre>Viajes</Titulo>
      <PestanasViajesCompras activa="solicitudes" />
      <VistaSolicitudes sp={await searchParams} ruta="/compras/viajes/solicitudes" agrupada />
    </PaginaCompleta>
  );
}
