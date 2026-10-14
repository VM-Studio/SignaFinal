import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { exigirPermiso } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { Insignia, Subtitulo, Titulo, Vacio } from "@/components/ui/basicos";
import { BotonRazonSocial, RazonDeObra } from "@/components/compras/configuracion";

export const metadata: Metadata = { title: "Razones sociales" };

/**
 * Razones sociales que compran y facturan (la hoja NOTOCAR de la planilla de Compras: obras y CUITs).
 * Dirección y Administración: alta, edición y con cuál compra cada obra por defecto.
 */
export default async function PaginaRazonesSociales() {
  await exigirPermiso("razonesSociales.editar");
  const [razones, obras] = await Promise.all([
    db.razonSocial.findMany({ orderBy: [{ activa: "desc" }, { orden: "asc" }, { nombre: "asc" }], include: { _count: { select: { ocCompradas: true, obras: true } } } }),
    db.obra.findMany({ where: { estado: { not: "FINALIZADA" } }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, razonSocialId: true } }),
  ]);
  const activas = razones.filter((r) => r.activa).map((r) => ({ id: r.id, nombre: r.nombre }));
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-12">
      <section className="min-w-0 lg:col-span-7">
        <Titulo siempre detalle="Las empresas que compran y facturan. Se eligen en cada orden de compra y en Facturación." accion={<BotonRazonSocial />}>Razones sociales</Titulo>
        {razones.length === 0 ? <Vacio icono={<Building2 />} titulo="Sin razones sociales" /> : (
          <div className="overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel">
            <table className="tabla">
              <thead><tr><th>Razón social</th><th>CUIT</th><th className="text-right">Órdenes</th><th className="text-right">Obras</th><th /></tr></thead>
              <tbody>
                {razones.map((r) => (
                  <tr key={r.id} className={r.activa ? "" : "opacity-60"}>
                    <td className="font-medium">{r.nombre} {!r.activa && <Insignia tono="neutro">Inactiva</Insignia>}</td>
                    <td className="tabular-nums">{r.cuit}</td>
                    <td className="text-right tabular-nums">{r._count.ocCompradas}</td>
                    <td className="text-right tabular-nums">{r._count.obras}</td>
                    <td className="text-right"><BotonRazonSocial inicial={{ id: r.id, nombre: r.nombre, cuit: r.cuit, activa: r.activa, orden: r.orden }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[12px] text-suave">Nombres tal como figuran en la planilla de Compras. Confirmá con Compras la razón social completa de cada una.</p>
      </section>
      <section className="min-w-0 lg:col-span-5">
        <Subtitulo>Con qué compra cada obra</Subtitulo>
        <ul className="divide-y divide-linea rounded-[var(--radius-caja)] border border-linea bg-papel">
          {obras.map((o) => (
            <li key={o.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0 font-medium">Obra {o.nombre}</span>
              <div className="sm:w-64"><RazonDeObra obraId={o.id} valor={o.razonSocialId} razones={activas} /></div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
