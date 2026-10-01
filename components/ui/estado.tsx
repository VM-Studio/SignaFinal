import type { Tono } from "@/lib/etiquetas";

const estilos: Record<Tono, string> = {
  ok: "bg-ok-fondo text-ok",
  aviso: "bg-aviso-fondo text-aviso",
  critico: "bg-critico-fondo text-critico",
  activo: "bg-negro text-white",
  neutro: "bg-black/5 text-suave",
};

const puntos: Record<Tono, string> = {
  ok: "bg-ok",
  aviso: "bg-aviso",
  critico: "bg-critico",
  activo: "bg-white",
  neutro: "bg-apagado",
};

/** Estado siempre con palabras; el color solo acompaña. */
export function Estado({ tono, children, className = "" }: { tono: Tono; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold leading-none whitespace-nowrap ${estilos[tono]} ${className}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${puntos[tono]}`} />
      {children}
    </span>
  );
}
