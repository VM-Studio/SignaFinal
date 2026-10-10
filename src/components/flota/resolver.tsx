"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolverIncidente } from "@/lib/flota/acciones";
import { useAviso } from "@/components/ui/avisos";

export function BotonResolver({ id, resuelto }: { id: string; resuelto: boolean }) {
  const [pendiente, iniciar] = useTransition();
  const router = useRouter();
  const aviso = useAviso();
  return (
    <button
      disabled={pendiente}
      onClick={() =>
        iniciar(async () => {
          const r = await resolverIncidente(id, !resuelto);
          if (!r.ok) return aviso({ mensaje: r.error, tono: "error" });
          aviso({ mensaje: resuelto ? "Incidente reabierto." : "Incidente resuelto.", deshacer: async () => { await resolverIncidente(id, resuelto); router.refresh(); } });
          router.refresh();
        })
      }
      className={`min-h-11 rounded-full px-3 text-[13px] font-semibold disabled:opacity-50 ${resuelto ? "bg-ok-fondo text-ok" : "bg-aviso-fondo text-aviso-texto"}`}
    >
      {resuelto ? "Resuelto" : "Abierto · marcar resuelto"}
    </button>
  );
}
