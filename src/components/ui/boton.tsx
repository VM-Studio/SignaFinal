import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export type Variante = "primario" | "secundario" | "peligro" | "fantasma" | "claro";
/** chico: 32px · normal: 48px celular / 36px escritorio · grande: 52px, solo la acción principal del chofer. */
export type Tamano = "chico" | "normal" | "grande";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium select-none text-center whitespace-nowrap disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-5 lg:[&_svg]:size-4 [&_svg]:shrink-0";

const variantes: Record<Variante, string> = {
  primario: "bg-negro text-white hover:bg-carbon",
  secundario: "border border-linea bg-papel text-tinta hover:bg-hover",
  peligro: "border border-linea bg-papel text-critico hover:bg-critico-fondo",
  fantasma: "text-tinta hover:bg-black/[0.04]",
  claro: "bg-white text-negro hover:bg-white/90",
};

const tamanos: Record<Tamano, string> = {
  chico: "min-h-9 px-3 text-sm lg:min-h-8",
  normal: "min-h-12 px-4 text-[15px] lg:min-h-9 lg:px-3 lg:text-[13px]",
  grande: "min-h-[52px] px-5 text-[15px] font-semibold",
};

export function claseBoton(v: Variante = "primario", t: Tamano = "normal", ancho = false, extra = "") {
  return [base, variantes[v], tamanos[t], ancho ? "w-full" : "", extra].join(" ");
}

type Comun = { variante?: Variante; tamano?: Tamano; ancho?: boolean; icono?: ReactNode };

export function Boton({ variante, tamano, ancho, icono, cargando, className, children, disabled, ...p }: ComponentProps<"button"> & Comun & { cargando?: boolean }) {
  return (
    <button {...p} disabled={disabled || cargando} aria-busy={cargando || undefined} className={claseBoton(variante, tamano, ancho, className)}>
      {icono}
      {cargando ? "Un momento…" : children}
    </button>
  );
}

export function BotonLink({ variante, tamano, ancho, icono, className, children, ...p }: ComponentProps<typeof Link> & Comun) {
  return (
    <Link {...p} className={claseBoton(variante, tamano, ancho, className)}>
      {icono}
      {children}
    </Link>
  );
}
