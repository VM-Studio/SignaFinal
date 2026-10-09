"use client";

import { useRouter } from "next/navigation";
import { Selector } from "@/components/ui/campos";

/** Filtro por obra de la cola de Compras (queda en la URL). */
export function FiltroObra({ obras, valor, pestana }: { obras: { id: string; nombre: string }[]; valor?: string; pestana?: string }) {
  const router = useRouter();
  return (
    <div className="mb-3 max-w-xs">
      <Selector
        aria-label="Filtrar por obra" value={valor ?? ""}
        onChange={(e) => router.push(`/compras?${new URLSearchParams({ ...(pestana ? { p: pestana } : {}), ...(e.target.value ? { obra: e.target.value } : {}) }).toString()}`)}
      >
        <option value="">Todas las obras</option>
        {obras.map((o) => <option key={o.id} value={o.id}>Obra {o.nombre}</option>)}
      </Selector>
    </div>
  );
}
