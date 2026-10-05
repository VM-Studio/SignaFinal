import type { Metadata } from "next";
import { Activity, Download } from "lucide-react";
import { actividad, opcionesFiltro, TIPOS_ACCION, type FiltrosActividad, type TipoAccion } from "@/lib/actividad/consultas";
import { Titulo, Vacio } from "@/components/ui/basicos";
import { Boton, claseBoton } from "@/components/ui/boton";
import { ListaActividad } from "@/components/actividad/lista";

export const metadata: Metadata = { title: "Actividad" };

type P = { persona?: string; tipo?: string; obra?: string; desde?: string; hasta?: string; q?: string; pagina?: string };

const filtrosDe = (q: P): FiltrosActividad => ({
  persona: q.persona || undefined,
  tipo: q.tipo && q.tipo in TIPOS_ACCION ? (q.tipo as TipoAccion) : undefined,
  obra: q.obra || undefined,
  desde: /^\d{4}-\d{2}-\d{2}$/.test(q.desde ?? "") ? q.desde : undefined,
  hasta: /^\d{4}-\d{2}-\d{2}$/.test(q.hasta ?? "") ? q.hasta : undefined,
  q: q.q?.trim() || undefined,
  pagina: Math.max(1, Number(q.pagina) || 1),
});

const query = (f: FiltrosActividad, extra: Record<string, string | number | undefined> = {}) => {
  const s = new URLSearchParams(
    Object.entries({ ...f, pagina: undefined, ...extra })
      .filter(([k, v]) => v !== undefined && v !== "" && !(k === "pagina" && Number(v) === 1))
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return s ? `?${s}` : "";
};

const campo = "min-h-[44px] rounded-[var(--radius-caja)] border border-linea bg-papel px-3 text-[15px]";

/** Todo lo que hizo cada usuario (solo Dirección). */
export default async function PaginaActividad({ searchParams }: { searchParams: Promise<P> }) {
  const f = filtrosDe(await searchParams);
  const [{ filas, total, pagina, paginas }, ops] = await Promise.all([actividad(f), opcionesFiltro()]);
  return (
    <div className="mx-auto max-w-4xl">
      <Titulo detalle="Cada acción de cada usuario, lo último primero." accion={<a href={`/api/actividad/exportar${query(f)}`} className={claseBoton("secundario")}><Download className="size-5" /> Exportar CSV</a>}>
        Actividad
      </Titulo>
      <form action="/actividad" className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-6">
        <input name="q" defaultValue={f.q} placeholder="Buscar: hierro, Darwin, #24…" aria-label="Buscar" className={`${campo} col-span-2`} />
        <select name="persona" defaultValue={f.persona ?? ""} aria-label="Persona" className={campo}>
          <option value="">Todas las personas</option>
          {ops.personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <select name="tipo" defaultValue={f.tipo ?? ""} aria-label="Tipo de acción" className={campo}>
          <option value="">Todas las acciones</option>
          {(Object.keys(TIPOS_ACCION) as TipoAccion[]).map((t) => <option key={t} value={t}>{TIPOS_ACCION[t].titulo}</option>)}
        </select>
        <select name="obra" defaultValue={f.obra ?? ""} aria-label="Obra" className={campo}>
          <option value="">Todas las obras</option>
          {ops.obras.map((o) => <option key={o.id} value={o.id}>Obra {o.nombre}</option>)}
        </select>
        <input type="date" name="desde" defaultValue={f.desde} aria-label="Desde" className={campo} />
        <input type="date" name="hasta" defaultValue={f.hasta} aria-label="Hasta" className={campo} />
        <Boton className="col-span-2 lg:col-span-1">Filtrar</Boton>
      </form>
      {filas.length === 0 ? (
        <Vacio icono={<Activity className="size-10" />} titulo="Sin actividad con esos filtros" />
      ) : (
        <ListaActividad filas={filas} pagina={pagina} paginas={paginas} total={total} href={(p) => `/actividad${query(f, { pagina: p })}`} />
      )}
    </div>
  );
}
