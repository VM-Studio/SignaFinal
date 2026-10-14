import type { ReactNode } from "react";

/**
 * Formulario a todo el ancho en escritorio: el formulario en 2/3 y un panel de contexto en el 1/3
 * derecho (fijo mientras el formulario scrollea). Celular: el contexto va abajo, o no va (`soloEscritorio`).
 */
export function DosTercios({ children, contexto, soloEscritorio = false }: { children: ReactNode; contexto: ReactNode; soloEscritorio?: boolean }) {
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <div className="min-w-0">{children}</div>
      <aside className={`min-w-0 ${soloEscritorio ? "hidden lg:block" : ""}`}>
        <div className="flex flex-col gap-3 rounded-[var(--radius-caja)] border border-linea bg-papel p-4 text-[13px] lg:sticky lg:top-[72px]">{contexto}</div>
      </aside>
    </div>
  );
}
