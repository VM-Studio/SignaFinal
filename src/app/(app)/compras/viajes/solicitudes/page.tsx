import type { Metadata } from "next";
import { PlusCircle } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { BotonLink } from "@/components/ui/boton";
import { Titulo } from "@/components/ui/basicos";
import { VistaSolicitudes } from "@/components/pedidos/vista-solicitudes";
import { PestanasViajesCompras } from "@/components/pedidos/pestanas-viajes-compras";

export const metadata: Metadata = { title: "Solicitudes de viaje" };

/** Compras: TODAS las solicitudes de viaje con filtros, agrupadas por lugar de retiro (sin Aceptar). */
export default async function PaginaSolicitudesCompras({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirPermiso("pedidos.coordinar");
  return (
    <div>
      <Titulo siempre detalle="Pendientes, aceptadas, en curso y lo entregado hoy. Tocá un lugar para ver sus retiros." accion={<BotonLink href="/compras/viajes" icono={<PlusCircle />}>Coordinar viaje</BotonLink>}>Viajes</Titulo>
      <PestanasViajesCompras activa="solicitudes" />
      <VistaSolicitudes sp={await searchParams} ruta="/compras/viajes/solicitudes" />
    </div>
  );
}
