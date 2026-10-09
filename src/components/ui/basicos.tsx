import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { Tono } from "@/lib/etiquetas";

const tonos: Record<Tono, string> = {
  ok: "bg-ok-fondo text-ok",
  aviso: "bg-aviso-fondo text-aviso",
  critico: "bg-critico-fondo text-critico",
  activo: "bg-black/[0.06] text-tinta",
  neutro: "bg-black/[0.04] text-suave",
};
const puntos: Record<Tono, string> = { ok: "bg-ok", aviso: "bg-aviso", critico: "bg-critico", activo: "bg-tinta", neutro: "bg-apagado" };

/** Estado con palabras: punto de color + texto, 22px de alto, fondo suave. */
export function Insignia({ tono, children, className = "" }: { tono: Tono; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-[12px] leading-none font-medium whitespace-nowrap ${tonos[tono]} ${className}`}>
      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${puntos[tono]}`} />
      {children}
    </span>
  );
}

/** Tarjeta: borde de 1px, sin sombra. Agrupa, no destaca. */
export function Tarjeta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[var(--radius-caja)] border border-linea bg-papel ${className}`}>{children}</div>;
}

/**
 * Título de página. En escritorio va arriba, en el header blanco de 48px, con las acciones a la
 * derecha (el layout pone la campana y el avatar). En el celular el header negro ya dice la
 * sección, así que solo se ve si se pide (`siempre`), por ejemplo para mostrar la acción.
 */
export function Titulo({ children, detalle, accion, siempre = false }: { children: ReactNode; detalle?: ReactNode; accion?: ReactNode; siempre?: boolean }) {
  return (
    <div className={siempre ? "mb-4 lg:mb-6" : detalle ? "hidden lg:mb-6 lg:block" : ""}>
      <div className={`${siempre ? "flex" : "hidden"} flex-wrap items-center justify-between gap-3 lg:fixed lg:top-0 lg:right-[104px] lg:left-[232px] lg:z-[25] lg:flex lg:h-[47px] lg:flex-nowrap lg:bg-papel lg:pl-6`}>
        <h1 className="min-w-0 truncate text-xl font-semibold lg:text-[22px] lg:leading-7">{children}</h1>
        {accion && <div className="flex shrink-0 items-center gap-2">{accion}</div>}
      </div>
      {detalle && <p className="mt-1 text-sm text-suave lg:mt-0">{detalle}</p>}
    </div>
  );
}

/** Título de sección: etiqueta de 11px en mayúsculas. */
export function Subtitulo({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mt-6 mb-2 flex min-h-6 items-center justify-between gap-2">
      <h2 className="etiqueta">{children}</h2>
      {accion}
    </div>
  );
}

/** Fila de lista: 56px en celular (título arriba, detalle abajo); 44px en escritorio, en una línea. */
export function FilaLista({ href, titulo, detalle, derecha }: { href?: string; titulo: ReactNode; detalle?: ReactNode; derecha?: ReactNode }) {
  const contenido = (
    <>
      <div className="min-w-0 flex-1 lg:flex lg:items-baseline lg:gap-3">
        <p className="truncate font-medium lg:shrink-0 lg:basis-[min(40%,320px)]">{titulo}</p>
        {detalle && <p className="truncate text-sm text-suave">{detalle}</p>}
      </div>
      {derecha && <div className="shrink-0">{derecha}</div>}
      {href && <ChevronRight aria-hidden className="size-4 shrink-0 text-apagado" />}
    </>
  );
  const clase = "flex min-h-14 items-center gap-3 px-4 py-2 lg:min-h-11 lg:py-1.5";
  return <li>{href ? <Link href={href} className={`${clase} hover:bg-hover`}>{contenido}</Link> : <div className={clase}>{contenido}</div>}</li>;
}

/** Lista: en el celular, filas de borde a borde; en escritorio, dentro de un recuadro de 1px. */
export function Lista({ children }: { children: ReactNode }) {
  return <ul className="-mx-4 divide-y divide-linea border-y border-linea bg-papel lg:mx-0 lg:overflow-hidden lg:rounded-[var(--radius-caja)] lg:border">{children}</ul>;
}

export function Vacio({ icono, titulo, children, accion }: { icono?: ReactNode; titulo: string; children?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-[var(--radius-caja)] border border-linea bg-papel px-6 py-10 text-center [&_svg]:size-6">
      {icono && <div className="mb-2 text-apagado">{icono}</div>}
      <p className="font-medium">{titulo}</p>
      {children && <div className="max-w-sm text-sm text-suave">{children}</div>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

/** Esqueleto de carga: bloques grises quietos (sin animaciones, como pide el diseño). */
export function Esqueleto({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`rounded-md bg-black/[0.05] ${className}`} />;
}

/** Número destacado: etiqueta de 11px y la cifra a 28px. */
export function Cifra({ etiqueta, valor, detalle, tono }: { etiqueta: string; valor: ReactNode; detalle?: ReactNode; tono?: "ok" | "aviso" | "critico" }) {
  const color = tono === "critico" ? "text-critico" : tono === "aviso" ? "text-aviso" : tono === "ok" ? "text-ok" : "";
  return (
    <Tarjeta className="p-4">
      <p className="etiqueta">{etiqueta}</p>
      <p className={`mt-2 text-4xl font-semibold tracking-tight tabular-nums ${color}`}>{valor}</p>
      {detalle && <p className="mt-1 text-sm text-suave">{detalle}</p>}
    </Tarjeta>
  );
}

/** Pestañas con enlaces: el estado queda en la URL y funcionan con el botón Atrás. */
export function Pestanas({ items }: { items: { href: string; etiqueta: string; activa: boolean }[] }) {
  return (
    <nav className="mb-4 flex gap-0.5 overflow-x-auto rounded-md border border-linea bg-papel p-0.5 lg:inline-flex lg:max-w-full">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.activa ? "page" : undefined}
          className={`grid min-h-10 flex-1 place-items-center rounded-[5px] px-3 text-sm font-medium whitespace-nowrap lg:min-h-7 lg:flex-none ${i.activa ? "bg-black/[0.06] text-tinta" : "text-suave hover:text-tinta"}`}
        >
          {i.etiqueta}
        </Link>
      ))}
    </nav>
  );
}

/**
 * La acción principal del inicio de cada rol: una tarjeta con lo que hay que hacer y el botón
 * primario. Es la única tarjeta "destacada" de la app (junto con el viaje en curso del chofer).
 */
export function AccionPrincipal({ href, icono, titulo, detalle, boton }: { href: string; icono: ReactNode; titulo: ReactNode; detalle?: ReactNode; boton: string }) {
  return (
    <Tarjeta className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-md bg-black/[0.04] [&_svg]:size-5">{icono}</span>
        <div className="min-w-0">
          <p className="text-[15px] leading-5 font-semibold">{titulo}</p>
          {detalle && <p className="text-sm text-suave">{detalle}</p>}
        </div>
      </div>
      <Link href={href} className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-md bg-negro px-4 text-[15px] font-medium text-white hover:bg-carbon lg:min-h-9 lg:px-3 lg:text-[13px]">
        {boton}
      </Link>
    </Tarjeta>
  );
}

/** Aviso de algo que hay que hacer (fondo suave del color de estado), en una línea con su enlace. */
export function Llamado({ href, icono, tono, children, enlace }: { href: string; icono: ReactNode; tono: "ok" | "aviso" | "critico"; children: ReactNode; enlace: string }) {
  const color = { ok: "bg-ok-fondo text-ok", aviso: "bg-aviso-fondo text-aviso", critico: "bg-critico-fondo text-critico" }[tono];
  return (
    <Link href={href} className={`flex min-h-12 items-center gap-3 rounded-[var(--radius-caja)] px-4 py-2 text-sm font-medium lg:min-h-10 [&_svg]:size-4 [&_svg]:shrink-0 ${color}`}>
      {icono}
      <span className="flex-1">{children}</span>
      <span className="underline underline-offset-2">{enlace}</span>
    </Link>
  );
}
