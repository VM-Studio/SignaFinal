"use client";

import { useRouter } from "next/navigation";
import { Selector } from "@/components/ui/campos";

/** Filtro por ubicación: depósito o cada obra. Cambia la URL (se puede compartir y volver atrás). */
export function FiltroUbicacion({ valor, obras, base }: { valor: string; obras: { id: string; nombre: string }[]; base: string }) {
  const router = useRouter();
  return (
    <Selector aria-label="Ubicación" value={valor} onChange={(e) => router.push(`${base}${e.target.value ? `&donde=${e.target.value}` : ""}`)}>
      <option value="">Todas las ubicaciones</option>
      <option value="deposito">Depósito</option>
      {obras.map((o) => <option key={o.id} value={o.id}>Obra {o.nombre}</option>)}
    </Selector>
  );
}
