import type { Metadata } from "next";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { db } from "@/lib/db";
import { Subtitulo, Tarjeta, Titulo } from "@/components/ui/basicos";
import { ProximoNumero, SolicitantesExternos } from "@/components/compras/configuracion";

export const metadata: Metadata = { title: "Configuración de Compras" };

/**
 * Numeración de las órdenes (OC y PE, cada una con la suya; solo el dueño la cambia y solo hacia
 * arriba) y los "Solicitado por" que no son usuarios.
 */
export default async function PaginaConfiguracionCompras() {
  const u = await exigirSesion();
  const [numeradores, externos] = await Promise.all([
    db.numeradorOC.findMany(),
    db.solicitanteExterno.findMany({ orderBy: [{ activo: "desc" }, { nombre: "asc" }], include: { _count: { select: { ordenes: true } } } }),
  ]);
  const ultimo = (t: "OC" | "PE") => numeradores.find((n) => n.tipo === t)?.ultimo ?? 0;
  const editar = puede(u.rol, "compras.numeradores");
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-12">
      <section className="min-w-0 lg:col-span-7">
        <Titulo siempre>Numeración de órdenes</Titulo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Tarjeta className="p-4"><ProximoNumero tipo="OC" ultimo={ultimo("OC")} puedeEditar={editar} /></Tarjeta>
          <Tarjeta className="p-4"><ProximoNumero tipo="PE" ultimo={ultimo("PE")} puedeEditar={editar} /></Tarjeta>
        </div>
      </section>
      <section className="min-w-0 lg:col-span-5">
        <Subtitulo>Solicitado por (sin usuario)</Subtitulo>
        <SolicitantesExternos lista={externos.map((e) => ({ id: e.id, nombre: e.nombre, activo: e.activo, ordenes: e._count.ordenes }))} />
      </section>
    </div>
  );
}
