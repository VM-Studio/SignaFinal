import Link from "next/link";
import { ShoppingCart, Truck } from "lucide-react";

/** Arriba de /pedir y /pedir-materiales: dos cosas distintas, un viaje (a los choferes) o materiales (a Compras). */
export function ElegirPedido({ activo, obra }: { activo: "viaje" | "materiales"; obra?: string }) {
  const q = obra ? `?obra=${obra}` : "";
  const opciones = [
    { clave: "viaje", href: `/pedir${q}`, titulo: "Pedir un viaje", icono: <Truck className="size-5 shrink-0" /> },
    { clave: "materiales", href: `/pedir-materiales${q}`, titulo: "Pedir materiales a Compras", icono: <ShoppingCart className="size-5 shrink-0" /> },
  ] as const;
  return (
    <nav aria-label="Qué pedir" className="mb-4 grid grid-cols-2 gap-2">
      {opciones.map((o) => (
        <Link
          key={o.clave} href={o.href} aria-current={o.clave === activo ? "page" : undefined}
          className={`flex min-h-[56px] items-center justify-center gap-2 rounded-[var(--radius-caja)] border-2 px-2 text-center text-[15px] leading-tight font-bold ${o.clave === activo ? "border-negro bg-negro text-white" : "border-linea bg-papel hover:border-negro"}`}
        >
          {o.icono} {o.titulo}
        </Link>
      ))}
    </nav>
  );
}
