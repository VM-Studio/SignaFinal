import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { obtenerSesion } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { puedeVerDocumento } from "@/lib/compras/acceso";
import { hojaParaImprimir } from "@/lib/compras/documento-consultas";
import { usarTokenImpresion } from "@/lib/compras/pdf-generar";
import { HojaImpresa } from "@/components/compras/documento/hoja-impresa";

export const metadata: Metadata = { title: "Imprimir" };
export const dynamic = "force-dynamic";

/**
 * LA HOJA PARA IMPRIMIR: el mismo componente de la plantilla, en modo lectura, con el CSS de impresión A4.
 * La abre Chromium para el PDF (con un token de un solo uso, sin sesión) o cualquiera que vea el documento.
 */
export default async function PaginaImprimir({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const { id } = await params;
  const { token } = await searchParams;
  let ok = false;
  if (token) ok = await usarTokenImpresion(id, token);
  if (!ok) {
    const u = await obtenerSesion();
    const d = u ? await db.ordenCompra.findUnique({ where: { id }, select: { creadaPorId: true, solicitanteId: true, obraId: true } }) : null;
    ok = !!u && !!d && (await puedeVerDocumento(u, d));
  }
  if (!ok) notFound();
  const h = await hojaParaImprimir(id);
  if (!h) notFound();
  return (
    <main data-hoja-lista className="bg-white">
      {/* Sin la pantalla de carga ni nada de la app: solo la hoja. */}
      <style>{`#splash{display:none!important} html,body{background:#fff!important;margin:0;padding:0;overflow:hidden}`}</style>
      <HojaImpresa h={h} />
    </main>
  );
}
