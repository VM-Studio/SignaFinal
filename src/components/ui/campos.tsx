import { CalendarDays, ChevronDown, Search } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

const control =
  "w-full min-h-[52px] rounded-[var(--radius-caja)] border-2 border-linea bg-papel px-4 text-base text-tinta placeholder:text-apagado focus:border-negro focus:outline-none aria-[invalid=true]:border-critico";

/** Etiqueta + control + ayuda o error. */
export function Campo({ etiqueta, htmlFor, ayuda, error, children }: { etiqueta: string; htmlFor?: string; ayuda?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {etiqueta}
      </label>
      {children}
      {error ? <p className="text-sm font-medium text-critico">{error}</p> : ayuda ? <p className="text-sm text-suave">{ayuda}</p> : null}
    </div>
  );
}

export function Entrada({ className = "", ...p }: ComponentProps<"input">) {
  return <input {...p} className={`${control} ${className}`} />;
}

/** Select nativo: en el celular abre la rueda del sistema, que es lo más cómodo con el dedo. */
export function Selector({ className = "", children, ...p }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select {...p} className={`${control} appearance-none pr-11 ${className}`}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2" strokeWidth={2.5} />
    </div>
  );
}

/** Fecha con el selector nativo del teléfono. */
export function Fecha({ className = "", ...p }: Omit<ComponentProps<"input">, "type">) {
  return (
    <div className="relative">
      <input type="date" {...p} className={`${control} pr-11 [&::-webkit-calendar-picker-indicator]:opacity-0 ${className}`} />
      <CalendarDays aria-hidden className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2" />
    </div>
  );
}

export function AreaTexto({ className = "", ...p }: ComponentProps<"textarea">) {
  return <textarea {...p} className={`${control} min-h-24 py-3 ${className}`} />;
}

export function MensajeError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-[var(--radius-caja)] border-2 border-critico bg-critico-fondo px-4 py-3 font-medium text-critico">
      {children}
    </div>
  );
}

/** Buscador: un formulario GET, funciona sin JavaScript y deja la búsqueda en la URL. */
export function Buscador({ accion, valor, placeholder = "Buscar…", nombre = "q", ocultos = {} }: { accion: string; valor?: string; placeholder?: string; nombre?: string; ocultos?: Record<string, string | undefined> }) {
  return (
    <form action={accion} role="search" className="relative">
      {Object.entries(ocultos).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-suave" />
      <input type="search" name={nombre} defaultValue={valor} placeholder={placeholder} aria-label={placeholder} className={`${control} pl-11`} />
    </form>
  );
}
