"use client";

import { useEffect } from "react";
import { marcarAvisosLeidos } from "@/lib/avisos/acciones";

/** Al abrir /avisos, lo que se ve deja de contar en la campana. */
export function MarcarLeidos({ hay }: { hay: boolean }) {
  useEffect(() => {
    if (hay) void marcarAvisosLeidos();
  }, [hay]);
  return null;
}
