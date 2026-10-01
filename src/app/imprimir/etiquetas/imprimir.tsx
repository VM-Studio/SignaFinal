"use client";

import { Printer } from "lucide-react";

export function BotonImprimir() {
  return (
    <button onClick={() => window.print()} className="flex min-h-[52px] items-center gap-2 rounded-[var(--radius-caja)] bg-white px-5 font-semibold text-black">
      <Printer className="size-5" /> Imprimir
    </button>
  );
}
