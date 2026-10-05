"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CheckCheck } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { marcarLeida, marcarTodasLeidas } from "@/lib/avisos/acciones";

/** Un aviso de la bandeja: al tocarlo se marca leído y lleva a su enlace. */
export function ItemAviso({ id, enlace, leida, children }: { id: string; enlace: string | null; leida: boolean; children: ReactNode }) {
  const router = useRouter();
  const clase = `block w-full rounded-[var(--radius-caja)] border p-4 text-left ${leida ? "border-linea bg-papel" : "border-2 border-negro bg-papel"}`;
  return (
    <button
      className={`${clase} hover:bg-fondo/60`}
      onClick={async () => {
        if (!leida) void marcarLeida(id);
        if (enlace) router.push(enlace);
        else router.refresh();
      }}
    >
      {children}
    </button>
  );
}

export function BotonMarcarTodas({ hay }: { hay: number }) {
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();
  if (!hay) return null;
  return (
    <Boton variante="secundario" tamano="chico" cargando={enviando} icono={<CheckCheck className="size-4" />} onClick={async () => {
      setEnviando(true);
      await marcarTodasLeidas();
      setEnviando(false);
      router.refresh();
    }}>
      Marcar todas
    </Boton>
  );
}
