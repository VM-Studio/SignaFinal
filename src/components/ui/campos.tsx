import { CalendarDays, ChevronDown, Search } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

/** 44px en celular, 36px en escritorio; borde 1px y, con foco, borde oscuro y anillo suave. */
export const claseCampo =
  "w-full min-h-11 rounded-md border border-linea bg-papel px-3 text-tinta placeholder:text-apagado focus:border-tinta focus:ring-[3px] focus:ring-black/[0.06] focus:outline-none aria-[invalid=true]:border-critico lg:min-h-9";

/** Etiqueta + control + ayuda o error. */
export function Campo({ etiqueta, htmlFor, ayuda, error, children }: { etiqueta: string; htmlFor?: string; ayuda?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-[12px] leading-4 font-medium text-suave">
        {etiqueta}
      </label>
      {children}
      {error ? <p className="text-[12px] font-medium text-critico">{error}</p> : ayuda ? <p className="text-[12px] text-suave">{ayuda}</p> : null}
    </div>
  );
}

export function Entrada({ className = "", ...p }: ComponentProps<"input">) {
  return <input {...p} className={`${claseCampo} ${className}`} />;
}

/** Select nativo: en el celular abre la rueda del sistema, que es lo más cómodo con el dedo. */
export function Selector({ className = "", children, ...p }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select {...p} className={`${claseCampo} appearance-none pr-9 ${className}`}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-suave" />
    </div>
  );
}

/** Fecha con el selector nativo del teléfono. */
export function Fecha({ className = "", ...p }: Omit<ComponentProps<"input">, "type">) {
  return (
    <div className="relative">
      <input type="date" {...p} className={`${claseCampo} pr-9 [&::-webkit-calendar-picker-indicator]:opacity-0 ${className}`} />
      <CalendarDays aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-suave" />
    </div>
  );
}

export function AreaTexto({ className = "", ...p }: ComponentProps<"textarea">) {
  return <textarea {...p} className={`${claseCampo} min-h-24 py-2 ${className}`} />;
}

export function MensajeError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-md border border-critico/20 bg-critico-fondo px-3 py-2 text-sm font-medium text-critico">
      {children}
    </div>
  );
}

/** Buscador: un formulario GET, funciona sin JavaScript y deja la búsqueda en la URL. */
export function Buscador({ accion, valor, placeholder = "Buscar…", nombre = "q", ocultos = {} }: { accion: string; valor?: string; placeholder?: string; nombre?: string; ocultos?: Record<string, string | undefined> }) {
  return (
    <form action={accion} role="search" className="relative">
      {Object.entries(ocultos).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-suave" />
      <input type="search" name={nombre} defaultValue={valor} placeholder={placeholder} aria-label={placeholder} className={`${claseCampo} pl-9`} />
    </form>
  );
}
