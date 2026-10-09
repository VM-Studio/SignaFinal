import Link from "next/link";
import { claseBoton } from "@/components/ui/boton";
import { ROL } from "@/lib/etiquetas";
import { dia, hora } from "@/lib/formato";
import type { Rol } from "@prisma/client";

type Fila = { id: string; fecha: Date; rol: Rol | null; resumen: string; usuarioId: string | null; usuario: { nombre: string } | null };

/** Lista cronológica de la auditoría, agrupada por día, con el resumen legible. */
export function ListaActividad({ filas, pagina, paginas, total, href }: { filas: Fila[]; pagina: number; paginas: number; total: number; href: (pagina: number) => string }) {
  const dias = [...new Set(filas.map((f) => dia(f.fecha)))];
  return (
    <>
      {dias.map((d) => (
        <section key={d} className="mb-4">
          <h2 className="mb-1.5 etiqueta">{d}</h2>
          <ul className="divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
            {filas.filter((f) => dia(f.fecha) === d).map((a) => (
              <li key={a.id} className="flex gap-3 px-4 py-3">
                <span className="w-12 shrink-0 pt-0.5 text-sm text-suave tabular-nums">{hora(a.fecha)}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.resumen}</p>
                  <p className="text-sm text-suave">
                    {a.usuarioId && a.usuario ? <Link href={`/actividad/${a.usuarioId}`} className="underline">{a.usuario.nombre}</Link> : "Sistema"}
                    {a.rol ? ` · ${ROL[a.rol]}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="mt-2 flex items-center justify-between gap-3">
        {pagina > 1 ? <Link href={href(pagina - 1)} className={claseBoton("secundario")}>Más nuevas</Link> : <span />}
        <span className="text-sm text-suave">{total.toLocaleString("es-AR")} acciones · página {pagina} de {paginas}</span>
        {pagina < paginas ? <Link href={href(pagina + 1)} className={claseBoton("secundario")}>Más viejas</Link> : <span />}
      </div>
    </>
  );
}
