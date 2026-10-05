import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FileImage, Route } from "lucide-react";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/permisos";
import { viajesTodos } from "@/lib/viajes/consultas";
import { Insignia, Pestanas, Titulo, Vacio } from "@/components/ui/basicos";
import { claseBoton } from "@/components/ui/boton";
import { cuando, km, plata } from "@/lib/formato";

export const metadata: Metadata = { title: "Viajes" };

type P = { vista?: string; pagina?: string };

export default async function PaginaViajes({ searchParams }: { searchParams: Promise<P> }) {
  const u = await exigirSesion();
  if (!puede(u.rol, "viajes.verTodos")) redirect("/inicio");
  const sp = await searchParams;
  return <TodosLosViajes vista={sp.vista === "terminados" ? "terminados" : "activos"} pagina={Math.max(1, Number(sp.pagina) || 1)} />;
}

const ESTADO = { EN_CURSO: { t: "En curso", tono: "activo" }, PROGRAMADO: { t: "Programado", tono: "aviso" }, FINALIZADO: { t: "Terminado", tono: "ok" }, CANCELADO: { t: "Cancelado", tono: "neutro" } } as const;

async function TodosLosViajes({ vista, pagina }: { vista: "activos" | "terminados"; pagina: number }) {
  const { viajes, total, paginas } = await viajesTodos(vista, pagina);
  const href = (p: number) => `/viajes?vista=${vista}${p > 1 ? `&pagina=${p}` : ""}`;
  return (
    <div>
      <Titulo detalle="Todos los viajes de todos los choferes.">Viajes</Titulo>
      <Pestanas items={[{ href: "/viajes", etiqueta: "En curso y aceptados", activa: vista === "activos" }, { href: "/viajes?vista=terminados", etiqueta: "Terminados", activa: vista === "terminados" }]} />
      {viajes.length === 0 ? (
        <Vacio icono={<Route className="size-10" />} titulo={vista === "activos" ? "No hay viajes en curso ni aceptados" : "Todavía no hay viajes terminados"} />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel">
          <table className="w-full min-w-[720px] text-left text-[15px]">
            <thead className="border-b border-linea text-xs tracking-wider text-suave uppercase">
              <tr className="[&>th]:px-4 [&>th]:py-3">
                <th>Estado</th><th>Qué</th><th>Obra</th><th>Chofer · Vehículo</th><th>Cuándo</th><th className="text-right">Km</th><th className="text-right">Costo</th><th />
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {viajes.map((v) => (
                <tr key={v.id} className="[&>td]:px-4 [&>td]:py-3">
                  <td><Insignia tono={ESTADO[v.estado].tono}>{ESTADO[v.estado].t}</Insignia></td>
                  <td className="max-w-xs"><Link href={`/solicitudes/${v.pedidoId}`} className="line-clamp-2 font-semibold hover:underline">{v.descripcion}</Link></td>
                  <td>Obra {v.obra}</td>
                  <td>{v.chofer} · <span className="text-suave">{v.vehiculo}</span></td>
                  <td className="whitespace-nowrap text-suave">{cuando(v.llegadaReal ?? v.salidaReal ?? v.salidaEstimada)}</td>
                  <td className="text-right tabular-nums">{km(v.km)}</td>
                  <td className="text-right font-semibold tabular-nums">{plata(v.costo)}</td>
                  <td>{v.remitoUrl && <a href={v.remitoUrl} target="_blank" rel="noopener" aria-label="Ver remito" className="grid size-10 place-items-center"><FileImage className="size-5" /></a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {paginas > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          {pagina > 1 ? <Link href={href(pagina - 1)} className={claseBoton("secundario")}>Anteriores</Link> : <span />}
          <span className="text-sm text-suave">{total} viajes · página {pagina} de {paginas}</span>
          {pagina < paginas ? <Link href={href(pagina + 1)} className={claseBoton("secundario")}>Siguientes</Link> : <span />}
        </div>
      )}
    </div>
  );
}
