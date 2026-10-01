import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export type Variante = "primario" | "secundario" | "peligro" | "fantasma" | "claro";
export type Tamano = "chico" | "normal" | "grande";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-caja)] font-semibold select-none text-center disabled:pointer-events-none disabled:opacity-40";

const variantes: Record<Variante, string> = {
  primario: "bg-negro text-white hover:bg-carbon",
  secundario: "border-2 border-negro bg-papel text-negro hover:bg-fondo",
  peligro: "border-2 border-critico bg-papel text-critico hover:bg-critico-fondo",
  fantasma: "text-negro hover:bg-black/5",
  claro: "bg-white text-negro hover:bg-white/90",
};

// Mínimo 52px de alto en celular; "chico" solo para acciones secundarias de escritorio.
const tamanos: Record<Tamano, string> = {
  chico: "min-h-11 px-3 text-sm",
  normal: "min-h-[52px] px-5 text-base",
  grande: "min-h-[72px] px-6 text-lg",
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
