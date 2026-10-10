"use client";

import { useRouter } from "next/navigation";
import { Selector } from "@/components/ui/campos";

/** Filtro por ubicación: los depósitos (todos o cada uno) o cada obra. Cambia la URL (se puede compartir y volver atrás). */
export function FiltroUbicacion({ valor, obras, base, depositos = [] }: { valor: string; obras: { id: string; nombre: string }[]; base: string; depositos?: { id: string; nombre: string }[] }) {
  const router = useRouter();
  return (
    <Selector aria-label="Ubicación" value={valor} onChange={(e) => router.push(`${base}${e.target.value ? `&donde=${e.target.value}` : ""}`)}>
      <option value="">Todas las ubicaciones</option>
      <option value="deposito">{depositos.length > 1 ? "Todos los depósitos" : "Depósito"}</option>
      {depositos.length > 1 && depositos.map((d) => <option key={d.id} value={`dep:${d.id}`}>{d.nombre}</option>)}
      {obras.map((o) => <option key={o.id} value={o.id}>Obra {o.nombre}</option>)}
    </Selector>
  );
}
