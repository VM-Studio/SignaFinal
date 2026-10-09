"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useAviso } from "@/components/ui/avisos";
import { Insignia } from "@/components/ui/basicos";
import { moverEnRuta } from "@/lib/pedidos/acciones";
import { textoEstado } from "@/lib/pedidos/presentacion";
import { hora } from "@/lib/formato";

export type ParadaRuta = {
  pedidoId: string;
  viajeId: string;
  estado: "TOMADO" | "EN_VIAJE";
  descripcion: string;
  origen: string;
  obra: string;
  vehiculo: string;
  salidaEstimada: string | null;
  chofer: string;
};

/** Los pedidos que tomó el chofer, en el orden en que los va a hacer. */
export function RutaDelDia({ paradas }: { paradas: ParadaRuta[] }) {
  const [pendiente, iniciar] = useTransition();
  const router = useRouter();
  const aviso = useAviso();
  const programadas = paradas.filter((p) => p.estado === "TOMADO");

  function mover(viajeId: string, sentido: "arriba" | "abajo") {
    iniciar(async () => {
      const r = await moverEnRuta(viajeId, sentido);
      if (!r.ok) aviso({ mensaje: r.error, tono: "error" });
      router.refresh();
    });
  }

  return (
    <ol className="divide-y divide-linea overflow-hidden rounded-[var(--radius-caja)] border border-linea bg-papel">
      {paradas.map((p, i) => {
        const e = textoEstado({ estado: p.estado, chofer: p.chofer, salidaEstimada: p.salidaEstimada });
        const k = programadas.findIndex((x) => x.viajeId === p.viajeId);
        return (
          <li key={p.viajeId} className="flex items-center gap-2">
            <span className="grid w-10 shrink-0 place-items-center self-stretch bg-negro text-lg font-semibold text-white">{i + 1}</span>
            <Link href={`/viaje/${p.pedidoId}`} className="min-w-0 flex-1 py-3">
              <p className="truncate font-semibold">{p.descripcion}</p>
              <p className="truncate text-sm">{p.origen} → Obra {p.obra}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-suave">
                <Insignia tono={e.tono}>{p.estado === "EN_VIAJE" ? "En viaje" : `Sale ${p.salidaEstimada ? hora(p.salidaEstimada) : "—"}`}</Insignia>
                {p.vehiculo}
              </p>
            </Link>
            {p.estado === "TOMADO" && programadas.length > 1 && (
              <div className="flex shrink-0 flex-col">
                <button aria-label="Subir en la ruta" disabled={pendiente || k === 0} onClick={() => mover(p.viajeId, "arriba")} className="grid size-11 place-items-center disabled:opacity-25">
                  <ChevronUp className="size-6" />
                </button>
                <button aria-label="Bajar en la ruta" disabled={pendiente || k === programadas.length - 1} onClick={() => mover(p.viajeId, "abajo")} className="grid size-11 place-items-center disabled:opacity-25">
                  <ChevronDown className="size-6" />
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
