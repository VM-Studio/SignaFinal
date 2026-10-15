"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, FileText, ShoppingCart } from "lucide-react";
import { crearDocumento } from "@/lib/compras/documento-acciones";
import { useAviso } from "@/components/ui/avisos";

/**
 * Las tres formas de pedir una compra (para todos menos chofer y depósito): "Pedir materiales" (rápido: se
 * envía a Compras en el acto), "Armar orden de compra" y "Armar pedido especial" (la plantilla en borrador).
 */
export function OpcionesNueva({ rapida = "/pedir-materiales", obraId }: { rapida?: string | null; obraId?: string }) {
  const router = useRouter();
  const aviso = useAviso();
  const [creando, setCreando] = useState<"OC" | "PE" | null>(null);
  const armar = async (tipo: "OC" | "PE") => {
    setCreando(tipo);
    const r = await crearDocumento(tipo, obraId);
    if (!r.ok) {
      setCreando(null);
      return aviso({ mensaje: r.error, tono: "error" });
    }
    router.push(`/compras/oc/${r.datos.id}`);
  };
  const clase = "flex min-h-24 w-full items-start gap-3 rounded-[var(--radius-caja)] border border-linea bg-papel p-4 text-left hover:border-linea-fuerte disabled:opacity-60";
  return (
    <div className="grid gap-2 lg:grid-cols-3 lg:gap-4">
      {rapida && (
        <Link href={rapida} className={clase}>
          <ShoppingCart className="mt-0.5 size-5 shrink-0" />
          <span><span className="block text-[15px] font-semibold">Pedir materiales</span></span>
        </Link>
      )}
      <button type="button" disabled={!!creando} onClick={() => armar("OC")} className={clase}>
        <FileText className="mt-0.5 size-5 shrink-0" />
        <span><span className="block text-[15px] font-semibold">{creando === "OC" ? "Abriendo…" : "Armar orden de compra"}</span></span>
      </button>
      <button type="button" disabled={!!creando} onClick={() => armar("PE")} className={clase}>
        <ClipboardList className="mt-0.5 size-5 shrink-0" />
        <span><span className="block text-[15px] font-semibold">{creando === "PE" ? "Abriendo…" : "Armar pedido especial"}</span></span>
      </button>
    </div>
  );
}
