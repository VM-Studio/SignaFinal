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
        <>
        {/* Celular: filas */}
        <ul className="-mx-4 divide-y divide-linea border-y border-linea bg-papel lg:hidden">
          {viajes.map((v) => (
            <li key={v.id}>
              <Link href={`/solicitudes/${v.pedidoId}`} className="flex items-start gap-3 px-4 py-2.5 active:bg-hover">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{v.descripcion}</p>
                  <p className="truncate text-sm text-suave">Obra {v.obra} · {v.chofer} · {v.vehiculo}</p>
                  <p className="text-sm text-suave tabular-nums">{cuando(v.llegadaReal ?? v.salidaReal ?? v.salidaEstimada)}{v.km != null ? ` · ${km(v.km)}` : ""}{v.costo != null ? ` · ${plata(v.costo)}` : ""}</p>
                </div>
                <Insignia tono={ESTADO[v.estado].tono}>{ESTADO[v.estado].t}</Insignia>
              </Link>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel lg:block">
          <table className="tabla min-w-[720px]">
            <thead>
              <tr>
                <th>Estado</th><th>Qué</th><th>Obra</th><th>Chofer · Vehículo</th><th>Cuándo</th><th className="num">Km</th><th className="num">Costo</th><th />
              </tr>
            </thead>
            <tbody>
              {viajes.map((v) => (
                <tr key={v.id}>
                  <td><Insignia tono={ESTADO[v.estado].tono}>{ESTADO[v.estado].t}</Insignia></td>
                  <td className="max-w-xs"><Link href={`/solicitudes/${v.pedidoId}`} className="line-clamp-1 font-medium hover:underline">{v.descripcion}</Link></td>
                  <td>Obra {v.obra}</td>
                  <td>{v.chofer} · <span className="text-suave">{v.vehiculo}</span></td>
                  <td className="whitespace-nowrap text-suave">{cuando(v.llegadaReal ?? v.salidaReal ?? v.salidaEstimada)}</td>
                  <td className="num">{km(v.km)}</td>
                  <td className="num font-medium">{plata(v.costo)}</td>
                  <td>{v.remitoUrl && <a href={v.remitoUrl} target="_blank" rel="noopener" aria-label="Ver remito" className="grid size-8 place-items-center rounded-md text-suave hover:bg-black/[0.04] hover:text-tinta"><FileImage className="size-4" /></a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
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
