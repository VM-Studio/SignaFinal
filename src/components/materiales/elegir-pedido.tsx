"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, FileText, ShoppingCart, Truck } from "lucide-react";
import { crearDocumento } from "@/lib/compras/documento-acciones";
import { useAviso } from "@/components/ui/avisos";

/**
 * Arriba de "Pedir": un viaje (a los choferes) o una compra, de tres formas: "Pedir materiales" (rápido, va a
 * Compras en el acto), "Armar orden de compra" o "Armar pedido especial" (la plantilla en borrador).
 */
export function ElegirPedido({ activo, obra, viaje = true }: { activo: "viaje" | "materiales"; obra?: string; viaje?: boolean }) {
  const router = useRouter();
  const aviso = useAviso();
  const [creando, setCreando] = useState<"OC" | "PE" | null>(null);
  const q = obra ? `?obra=${obra}` : "";
  const armar = async (tipo: "OC" | "PE") => {
    setCreando(tipo);
    const r = await crearDocumento(tipo, obra);
    if (!r.ok) {
      setCreando(null);
      return aviso({ mensaje: r.error, tono: "error" });
    }
    router.push(`/compras/oc/${r.datos.id}?desde=mis-pedidos`);
  };
  const clase = (si: boolean) =>
    `flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-caja)] border px-2 text-center text-[14px] leading-tight font-semibold lg:min-h-10 lg:text-[13px] ${si ? "border-tinta bg-hover text-tinta" : "border-linea bg-papel hover:border-linea-fuerte"}`;
  return (
    <nav aria-label="Qué pedir" className={`mb-4 grid gap-2 ${viaje ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}>
      {viaje && <Link href={`/pedir${q}`} aria-current={activo === "viaje" ? "page" : undefined} className={clase(activo === "viaje")}><Truck className="size-5 shrink-0" /> Pedir un viaje</Link>}
      <Link href={`/pedir-materiales${q}`} aria-current={activo === "materiales" ? "page" : undefined} className={clase(activo === "materiales")}><ShoppingCart className="size-5 shrink-0" /> Pedir materiales</Link>
      <button type="button" disabled={!!creando} onClick={() => armar("OC")} className={clase(false)}><FileText className="size-5 shrink-0" /> {creando === "OC" ? "Abriendo…" : "Armar orden de compra"}</button>
      <button type="button" disabled={!!creando} onClick={() => armar("PE")} className={clase(false)}><ClipboardList className="size-5 shrink-0" /> {creando === "PE" ? "Abriendo…" : "Armar pedido especial"}</button>
    </nav>
  );
}
