import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variante = "primario" | "secundario" | "peligro" | "fantasma" | "claro";
type Tamano = "normal" | "grande" | "chico";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-caja)] font-semibold select-none disabled:opacity-40 disabled:pointer-events-none";

const variantes: Record<Variante, string> = {
  primario: "bg-negro text-white hover:bg-carbon active:bg-carbon",
  secundario: "bg-papel text-negro border-2 border-negro hover:bg-fondo",
  peligro: "bg-papel text-critico border-2 border-critico hover:bg-critico-fondo",
  fantasma: "text-negro hover:bg-black/5",
  claro: "bg-white text-negro hover:bg-white/90",
};

const tamanos: Record<Tamano, string> = {
  chico: "min-h-10 px-3 text-sm",
  normal: "min-h-[52px] px-5 text-base",
  grande: "min-h-[72px] px-6 text-lg",
};

export function claseBoton(v: Variante = "primario", t: Tamano = "normal", ancho = false, extra = "") {
  return [base, variantes[v], tamanos[t], ancho ? "w-full" : "", extra].join(" ");
}

type Props = ComponentProps<"button"> & {
  variante?: Variante;
  tamano?: Tamano;
  ancho?: boolean;
  cargando?: boolean;
  icono?: ReactNode;
};

export function Boton({ variante, tamano, ancho, cargando, icono, className, children, disabled, ...props }: Props) {
  return (
    <button
      {...props}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={claseBoton(variante, tamano, ancho, className)}
    >
      {icono}
      {cargando ? "Un momento…" : children}
    </button>
  );
}

type PropsLink = ComponentProps<typeof Link> & { variante?: Variante; tamano?: Tamano; ancho?: boolean; icono?: ReactNode };

export function BotonLink({ variante, tamano, ancho, icono, className, children, ...props }: PropsLink) {
  return (
    <Link {...props} className={claseBoton(variante, tamano, ancho, className)}>
      {icono}
      {children}
    </Link>
  );
}
