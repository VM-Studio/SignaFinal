import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { exigirPermiso } from "@/lib/auth/sesion";
import { accionSugerida } from "@/lib/herramientas/presentacion";
import { puede } from "@/lib/permisos";

/** Destino del QR: abre la ficha con la acción más probable ya elegida (si puede hacerla). */
export default async function DesdeQR({ params }: { params: Promise<{ codigo: string }> }) {
  const u = await exigirPermiso("herramientas.ver");
  const codigo = decodeURIComponent((await params).codigo).toUpperCase();
  const h = await db.herramienta.findUnique({ where: { codigo }, select: { id: true, estado: true } });
  if (!h) notFound();
  const accion = accionSugerida(h.estado);
  const permitida = accion === "devolver" ? puede(u.rol, "herramientas.devolver") : accion === "volvio" ? puede(u.rol, "herramientas.mantenimiento") : puede(u.rol, "herramientas.mover");
  redirect(`/herramientas/${h.id}${accion && permitida ? `?accion=${accion}` : ""}`);
}
