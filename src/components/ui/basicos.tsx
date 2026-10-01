import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { Tono } from "@/lib/etiquetas";

const tonos: Record<Tono, string> = {
  ok: "bg-ok-fondo text-ok",
  aviso: "bg-aviso-fondo text-aviso",
  critico: "bg-critico-fondo text-critico",
  activo: "bg-negro text-white",
  neutro: "bg-black/5 text-suave",
};
const puntos: Record<Tono, string> = { ok: "bg-ok", aviso: "bg-aviso", critico: "bg-critico", activo: "bg-white", neutro: "bg-apagado" };

/** Estado con palabras; el color solo acompaña. */
export function Insignia({ tono, children, className = "" }: { tono: Tono; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] leading-none font-semibold whitespace-nowrap ${tonos[tono]} ${className}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${puntos[tono]}`} />
      {children}
    </span>
  );
}

export function Tarjeta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[var(--radius-caja)] border border-linea bg-papel ${className}`}>{children}</div>;
}

/** Título de página. En el celular el header ya dice la sección, así que acá solo se ve en escritorio salvo que se pida. */
export function Titulo({ children, detalle, accion, siempre = false }: { children: ReactNode; detalle?: ReactNode; accion?: ReactNode; siempre?: boolean }) {
  return (
    <div className={`mb-5 flex-wrap items-end justify-between gap-3 ${siempre ? "flex" : "hidden lg:flex"}`}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{children}</h1>
        {detalle && <p className="mt-1 text-suave">{detalle}</p>}
      </div>
      {accion}
    </div>
  );
}

export function Subtitulo({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mt-7 mb-2 flex items-center justify-between gap-2">
      <h2 className="text-sm font-bold tracking-wider text-suave uppercase">{children}</h2>
      {accion}
    </div>
  );
}

/** Fila de lista tocable: alto mínimo de 64px, título, detalle, lo de la derecha y flecha. */
export function FilaLista({ href, titulo, detalle, derecha }: { href?: string; titulo: ReactNode; detalle?: ReactNode; derecha?: ReactNode }) {
  const contenido = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{titulo}</p>
        {detalle && <p className="truncate text-sm text-suave">{detalle}</p>}
      </div>
      {derecha && <div className="shrink-0">{derecha}</div>}
      {href && <ChevronRight aria-hidden className="size-5 shrink-0 text-apagado" />}
    </>
  );
  const clase = "flex min-h-16 items-center gap-3 px-4 py-3";
  return <li>{href ? <Link href={href} className={`${clase} hover:bg-fondo`}>{contenido}</Link> : <div className={clase}>{contenido}</div>}</li>;
}

export function Lista({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">{children}</ul>;
}

export function Vacio({ icono, titulo, children, accion }: { icono?: ReactNode; titulo: string; children?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-caja)] border border-dashed border-linea-fuerte bg-papel px-6 py-12 text-center">
      {icono && <div className="mb-1 text-apagado">{icono}</div>}
      <p className="text-lg font-semibold">{titulo}</p>
      {children && <div className="max-w-sm text-suave">{children}</div>}
      {accion && <div className="mt-3">{accion}</div>}
    </div>
  );
}

/** Esqueleto de carga: bloques grises quietos (sin animaciones, como pide el diseño). */
export function Esqueleto({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`rounded-[var(--radius-caja)] bg-black/[0.07] ${className}`} />;
}

export function Cifra({ etiqueta, valor, detalle, tono }: { etiqueta: string; valor: ReactNode; detalle?: ReactNode; tono?: "ok" | "aviso" | "critico" }) {
  const color = tono === "critico" ? "text-critico" : tono === "aviso" ? "text-aviso" : tono === "ok" ? "text-ok" : "";
  return (
    <Tarjeta className="p-4">
      <p className="text-xs font-semibold tracking-wider text-suave uppercase">{etiqueta}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${color}`}>{valor}</p>
      {detalle && <p className="mt-0.5 text-sm text-suave">{detalle}</p>}
    </Tarjeta>
  );
}

/** Pestañas con enlaces: el estado queda en la URL y funcionan con el botón Atrás. */
export function Pestanas({ items }: { items: { href: string; etiqueta: string; activa: boolean }[] }) {
  return (
    <nav className="mb-4 flex gap-1 overflow-x-auto rounded-[var(--radius-caja)] bg-black/5 p-1">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.activa ? "page" : undefined}
          className={`grid min-h-11 flex-1 place-items-center rounded-md px-4 text-sm font-semibold whitespace-nowrap ${i.activa ? "bg-papel text-negro shadow-[0_0_0_1px_var(--color-linea)]" : "text-suave"}`}
        >
          {i.etiqueta}
        </Link>
      ))}
    </nav>
  );
}
