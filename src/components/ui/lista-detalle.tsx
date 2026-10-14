import Link from "next/link";
import type { ReactNode } from "react";

export type ItemLateral = { id: string; href: string; titulo: ReactNode; detalle?: ReactNode; derecha?: ReactNode };

/**
 * Lista + detalle. Escritorio (1024px+): la lista ocupa todo el ancho que queda (se achica, no desaparece)
 * con el elegido marcado, y el detalle se abre en un PANEL de 480 px a la derecha, con scroll propio.
 * El panel es un @container: el detalle se arma en una columna ahí y en 8 + 4 a página completa.
 * Celular: solo el detalle (la lista es su pantalla).
 */
export function ListaDetalle({ titulo, verTodo, items, activo, children }: { titulo: string; verTodo: string; items: ItemLateral[]; activo: string; children: ReactNode }) {
  return (
    <div className="lg:-m-6 lg:grid lg:h-[calc(100dvh-48px)] lg:grid-cols-[minmax(0,1fr)_480px]">
      <aside className="@container hidden lg:flex lg:min-h-0 lg:min-w-0 lg:flex-col lg:border-r lg:border-linea lg:bg-papel">
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-linea px-6">
          <p className="etiqueta">{titulo}</p>
          <Link href={verTodo} className="text-[12px] font-medium text-suave hover:text-tinta">Ver todo</Link>
        </div>
        <ul className="flex-1 divide-y divide-linea overflow-y-auto">
          {items.map((i) => {
            const elegido = i.id === activo;
            return (
              <li key={i.id} data-vivo-id={i.id}>
                <Link href={i.href} aria-current={elegido ? "page" : undefined} className={`flex min-h-11 items-center gap-3 px-6 py-2 ${elegido ? "bg-black/[0.04] shadow-[inset_2px_0_0_var(--color-tinta)]" : "hover:bg-hover"}`}>
                  <span className="flex min-w-0 flex-1 flex-col @xl:flex-row @xl:items-center @xl:gap-4">
                    <span className="block min-w-0 truncate text-[13px] font-medium @xl:w-2/5 @xl:shrink-0">{i.titulo}</span>
                    {i.detalle && <span className="block min-w-0 truncate text-[12px] text-suave @xl:flex-1 @xl:text-[13px]">{i.detalle}</span>}
                  </span>
                  {i.derecha && <span className="shrink-0">{i.derecha}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>
      <div className="@container min-w-0 lg:overflow-y-auto lg:bg-white lg:p-6">{children}</div>
    </div>
  );
}
