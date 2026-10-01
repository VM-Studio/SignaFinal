import { ChevronDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

const control =
  "w-full min-h-[52px] rounded-[var(--radius-caja)] border-2 border-linea bg-papel px-4 text-base text-tinta placeholder:text-apagado focus:border-negro focus:outline-none aria-[invalid=true]:border-critico";

export function Campo({ etiqueta, ayuda, error, children, htmlFor }: { etiqueta: string; ayuda?: ReactNode; error?: string; children: ReactNode; htmlFor?: string }) {
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

export function Entrada({ className = "", ...props }: ComponentProps<"input">) {
  return <input {...props} className={`${control} ${className}`} />;
}

export function Selector({ className = "", children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select {...props} className={`${control} appearance-none pr-11 ${className}`}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2" strokeWidth={2.5} />
    </div>
  );
}

export function AreaTexto({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${control} min-h-24 py-3 ${className}`} />;
}

export function MensajeError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-[var(--radius-caja)] border-2 border-critico bg-critico-fondo px-4 py-3 font-medium text-critico">
      {children}
    </div>
  );
}

export function Interruptor({ etiqueta, detalle, ...props }: ComponentProps<"input"> & { etiqueta: string; detalle?: string }) {
  return (
    <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-4 rounded-[var(--radius-caja)] border-2 border-linea bg-papel px-4 py-2">
      <span>
        <span className="block font-semibold">{etiqueta}</span>
        {detalle && <span className="block text-sm text-suave">{detalle}</span>}
      </span>
      <input type="checkbox" {...props} className="size-6 shrink-0 accent-negro" />
    </label>
  );
}
