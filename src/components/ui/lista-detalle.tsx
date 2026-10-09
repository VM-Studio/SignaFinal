import Link from "next/link";
import type { ReactNode } from "react";

export type ItemLateral = { id: string; href: string; titulo: ReactNode; detalle?: ReactNode; derecha?: ReactNode };

/**
 * Lista + detalle. Escritorio ancho (1280px+, para que el detalle no quede angosto): la lista a la izquierda (380px, fija mientras el detalle scrollea)
 * con el elegido marcado, y el detalle a la derecha. Celular: solo el detalle (la lista es su pantalla).
 */
export function ListaDetalle({ titulo, verTodo, items, activo, children }: { titulo: string; verTodo: string; items: ItemLateral[]; activo: string; children: ReactNode }) {
  return (
    <div className="xl:-my-6 xl:-ml-6 xl:grid xl:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="hidden xl:sticky xl:top-12 xl:flex xl:h-[calc(100dvh-48px)] xl:flex-col xl:border-r xl:border-linea xl:bg-papel">
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-linea px-4">
          <p className="etiqueta">{titulo}</p>
          <Link href={verTodo} className="text-[12px] font-medium text-suave hover:text-tinta">Ver todo</Link>
        </div>
        <ul className="flex-1 divide-y divide-linea overflow-y-auto">
          {items.map((i) => {
            const elegido = i.id === activo;
            return (
              <li key={i.id}>
                <Link href={i.href} aria-current={elegido ? "page" : undefined} className={`flex min-h-14 items-center gap-3 px-4 py-2 ${elegido ? "bg-black/[0.04] shadow-[inset_2px_0_0_var(--color-tinta)]" : "hover:bg-hover"}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{i.titulo}</span>
                    {i.detalle && <span className="block truncate text-[12px] text-suave">{i.detalle}</span>}
                  </span>
                  {i.derecha && <span className="shrink-0">{i.derecha}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>
      <div className="min-w-0 xl:py-6 xl:pl-6">{children}</div>
    </div>
  );
}
