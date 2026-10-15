"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAviso } from "@/components/ui/avisos";
import { llevarOferta, noLlevarOferta } from "@/lib/viajes/acciones-ofertas";
import type { Oferta } from "@/lib/viajes/ofrecer";

/**
 * Arriba de Hoy: "Pidieron algo más para Darwin" (un pedido nuevo para una obra del viaje aceptado o del mismo
 * lugar de retiro). Dos botones grandes: "Sí, lo llevo" (se suma al viaje con las paradas en orden) y "No".
 */
export function OfertasHoy({ ofertas }: { ofertas: Oferta[] }) {
  const [enviando, setEnviando] = useState<string | null>(null);
  const aviso = useAviso();
  const router = useRouter();
  async function responder(o: Oferta, si: boolean) {
    setEnviando(`${o.pedidoId}:${si}`);
    const r = si ? await llevarOferta(o.viajeId, o.pedidoId) : await noLlevarOferta(o.viajeId, o.pedidoId);
    setEnviando(null);
    if (!r.ok) aviso({ mensaje: r.error, tono: "error" });
    else if (si) aviso({ mensaje: `Listo: ${o.titulo.toLowerCase()} va en tu viaje. ${o.solicitante} ya sabe.` });
    router.refresh();
  }
  if (!ofertas.length) return null;
  return (
    <ul className="mb-4 flex flex-col gap-3">
      {ofertas.map((o) => (
        <li key={`${o.viajeId}:${o.pedidoId}`} data-oferta={o.numero} className="flex flex-col gap-3 rounded-[var(--radius-caja)] border border-tinta bg-papel p-4">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold tracking-[0.04em] text-suave uppercase">{o.grupo === "mismaObra" ? `Pidieron algo más para ${o.lugar}` : `Hay algo más para retirar en ${o.lugar}`}</p>
            <p className="mt-1 text-[19px] leading-tight font-semibold break-words">{o.titulo}</p>
            <p className="mt-1 text-[15px] break-words">{o.detalle} · pidió {o.solicitante}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={!!enviando} onClick={() => responder(o, true)} className="min-h-12 rounded-md bg-negro text-[16px] font-semibold text-white disabled:opacity-60">
              {enviando === `${o.pedidoId}:true` ? "Sumando…" : "Sí, lo llevo"}
            </button>
            <button type="button" disabled={!!enviando} onClick={() => responder(o, false)} className="min-h-12 rounded-md border border-linea-fuerte bg-papel text-[16px] font-semibold disabled:opacity-60">No</button>
          </div>
        </li>
      ))}
    </ul>
  );
}
