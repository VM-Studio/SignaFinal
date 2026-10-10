"use client";

import { CloudOff } from "lucide-react";
import { useEnvios } from "@/components/layout/conexion";

/** "Pendiente de envío" en la tarjeta si algo de este viaje quedó guardado sin señal. */
export function PendienteEnvio({ pedidoId }: { pedidoId: string }) {
  const envios = useEnvios().filter((e) => e.pedidoId === pedidoId && !e.error);
  if (!envios.length) return null;
  return (
    <p className="flex items-center gap-2 rounded-md bg-aviso-fondo px-3 py-2 font-semibold text-aviso-texto">
      <CloudOff className="size-5" /> Pendiente de envío · se manda sola con señal
    </p>
  );
}
