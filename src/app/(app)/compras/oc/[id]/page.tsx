import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirSesion } from "@/lib/auth/sesion";
import { documentoParaPlantilla } from "@/lib/compras/documento-consultas";
import { tomarAlAbrir } from "@/lib/compras/documento-acciones";
import { PlantillaDocumento } from "@/components/compras/documento/plantilla";

export const metadata: Metadata = { title: "Orden de compra" };

/** De dónde se vino (para "← Volver"): la lista, tal cual estaba. */
const ORIGENES = {
  tablero: { clave: "tablero", href: "/compras/tablero", etiqueta: "Volver al tablero" },
  pedidos: { clave: "pedidos", href: "/compras", etiqueta: "Volver a pedidos" },
  "mis-pedidos": { clave: "mis-pedidos", href: "/mis-pedidos?tab=materiales", etiqueta: "Volver a mis pedidos" },
  aprobaciones: { clave: "aprobaciones", href: "/aprobaciones", etiqueta: "Volver a aprobaciones" },
  facturacion: { clave: "facturacion", href: "/compras/facturacion", etiqueta: "Volver a facturación" },
  habilitados: { clave: "habilitados", href: "/habilitados", etiqueta: "Volver a habilitados" },
} as const;

/**
 * EL DOCUMENTO DE COMPRA (OC/PE): la plantilla en página completa, compartida y editable por celda.
 * Si Compras la abre por primera vez (recién enviada), pasa a "En Compras" con ella como responsable.
 */
export default async function PaginaDocumento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ desde?: string }> }) {
  const u = await exigirSesion();
  const { id } = await params;
  const { desde } = await searchParams;
  let d = await documentoParaPlantilla(id);
  if (!d) notFound();
  if (u.rol === "COMPRAS" && d.estado === "ENVIADA_A_COMPRAS") {
    const r = await tomarAlAbrir(id);
    if (r.ok && r.datos.tomada) d = (await documentoParaPlantilla(id))!;
  }
  const porRol = u.rol === "RESPONSABLE_OBRA" || u.rol === "CAPATAZ" ? ORIGENES["mis-pedidos"] : u.rol === "ADMINISTRACION" ? ORIGENES.facturacion : u.rol === "DIRECCION" && d.estado === "ESPERANDO_AUTORIZACION" ? ORIGENES.aprobaciones : ORIGENES.tablero;
  const volver = desde && desde in ORIGENES ? ORIGENES[desde as keyof typeof ORIGENES] : porRol;
  return <PlantillaDocumento key={d.id} d={d} volver={volver} />;
}
