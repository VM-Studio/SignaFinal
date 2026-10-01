import type { ReactNode } from "react";

export function Tarjeta({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "li" | "article" }) {
  return <Tag className={`rounded-[var(--radius-caja)] border border-linea bg-papel ${className}`}>{children}</Tag>;
}

export function Titulo({ children, detalle, accion }: { children: ReactNode; detalle?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 lg:mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{children}</h1>
        {detalle && <p className="mt-1 text-suave">{detalle}</p>}
      </div>
      {accion && <div className="flex shrink-0 gap-2">{accion}</div>}
    </div>
  );
}

export function Subtitulo({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mt-6 mb-2 flex items-center justify-between gap-2 first:mt-0">
      <h2 className="text-sm font-bold uppercase tracking-wider text-suave">{children}</h2>
      {accion}
    </div>
  );
}

export function Vacio({ titulo, children, icono }: { titulo: string; children?: ReactNode; icono?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-caja)] border border-dashed border-linea-fuerte bg-papel px-6 py-10 text-center">
      {icono && <div className="text-apagado">{icono}</div>}
      <p className="font-semibold">{titulo}</p>
      {children && <div className="text-sm text-suave">{children}</div>}
    </div>
  );
}

export function Dato({ etiqueta, children, className = "" }: { etiqueta: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-semibold uppercase tracking-wider text-suave">{etiqueta}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

export function Cifra({ etiqueta, valor, detalle, tono }: { etiqueta: string; valor: ReactNode; detalle?: ReactNode; tono?: "critico" | "aviso" | "ok" }) {
  const color = tono === "critico" ? "text-critico" : tono === "aviso" ? "text-aviso" : tono === "ok" ? "text-ok" : "";
  return (
    <Tarjeta className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-suave">{etiqueta}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{valor}</p>
      {detalle && <p className="mt-0.5 text-sm text-suave">{detalle}</p>}
    </Tarjeta>
  );
}

/** Tabla de escritorio con estilos comunes. */
export function Tabla({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-[var(--radius-caja)] border border-linea bg-papel ${className}`}>
      <table className="w-full text-left text-[15px] [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-suave [&_thead]:border-b [&_thead]:border-linea [&_tbody_tr]:border-b [&_tbody_tr]:border-linea [&_tbody_tr:last-child]:border-0 [&_tbody_tr:hover]:bg-fondo/60">
        {children}
      </table>
    </div>
  );
}
